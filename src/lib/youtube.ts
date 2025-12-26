import { z } from "zod";

import {
  youtubeChannelRecentCache,
  youtubeChannelResolveCache,
  youtubeChannelStatsCache,
  youtubeSerpCache,
} from "./cache/index.ts";
import { getCachedValue, setCachedValue } from "./cache/persistent.ts";
import { getEnv } from "./env.ts";
import { fetchJson } from "./http.ts";
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
                thumbnails: z
                  .record(
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
          })
          .passthrough()
      )
      .optional(),
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

function getThumbnailUrl(thumbnails: Record<string, { url?: string }> | undefined) {
  if (!thumbnails) return "";
  return (
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    ""
  );
}

async function fetchChannelStats(channelIds: string[]) {
  const env = getEnv();
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

    const data = await fetchJson<unknown>(
      channelsUrl.toString(),
      {
        headers: {
          "X-Goog-Api-Key": env.YOUTUBE_API_KEY,
        },
      },
      { timeoutMs: 12000, retry: 1 }
    );
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

export async function getYouTubeSerp(
  keyword: string,
  maxVideos: number
): Promise<YouTubeSerp> {
  const normalizedKeyword = keyword.trim();
  const cacheKey = `yt:serp:${normalizedKeyword.toLowerCase()}::${maxVideos}`;
  const cached = await getCachedValue(cacheKey, youtubeSerpCache, 6 * 60 * 60 * 1000);
  if (cached !== undefined) return cached;

  const env = getEnv();

  const searchUrl = new URL(SEARCH_ENDPOINT);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("q", normalizedKeyword);
  searchUrl.searchParams.set("order", "relevance");
  searchUrl.searchParams.set("maxResults", String(maxVideos));

  const searchData = await fetchJson<unknown>(
    searchUrl.toString(),
    {
      headers: {
        "X-Goog-Api-Key": env.YOUTUBE_API_KEY,
      },
    },
    { timeoutMs: 12000, retry: 1 }
  );
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

  if (ids.length === 0) {
    const empty = { keyword: normalizedKeyword, totalResults, videos: [] };
    await setCachedValue(cacheKey, empty, youtubeSerpCache, 6 * 60 * 60 * 1000);
    return empty;
  }

  const videosUrl = new URL(VIDEOS_ENDPOINT);
  videosUrl.searchParams.set("part", "snippet,statistics,contentDetails");
  videosUrl.searchParams.set("id", ids.join(","));

  const videosData = await fetchJson<unknown>(
    videosUrl.toString(),
    {
      headers: {
        "X-Goog-Api-Key": env.YOUTUBE_API_KEY,
      },
    },
    { timeoutMs: 12000, retry: 1 }
  );
  const videosParsed = videosSchema.safeParse(videosData);

  if (!videosParsed.success) {
    throw new Error("Unexpected YouTube videos response.");
  }

  const channelIds = new Set<string>();
  const videoMap = new Map<string, YouTubeVideo>();

  for (const item of videosParsed.data.items ?? []) {
    channelIds.add(item.snippet.channelId);
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

  const channelStatsMap = await fetchChannelStats(Array.from(channelIds));

  for (const video of videoMap.values()) {
    const stats = channelStatsMap[video.channelId];
    if (stats) {
      video.channelSubscriberCount = stats.subscriberCount;
    }
  }

  const ordered = ids
    .map((id) => videoMap.get(id))
    .filter((video): video is YouTubeVideo => Boolean(video));

  const serpResult: YouTubeSerp = {
    keyword: normalizedKeyword,
    totalResults,
    videos: ordered,
  };

  await setCachedValue(cacheKey, serpResult, youtubeSerpCache, 6 * 60 * 60 * 1000);
  return serpResult;
}

export async function getYouTubeVideos(keyword: string, maxVideos: number) {
  const serp = await getYouTubeSerp(keyword, maxVideos);
  return serp.videos;
}

export async function resolveChannel(input: string) {
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
  const env = getEnv();

  if (handle) {
    const channelsUrl = new URL(CHANNELS_ENDPOINT);
    channelsUrl.searchParams.set("part", "snippet");
    channelsUrl.searchParams.set("forHandle", handle);

    const data = await fetchJson<unknown>(
      channelsUrl.toString(),
      {
        headers: {
          "X-Goog-Api-Key": env.YOUTUBE_API_KEY,
        },
      },
      { timeoutMs: 12000, retry: 1 }
    );
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

  const searchData = await fetchJson<unknown>(
    searchUrl.toString(),
    {
      headers: {
        "X-Goog-Api-Key": env.YOUTUBE_API_KEY,
      },
    },
    { timeoutMs: 12000, retry: 1 }
  );
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

async function getRecentChannelMetrics(channelId: string, count = 10) {
  const cached = await getCachedValue(
    `yt:channel:recent:${channelId}:${count}`,
    youtubeChannelRecentCache,
    6 * 60 * 60 * 1000
  );
  if (cached !== undefined) return cached;

  const env = getEnv();
  const searchUrl = new URL(SEARCH_ENDPOINT);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("channelId", channelId);
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(count));

  const searchData = await fetchJson<unknown>(
    searchUrl.toString(),
    {
      headers: {
        "X-Goog-Api-Key": env.YOUTUBE_API_KEY,
      },
    },
    { timeoutMs: 12000, retry: 1 }
  );
  const searchParsed = searchSchema.safeParse(searchData);
  if (!searchParsed.success) {
    throw new Error("Unexpected YouTube channel search response.");
  }

  const ids = (searchParsed.data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    const empty = { avgViews: 0, avgViewsPerDay: 0 };
    await setCachedValue(
      `yt:channel:recent:${channelId}:${count}`,
      empty,
      youtubeChannelRecentCache,
      6 * 60 * 60 * 1000
    );
    return empty;
  }

  const videosUrl = new URL(VIDEOS_ENDPOINT);
  videosUrl.searchParams.set("part", "statistics,snippet");
  videosUrl.searchParams.set("id", ids.join(","));

  const videosData = await fetchJson<unknown>(
    videosUrl.toString(),
    {
      headers: {
        "X-Goog-Api-Key": env.YOUTUBE_API_KEY,
      },
    },
    { timeoutMs: 12000, retry: 1 }
  );
  const videosParsed = videosSchema.safeParse(videosData);
  if (!videosParsed.success) {
    throw new Error("Unexpected YouTube channel videos response.");
  }

  const nowMs = Date.now();
  const views: number[] = [];
  const viewsPerDay: number[] = [];

  for (const item of videosParsed.data.items ?? []) {
    const viewCount = parseNumber(item.statistics?.viewCount);
    const publishedAt = Date.parse(item.snippet.publishedAt);
    const ageDays = Math.max(1, Math.floor((nowMs - publishedAt) / 86400000));
    views.push(viewCount);
    viewsPerDay.push(viewCount / ageDays);
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

export async function getChannelProfile(channelId: string): Promise<ChannelProfile> {
  const stats = await fetchChannelStats([channelId]);
  const channelStats = stats[channelId] ?? {
    channelId,
    subscriberCount: 0,
    videoCount: 0,
    viewCount: 0,
  };

  const recentMetrics = await getRecentChannelMetrics(channelId);

  return {
    channelId,
    subscriberCount: channelStats.subscriberCount,
    videoCount: channelStats.videoCount,
    viewCount: channelStats.viewCount,
    avgViews: recentMetrics.avgViews,
    avgViewsPerDay: recentMetrics.avgViewsPerDay,
  };
}
