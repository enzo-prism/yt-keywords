import { kv } from "@vercel/kv";

import { getEnvStatus } from "../env.ts";
import { LRUCache } from "./lru.ts";

const KV_PREFIX = "gapscope:";

function isKvConfigured() {
  return getEnvStatus().kvConfigured;
}

export async function getCachedValue<T>(
  key: string,
  cache: LRUCache<string, T>,
  ttlMs?: number
): Promise<T | undefined> {
  const local = cache.get(key);
  if (local !== undefined) return local;

  if (!isKvConfigured()) return undefined;

  try {
    const value = await kv.get<T>(`${KV_PREFIX}${key}`);
    if (value !== null && value !== undefined) {
      cache.set(key, value, ttlMs);
      return value;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function setCachedValue<T>(
  key: string,
  value: T,
  cache: LRUCache<string, T>,
  ttlMs: number
) {
  cache.set(key, value, ttlMs);

  if (!isKvConfigured()) return;

  try {
    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    await kv.set(`${KV_PREFIX}${key}`, value, { ex: ttlSeconds });
  } catch {
    // Ignore KV write errors and rely on in-memory cache.
  }
}
