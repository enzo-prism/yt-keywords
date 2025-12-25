import { z } from "zod";

import { youtubeCache } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import type { YouTubeVideo } from "@/lib/types";

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";

const searchSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.object({
              videoId: z.string().optional(),
            }),
          })
          .passthrough()
      )
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
              })
              .passthrough(),
            statistics: z
              .object({
                viewCount: z.string().optional(),
              })
              .optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export async function getYouTubeVideos(
  keyword: string,
  maxVideos: number
): Promise<YouTubeVideo[]> {
  const normalizedKeyword = keyword.trim();
  const cacheKey = `${normalizedKeyword.toLowerCase()}::${maxVideos}`;
  const cached = youtubeCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing YOUTUBE_API_KEY env var.");
  }

  const searchUrl = new URL(SEARCH_ENDPOINT);
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "id");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("q", normalizedKeyword);
  searchUrl.searchParams.set("order", "relevance");
  searchUrl.searchParams.set("maxResults", String(maxVideos));

  const searchData = await fetchJson<unknown>(searchUrl.toString(), undefined, {
    timeoutMs: 12000,
    retry: 1,
  });
  const searchParsed = searchSchema.safeParse(searchData);

  if (!searchParsed.success) {
    throw new Error("Unexpected YouTube search response.");
  }

  const ids = (searchParsed.data.items ?? [])
    .map((item) => item.id.videoId)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    youtubeCache.set(cacheKey, []);
    return [];
  }

  const videosUrl = new URL(VIDEOS_ENDPOINT);
  videosUrl.searchParams.set("key", apiKey);
  videosUrl.searchParams.set("part", "snippet,statistics");
  videosUrl.searchParams.set("id", ids.join(","));

  const videosData = await fetchJson<unknown>(videosUrl.toString(), undefined, {
    timeoutMs: 12000,
    retry: 1,
  });
  const videosParsed = videosSchema.safeParse(videosData);

  if (!videosParsed.success) {
    throw new Error("Unexpected YouTube videos response.");
  }

  const videoMap = new Map<string, YouTubeVideo>();

  for (const item of videosParsed.data.items ?? []) {
    const rawViewCount = Number(item.statistics?.viewCount ?? 0);
    const viewCount = Number.isFinite(rawViewCount) ? rawViewCount : 0;
    videoMap.set(item.id, {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description ?? "",
      tags: item.snippet.tags ?? [],
      publishedAt: item.snippet.publishedAt,
      viewCount,
      url: `https://www.youtube.com/watch?v=${item.id}`,
    });
  }

  const ordered = ids
    .map((id) => videoMap.get(id))
    .filter((video): video is YouTubeVideo => Boolean(video));

  youtubeCache.set(cacheKey, ordered);
  return ordered;
}
