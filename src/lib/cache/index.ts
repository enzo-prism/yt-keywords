import { LRUCache } from "./lru.ts";
import type { YouTubeVideo } from "../types.ts";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const keywordSuggestionsCache = new LRUCache<string, string[]>({
  maxSize: 200,
  ttlMs: 24 * ONE_HOUR_MS,
});

export const keywordVolumeCache = new LRUCache<string, Record<string, number>>({
  maxSize: 200,
  ttlMs: 24 * ONE_HOUR_MS,
});

export const youtubeCache = new LRUCache<string, YouTubeVideo[]>({
  maxSize: 200,
  ttlMs: 12 * ONE_HOUR_MS,
});
