import { z } from "zod";

import {
  youtubeChannelRecentCache,
  youtubeChannelResolveCache,
  youtubeChannelStatsCache,
  youtubeChannelUploadsCache,
  youtubeSerpCache,
} from "./cache/index.ts";
import { getCachedValue, setCachedValue } from "./cache/persistent.ts";
import {
  isYouTubeRateLimitError,
  youtubeFetchJson,
} from "./youtube-request.ts";
import type {
  ChannelProfile,
  YouTubeChannelStats,
  YouTubeSerp,
  YouTubeVideo,
} from "./types.ts";

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";

const searchSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z
              .object({
                videoId: z.string().optional(),
                channelId: z.string().optional(),
              })
              .optional(),
            snippet: z
              .object({
                channelId: z.string().optional(),
              })
              .optional(),
          })
          .passthrough()
      )
      .optional(),
    pageInfo: z
      .object({
        totalResults: z.union([z.number(), z.string()]).optional(),
      })
      .optional(),
    nextPageToken: z.string().optional(),
  })
  .passthrough();

const videosSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string(),
            snippet: z
              .object({
                title: z.string(),
                description: z.string().optional(),
                tags: z.array(z.string()).optional(),
                publishedAt: z.string(),
                channelId: z.string(),
                channelTitle: z.string(),
                liveBroadcastContent: z.string().optional(),
                thumbnails: z
                  .record(
                    z.string(),
                    z.object({
                      url: z.string().optional(),
                    })
                  )
                  .optional(),
              })
              .passthrough(),
            statistics: z
              .object({
                viewCount: z.string().optional(),
                likeCount: z.string().optional(),
                commentCount: z.string().optional(),
              })
              .optional(),
            contentDetails: z
              .object({
                duration: z.string().optional(),
              })
              .optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

const channelsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string(),
            statistics: z
              .object({
                subscriberCount: z.string().optional(),
                videoCount: z.string().optional(),
                viewCount: z.string().optional(),
              })
              .optional(),
            contentDetails: z
              .object({
                relatedPlaylists: z
                  .object({
                    uploads: z.string().optional(),
                  })
                  .optional(),
              })
              .optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

const playlistItemsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            contentDetails: z
              .object({
                videoId: z.string().optional(),
              })
              .optional(),
          })
          .passthrough()
      )
      .optional(),
    nextPageToken: z.string().optional(),
  })
  .passthrough();

