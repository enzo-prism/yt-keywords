import { z } from "zod";

import { keywordCache } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import type { KeywordIdea } from "@/lib/types";

const KEYWORDTOOL_ENDPOINT =
  "https://api.keywordtool.io/v2/search/suggestions/youtube";

const entrySchema = z
  .object({
    keyword: z.string(),
    volume: z.union([z.number(), z.string()]).optional(),
    search_volume: z.union([z.number(), z.string()]).optional(),
    searches: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

const responseSchema = z
  .object({
    results: z.array(entrySchema).optional(),
    keywords: z.array(entrySchema).optional(),
    data: z.array(entrySchema).optional(),
    error: z.unknown().optional(),
    errors: z.unknown().optional(),
  })
  .passthrough();

function normalizeVolume(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function getKeywordIdeas(
  seed: string,
  limit: number
): Promise<KeywordIdea[]> {
  const normalizedSeed = seed.trim();
  const cacheKey = `${normalizedSeed.toLowerCase()}::${limit}`;
  const cached = keywordCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.KEYWORDTOOL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing KEYWORDTOOL_API_KEY env var.");
  }

  const url = new URL(KEYWORDTOOL_ENDPOINT);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("keyword", normalizedSeed);
  url.searchParams.set("metrics", "true");
  url.searchParams.set("country", "us");
  url.searchParams.set("language", "en");

  const data = await fetchJson<unknown>(url.toString(), undefined, {
    timeoutMs: 12000,
    retry: 1,
  });
  const parsed = responseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("Unexpected KeywordTool response.");
  }

  if (parsed.data.error || parsed.data.errors) {
    throw new Error("KeywordTool error response.");
  }

  const rawItems =
    parsed.data.results ?? parsed.data.keywords ?? parsed.data.data ?? [];

  const ideas = rawItems
    .map((item) => ({
      keyword: item.keyword.trim(),
      volume: normalizeVolume(
        item.search_volume ?? item.volume ?? item.searches ?? 0
      ),
    }))
    .filter((item) => item.keyword.length > 0)
    .slice(0, limit);

  keywordCache.set(cacheKey, ideas);
  return ideas;
}
