import { LRUCache } from "@/lib/cache/lru";
import type { KeywordIdea, YouTubeVideo } from "@/lib/types";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const keywordCache = new LRUCache<string, KeywordIdea[]>({
  maxSize: 100,
  ttlMs: 24 * ONE_HOUR_MS,
});

export const youtubeCache = new LRUCache<string, YouTubeVideo[]>({
  maxSize: 200,
  ttlMs: 12 * ONE_HOUR_MS,
});