function parseNumber(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseDurationSeconds(value: string | undefined) {
  if (!value) return 0;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

type SearchSnapshot = {
  keyword: string;
  ids: string[];
  totalResults: number | null;
};

function getSerpCacheKey(keyword: string, maxVideos: number) {
  return `yt:serp:${keyword.toLowerCase()}::${maxVideos}`;
}

function getThumbnailUrl(thumbnails: Record<string, { url?: string }> | undefined) {
  if (!thumbnails) return "";
  return (
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    ""
  );
}

async function fetchChannelStats(
  channelIds: string[],
  options?: { quotaUser?: string }
) {
  const stats: Record<string, YouTubeChannelStats> = {};
  const missing: string[] = [];

  for (const id of channelIds) {
    const cached = await getCachedValue(
      `yt:channel:${id}`,
      youtubeChannelStatsCache,
      12 * 60 * 60 * 1000
    );
    if (cached !== undefined) {
      stats[id] = cached;
    } else {
      missing.push(id);
    }
  }

  for (const group of chunk(missing, 50)) {
    const channelsUrl = new URL(CHANNELS_ENDPOINT);
    channelsUrl.searchParams.set("part", "statistics");
    channelsUrl.searchParams.set("id", group.join(","));
    channelsUrl.searchParams.set(
      "fields",
      "items(id,statistics(subscriberCount,videoCount,viewCount))"
    );

    const data = await youtubeFetchJson<unknown>(channelsUrl.toString(), {
      quotaUser: options?.quotaUser,
    });
    const parsed = channelsSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("Unexpected YouTube channels response.");
    }

    for (const item of parsed.data.items ?? []) {
      const channelStats: YouTubeChannelStats = {
        channelId: item.id,
        subscriberCount: parseNumber(item.statistics?.subscriberCount),
        videoCount: parseNumber(item.statistics?.videoCount),
        viewCount: parseNumber(item.statistics?.viewCount),
      };
      stats[item.id] = channelStats;
      await setCachedValue(
        `yt:channel:${item.id}`,
        channelStats,
        youtubeChannelStatsCache,
        12 * 60 * 60 * 1000
      );
    }
  }

  return stats;
}

async function fetchSearchSnapshot(
  keyword: string,
  maxVideos: number,
  options?: { quotaUser?: string }
): Promise<SearchSnapshot> {
  const normalizedKeyword = keyword.trim();
  const searchUrl = new URL(SEARCH_ENDPOINT);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("q", normalizedKeyword);
  searchUrl.searchParams.set("order", "relevance");
  searchUrl.searchParams.set("maxResults", String(maxVideos));
  searchUrl.searchParams.set(
    "fields",
    "items(id(videoId),snippet(channelId,publishedAt)),pageInfo(totalResults)"
  );

  const searchData = await youtubeFetchJson<unknown>(searchUrl.toString(), {
    quotaUser: options?.quotaUser,
  });
  const searchParsed = searchSchema.safeParse(searchData);

  if (!searchParsed.success) {
    throw new Error("Unexpected YouTube search response.");
  }

  const ids = (searchParsed.data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  const totalResultsRaw = searchParsed.data.pageInfo?.totalResults;
  const totalResults = Number.isFinite(Number(totalResultsRaw))
    ? Number(totalResultsRaw)
    : null;

  return {
    keyword: normalizedKeyword,
    ids,
    totalResults,
  };
}

async function fetchVideosByIds(
  ids: string[],
  options?: { quotaUser?: string }
) {
  const videoMap = new Map<string, YouTubeVideo>();
  if (ids.length === 0) return videoMap;

  for (const group of chunk(ids, 50)) {
    const videosUrl = new URL(VIDEOS_ENDPOINT);
    videosUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    videosUrl.searchParams.set("id", group.join(","));
    videosUrl.searchParams.set(
      "fields",
      "items(id,snippet(title,description,tags,publishedAt,channelId,channelTitle,thumbnails,liveBroadcastContent),statistics(viewCount,likeCount,commentCount),contentDetails(duration))"
    );

    const videosData = await youtubeFetchJson<unknown>(videosUrl.toString(), {
      quotaUser: options?.quotaUser,
    });
    const videosParsed = videosSchema.safeParse(videosData);

    if (!videosParsed.success) {
      throw new Error("Unexpected YouTube videos response.");
    }

    for (const item of videosParsed.data.items ?? []) {
      const viewCount = parseNumber(item.statistics?.viewCount);
      const likeCount = parseNumber(item.statistics?.likeCount);
      const commentCount = parseNumber(item.statistics?.commentCount);
      const thumbnailUrl = getThumbnailUrl(item.snippet.thumbnails);

      videoMap.set(item.id, {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description ?? "",
        tags: item.snippet.tags ?? [],
        publishedAt: item.snippet.publishedAt,
        viewCount,
        likeCount,
        commentCount,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        channelSubscriberCount: 0,
        thumbnailUrl,
        durationSeconds: parseDurationSeconds(item.contentDetails?.duration),
      });
    }
  }

  return videoMap;
}

async function fetchChannelUploadsDetails(
  channelId: string,
  options?: { quotaUser?: string }
) {
  const cachedUploads = await getCachedValue(
    `yt:channel:uploads:${channelId}`,
    youtubeChannelUploadsCache,
    12 * 60 * 60 * 1000
  );
  const cachedStats = await getCachedValue(
    `yt:channel:${channelId}`,
    youtubeChannelStatsCache,
    12 * 60 * 60 * 1000
  );

  if (cachedUploads && cachedStats) {
    return {
      uploadsPlaylistId: cachedUploads,
      stats: cachedStats,
    };
  }

  const channelsUrl = new URL(CHANNELS_ENDPOINT);
  channelsUrl.searchParams.set("part", "contentDetails,statistics");
  channelsUrl.searchParams.set("id", channelId);
  channelsUrl.searchParams.set(
    "fields",
    "items(id,statistics(subscriberCount,videoCount,viewCount),contentDetails(relatedPlaylists(uploads)))"
  );

  const data = await youtubeFetchJson<unknown>(channelsUrl.toString(), {
    quotaUser: options?.quotaUser,
  });
  const parsed = channelsSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Unexpected YouTube channels response.");
  }

  const item = parsed.data.items?.[0];
  const stats: YouTubeChannelStats = {
    channelId,
    subscriberCount: parseNumber(item?.statistics?.subscriberCount),
    videoCount: parseNumber(item?.statistics?.videoCount),
    viewCount: parseNumber(item?.statistics?.viewCount),
  };
  const uploadsPlaylistId =
    item?.contentDetails?.relatedPlaylists?.uploads ?? "";

  await setCachedValue(
    `yt:channel:${channelId}`,
    stats,
    youtubeChannelStatsCache,
    12 * 60 * 60 * 1000
  );

  if (uploadsPlaylistId) {
    await setCachedValue(
      `yt:channel:uploads:${channelId}`,
      uploadsPlaylistId,
      youtubeChannelUploadsCache,
      12 * 60 * 60 * 1000
    );
  }

  return { uploadsPlaylistId, stats };
}

export async function getYouTubeSerp(
  keyword: string,
  maxVideos: number,
  options?: {
    quotaUser?: string;
    allowStaleOnRateLimit?: boolean;
    onStale?: () => void;
  }
): Promise<YouTubeSerp> {
  const normalizedKeyword = keyword.trim();
  const cacheKey = getSerpCacheKey(normalizedKeyword, maxVideos);
  const cacheEntry = youtubeSerpCache.getEntry(cacheKey);
  const staleCandidate =
    cacheEntry && Date.now() > cacheEntry.expiresAt ? cacheEntry.value : undefined;
  const cached = await getCachedValue(
    cacheKey,
    youtubeSerpCache,
    6 * 60 * 60 * 1000
  );
  if (cached !== undefined) return cached;

  try {
    const searchSnapshot = await fetchSearchSnapshot(
      normalizedKeyword,
      maxVideos,
      { quotaUser: options?.quotaUser }
    );

    if (searchSnapshot.ids.length === 0) {
      const empty = {
        keyword: normalizedKeyword,
        totalResults: searchSnapshot.totalResults,
        videos: [],
      };
      await setCachedValue(
        cacheKey,
        empty,
        youtubeSerpCache,
        6 * 60 * 60 * 1000
      );
      return empty;
    }

    const videoMap = await fetchVideosByIds(searchSnapshot.ids, {
      quotaUser: options?.quotaUser,
    });
    const channelIds = Array.from(
      new Set(Array.from(videoMap.values()).map((video) => video.channelId))
    );
    const channelStatsMap = await fetchChannelStats(channelIds, {
      quotaUser: options?.quotaUser,
    });

    for (const video of videoMap.values()) {
      const stats = channelStatsMap[video.channelId];
      if (stats) {
        video.channelSubscriberCount = stats.subscriberCount;
      }
    }

    const ordered = searchSnapshot.ids
      .map((id) => videoMap.get(id))
      .filter((video): video is YouTubeVideo => Boolean(video));

    const serpResult: YouTubeSerp = {
      keyword: normalizedKeyword,
      totalResults: searchSnapshot.totalResults,
      videos: ordered,
    };

    await setCachedValue(
      cacheKey,
      serpResult,
      youtubeSerpCache,
      6 * 60 * 60 * 1000
    );
    return serpResult;
  } catch (error) {
    if (
      options?.allowStaleOnRateLimit &&
      staleCandidate &&
      isYouTubeRateLimitError(error)
    ) {
      options.onStale?.();
      return staleCandidate;
    }
    throw error;
  }
}

export async function getYouTubeSerpsBatch(
  keywords: string[],
  maxVideos: number,
  options?: {
    quotaUser?: string;
    allowStaleOnRateLimit?: boolean;
    onStale?: () => void;
  }
) {
  const results = new Map<string, YouTubeSerp>();
  const missing: string[] = [];
  const staleCandidates = new Map<string, YouTubeSerp>();

  const uniqueKeywords = Array.from(
    new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))
  );

  for (const normalized of uniqueKeywords) {
    const cacheKey = getSerpCacheKey(normalized, maxVideos);
    const cacheEntry = youtubeSerpCache.getEntry(cacheKey);
    if (cacheEntry && Date.now() > cacheEntry.expiresAt) {
      staleCandidates.set(normalized, cacheEntry.value);
    }
    const cached = await getCachedValue(
      cacheKey,
      youtubeSerpCache,
      6 * 60 * 60 * 1000
    );
    if (cached !== undefined) {
      results.set(normalized, cached);
    } else {
      missing.push(normalized);
    }
  }

  if (missing.length === 0) return results;

  try {
    const snapshots = await Promise.all(
      missing.map((keyword) =>
        fetchSearchSnapshot(keyword, maxVideos, {
          quotaUser: options?.quotaUser,
        })
      )
    );

    const allIds = Array.from(
      new Set(snapshots.flatMap((snapshot) => snapshot.ids))
    );
    const videoMap = await fetchVideosByIds(allIds, {
      quotaUser: options?.quotaUser,
    });
    const channelIds = Array.from(
      new Set(Array.from(videoMap.values()).map((video) => video.channelId))
    );
    const channelStatsMap = await fetchChannelStats(channelIds, {
      quotaUser: options?.quotaUser,
    });

    for (const video of videoMap.values()) {
      const stats = channelStatsMap[video.channelId];
      if (stats) {
        video.channelSubscriberCount = stats.subscriberCount;
      }
    }

    for (const snapshot of snapshots) {
      // Preserve per-keyword ordering from search results; batching only reduces request count.
      const ordered = snapshot.ids
        .map((id) => videoMap.get(id))
        .filter((video): video is YouTubeVideo => Boolean(video));

      const serpResult: YouTubeSerp = {
        keyword: snapshot.keyword,
        totalResults: snapshot.totalResults,
        videos: ordered,
      };

      const cacheKey = getSerpCacheKey(snapshot.keyword, maxVideos);
      await setCachedValue(
        cacheKey,
        serpResult,
        youtubeSerpCache,
        6 * 60 * 60 * 1000
      );
      results.set(snapshot.keyword, serpResult);
    }

    return results;
  } catch (error) {
    if (options?.allowStaleOnRateLimit && isYouTubeRateLimitError(error)) {
      if (missing.every((keyword) => staleCandidates.has(keyword))) {
        for (const keyword of missing) {
          const stale = staleCandidates.get(keyword);
          if (stale) {
            results.set(keyword, stale);
          }
        }
        options.onStale?.();
        return results;
      }
    }
    throw error;
  }
}

