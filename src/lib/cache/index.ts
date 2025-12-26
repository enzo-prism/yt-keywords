import { LRUCache } from "./lru.ts";
import type { YouTubeChannelStats, YouTubeSerp } from "../types.ts";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const keywordSuggestionsCache = new LRUCache<string, string[]>({
  maxSize: 200,
  ttlMs: 24 * ONE_HOUR_MS,
});

export const keywordVolumeCache = new LRUCache<
  string,
  Record<string, { volume: number; monthlyVolumes: number[] | null }>
>({
  maxSize: 200,
  ttlMs: 24 * ONE_HOUR_MS,
});

export const youtubeSerpCache = new LRUCache<string, YouTubeSerp>({
  maxSize: 200,
  ttlMs: 6 * ONE_HOUR_MS,
});

export const youtubeChannelStatsCache = new LRUCache<string, YouTubeChannelStats>({
  maxSize: 300,
  ttlMs: 12 * ONE_HOUR_MS,
});

export const youtubeChannelRecentCache = new LRUCache<
  string,
  { avgViews: number; avgViewsPerDay: number }
>({
  maxSize: 300,
  ttlMs: 6 * ONE_HOUR_MS,
});

export const youtubeChannelResolveCache = new LRUCache<string, string>({
  maxSize: 300,
  ttlMs: 12 * ONE_HOUR_MS,
});