export async function getYouTubeVideos(
  keyword: string,
  maxVideos: number,
  options?: {
    quotaUser?: string;
    allowStaleOnRateLimit?: boolean;
    onStale?: () => void;
  }
) {
  const serp = await getYouTubeSerp(keyword, maxVideos, options);
  return serp.videos;
}

export async function resolveChannel(
  input: string,
  options?: { quotaUser?: string }
) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const resolveKey = `yt:resolve:${trimmed.toLowerCase()}`;
  const cached = await getCachedValue(
    resolveKey,
    youtubeChannelResolveCache,
    12 * 60 * 60 * 1000
  );
  if (cached !== undefined) return cached;

  if (/^UC[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  const handleMatch = trimmed.match(/@([a-zA-Z0-9._-]+)/);
  const handle = handleMatch?.[1];
  if (handle) {
    const channelsUrl = new URL(CHANNELS_ENDPOINT);
    channelsUrl.searchParams.set("part", "snippet");
    channelsUrl.searchParams.set("forHandle", handle);
    channelsUrl.searchParams.set("fields", "items(id)");

    const data = await youtubeFetchJson<unknown>(channelsUrl.toString(), {
      quotaUser: options?.quotaUser,
    });
    const parsed = channelsSchema.safeParse(data);
    const channelId = parsed.success ? parsed.data.items?.[0]?.id : null;
    if (channelId) {
      await setCachedValue(
        resolveKey,
        channelId,
        youtubeChannelResolveCache,
        12 * 60 * 60 * 1000
      );
      return channelId;
    }
  }

  const searchUrl = new URL(SEARCH_ENDPOINT);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "channel");
  searchUrl.searchParams.set("q", trimmed);
  searchUrl.searchParams.set("maxResults", "1");
  searchUrl.searchParams.set("fields", "items(id(channelId))");

  const searchData = await youtubeFetchJson<unknown>(searchUrl.toString(), {
    quotaUser: options?.quotaUser,
  });
  const searchParsed = searchSchema.safeParse(searchData);
  const channelId =
    searchParsed.success ? searchParsed.data.items?.[0]?.id?.channelId : null;

  if (channelId) {
    await setCachedValue(
      resolveKey,
      channelId,
      youtubeChannelResolveCache,
      12 * 60 * 60 * 1000
    );
  }

  return channelId ?? null;
}

async function getRecentChannelMetrics(
  channelId: string,
  count = 10,
  options?: { quotaUser?: string; uploadsPlaylistId?: string }
) {
  const cached = await getCachedValue(
    `yt:channel:recent:${channelId}:${count}`,
    youtubeChannelRecentCache,
    6 * 60 * 60 * 1000
  );
  if (cached !== undefined) return cached;

  const uploadsPlaylistId =
    options?.uploadsPlaylistId ??
    (await fetchChannelUploadsDetails(channelId, {
      quotaUser: options?.quotaUser,
    })).uploadsPlaylistId;

  if (!uploadsPlaylistId) {
    const empty = { avgViews: 0, avgViewsPerDay: 0 };
    await setCachedValue(
      `yt:channel:recent:${channelId}:${count}`,
      empty,
      youtubeChannelRecentCache,
      6 * 60 * 60 * 1000
    );
    return empty;
  }

  const videoIds: string[] = [];
  let pageToken: string | undefined;
  const maxPages = 3;

  // The uploads playlist preserves chronological order without changing scoring inputs.
  for (let page = 0; page < maxPages && videoIds.length < count; page += 1) {
    const playlistUrl = new URL(
      "https://www.googleapis.com/youtube/v3/playlistItems"
    );
    playlistUrl.searchParams.set("part", "contentDetails");
    playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
    playlistUrl.searchParams.set("maxResults", "50");
    playlistUrl.searchParams.set(
      "fields",
      "items(contentDetails(videoId)),nextPageToken"
    );
    if (pageToken) {
      playlistUrl.searchParams.set("pageToken", pageToken);
    }

    const playlistData = await youtubeFetchJson<unknown>(playlistUrl.toString(), {
      quotaUser: options?.quotaUser,
    });
    const playlistParsed = playlistItemsSchema.safeParse(playlistData);
    if (!playlistParsed.success) {
      throw new Error("Unexpected YouTube playlist response.");
    }

    const ids = (playlistParsed.data.items ?? [])
      .map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));
    videoIds.push(...ids);
    pageToken = playlistParsed.data.nextPageToken;
    if (!pageToken) break;
  }

  if (videoIds.length === 0) {
    const empty = { avgViews: 0, avgViewsPerDay: 0 };
    await setCachedValue(
      `yt:channel:recent:${channelId}:${count}`,
      empty,
      youtubeChannelRecentCache,
      6 * 60 * 60 * 1000
    );
    return empty;
  }

  const orderedIds = Array.from(new Set(videoIds));
  const videosMap = await fetchVideosByIds(orderedIds, {
    quotaUser: options?.quotaUser,
  });

  const orderedVideos = orderedIds
    .map((id) => videosMap.get(id))
    .filter((video): video is YouTubeVideo => Boolean(video))
    .slice(0, count);

  if (orderedVideos.length === 0) {
    const empty = { avgViews: 0, avgViewsPerDay: 0 };
    await setCachedValue(
      `yt:channel:recent:${channelId}:${count}`,
      empty,
      youtubeChannelRecentCache,
      6 * 60 * 60 * 1000
    );
    return empty;
  }

  const nowMs = Date.now();
  const views: number[] = [];
  const viewsPerDay: number[] = [];

  for (const video of orderedVideos) {
    const publishedAt = Date.parse(video.publishedAt);
    const ageDays = Math.max(1, Math.floor((nowMs - publishedAt) / 86400000));
    views.push(video.viewCount);
    viewsPerDay.push(video.viewCount / ageDays);
  }

  const avgViews =
    views.reduce((sum, value) => sum + value, 0) / Math.max(1, views.length);
  const avgViewsPerDay =
    viewsPerDay.reduce((sum, value) => sum + value, 0) /
    Math.max(1, viewsPerDay.length);

  const metrics = { avgViews, avgViewsPerDay };
  await setCachedValue(
    `yt:channel:recent:${channelId}:${count}`,
    metrics,
    youtubeChannelRecentCache,
    6 * 60 * 60 * 1000
  );

  return metrics;
}

export async function getChannelProfile(
  channelId: string,
  options?: { quotaUser?: string }
): Promise<ChannelProfile> {
  const details = await fetchChannelUploadsDetails(channelId, {
    quotaUser: options?.quotaUser,
  });

  const channelStats = details.stats ?? {
    channelId,
    subscriberCount: 0,
    videoCount: 0,
    viewCount: 0,
  };

  const recentMetrics = await getRecentChannelMetrics(channelId, 10, {
    quotaUser: options?.quotaUser,
    uploadsPlaylistId: details.uploadsPlaylistId,
  });

  return {
    channelId,
    subscriberCount: channelStats.subscriberCount,
    videoCount: channelStats.videoCount,
    viewCount: channelStats.viewCount,
    avgViews: recentMetrics.avgViews,
    avgViewsPerDay: recentMetrics.avgViewsPerDay,
  };
}
