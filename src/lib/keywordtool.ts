import { createHash } from "node:crypto";

import {
  keywordSuggestionsCache,
  keywordVolumeCache,
} from "./cache/index.ts";
import { getCachedValue, setCachedValue } from "./cache/persistent.ts";
import { getEnv, getEnvStatus } from "./env.ts";
import { fetchJson } from "./http.ts";
import { recordApiUsage } from "./api-usage.ts";
import type { KeywordIdea } from "./types.ts";

const SUGGESTIONS_ENDPOINT =
  "https://api.keywordtool.io/v2/search/suggestions/youtube";
const VOLUME_ENDPOINT = "https://api.keywordtool.io/v2/search/volume/youtube";
const TRENDS_SUGGESTIONS_ENDPOINT =
  "https://api.keywordtool.io/v2/search/suggestions/google-trends";

const DEFAULT_COUNTRY = "US";
const DEFAULT_LANGUAGE = "en";
const DEFAULT_MODE: SuggestionMode = "suggestions";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export type SuggestionMode =
  | "suggestions"
  | "questions"
  | "prepositions"
  | "trends";

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeKeyword(value: unknown): string | null {
  if (typeof value === "string") {
    const cleaned = value.trim();
    return cleaned ? cleaned : null;
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const candidate =
    record.keyword ?? record.string ?? record.value ?? record.text ?? null;

  if (typeof candidate !== "string") return null;
  const cleaned = candidate.trim();
  return cleaned ? cleaned : null;
}

function normalizeVolume(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function extractKeywordStrings(payload: unknown): string[] {
  if (typeof payload === "string") return [payload];
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractKeywordStrings(item));
  }

  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const collected: string[] = [];
  const direct = normalizeKeyword(record);
  let hasContainer = false;
  if (direct) collected.push(direct);

  for (const key of ["results", "keywords", "data", "suggestions"]) {
    if (record[key]) {
      hasContainer = true;
      collected.push(...extractKeywordStrings(record[key]));
    }
  }

  if (!hasContainer && !direct) {
    for (const key of Object.keys(record)) {
      const cleaned = key.trim();
      if (cleaned) collected.push(cleaned);
    }
  }

  return collected;
}

function extractVolumeItems(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractVolumeItems(item));
  }

  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const items: Array<Record<string, unknown>> = [];

  let hasContainer = false;
  const hasDirect =
    typeof record.string === "string" || typeof record.keyword === "string";

  if (hasDirect) {
    items.push(record);
  }

  for (const key of ["results", "data", "keywords", "volumes"]) {
    if (record[key]) {
      hasContainer = true;
      items.push(...extractVolumeItems(record[key]));
    }
  }

  if (!hasContainer && !hasDirect) {
    for (const value of Object.values(record)) {
      items.push(...extractVolumeItems(value));
    }
  }

  return items;
}

function extractMonthlyVolumes(item: Record<string, unknown>): number[] | null {
  const months: Array<{ year: number; month: number; value: number }> = [];

  for (let i = 1; i <= 12; i += 1) {
    const value = normalizeVolume(item[`m${i}`]);
    const month = Number(item[`m${i}_month`]);
    const year = Number(item[`m${i}_year`]);
    if (!Number.isFinite(month) || !Number.isFinite(year)) continue;
    months.push({ year, month, value });
  }

  if (months.length === 0) return null;

  months.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return months.map((entry) => entry.value);
}

function buildVolumeMap(
  payload: unknown
): Record<string, { volume: number; monthlyVolumes: number[] | null }> {
  const items = extractVolumeItems(payload);
  const map: Record<string, { volume: number; monthlyVolumes: number[] | null }> =
    {};

  for (const item of items) {
    const keyword =
      typeof item.string === "string"
        ? item.string.trim()
        : typeof item.keyword === "string"
        ? item.keyword.trim()
        : "";

    if (!keyword) continue;
    const volume = normalizeVolume(item.volume);
    const monthlyVolumes = extractMonthlyVolumes(item);
    map[normalizeKey(keyword)] = { volume, monthlyVolumes };
  }

  return map;
}

function assertNoKeywordToolErrors(payload: unknown) {
  if (!payload || typeof payload !== "object") return;
  const record = payload as Record<string, unknown>;
  if (record.error || record.errors) {
    throw new Error("KeywordTool error response.");
  }
}

function hashKeywords(keywords: string[]) {
  const normalized = keywords.map((keyword) => normalizeKey(keyword)).join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

async function fetchSuggestions(args: {
  seed: string;
  limit: number;
  country: string;
  language: string;
  mode: SuggestionMode;
}): Promise<string[]> {
  const cacheKey = `${normalizeKey(args.seed)}::${args.country}::${args.language}::${args.mode}::${args.limit}`;
  const cached = await getCachedValue(
    cacheKey,
    keywordSuggestionsCache,
    24 * 60 * 60 * 1000
  );
  if (cached !== undefined) return cached;

  const env = getEnv();
  const endpoint =
    args.mode === "trends"
      ? TRENDS_SUGGESTIONS_ENDPOINT
      : SUGGESTIONS_ENDPOINT;
  const payload = await fetchJson<unknown>(
    endpoint,
    {
      method: "POST",
      body: JSON.stringify({
        apikey: env.KEYWORDTOOL_API_KEY,
        keyword: args.seed,
        country: args.country,
        language: args.language,
        type: args.mode === "trends" ? "suggestions" : args.mode,
        output: "json",
      }),
    },
    { timeoutMs: 12000, retry: 1 }
  );
  void recordApiUsage({
    provider: "keywordtool",
    endpoint: args.mode === "trends" ? "trends" : "suggestions",
  });

  assertNoKeywordToolErrors(payload);
  const suggestions = extractKeywordStrings(payload);
  const unique = new Set<string>();
  const deduped: string[] = [];

  for (const suggestion of suggestions) {
    const cleaned = suggestion.trim();
    if (!cleaned) continue;
    const key = normalizeKey(cleaned);
    if (unique.has(key)) continue;
    unique.add(key);
    deduped.push(cleaned);
  }

  const limited = deduped.slice(0, args.limit);
  await setCachedValue(cacheKey, limited, keywordSuggestionsCache, 24 * 60 * 60 * 1000);
  return limited;
}

async function fetchVolumes(args: {
  keywords: string[];
  country: string;
}): Promise<Record<string, { volume: number; monthlyVolumes: number[] | null }>> {
  const cacheKey = `${hashKeywords(args.keywords)}::${args.country}`;
  const cached = await getCachedValue(
    cacheKey,
    keywordVolumeCache,
    24 * 60 * 60 * 1000
  );
  if (cached !== undefined) return cached;

  const env = getEnv();
  const payload = await fetchJson<unknown>(
    VOLUME_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify({
        apikey: env.KEYWORDTOOL_API_KEY,
        keyword: args.keywords,
        country: args.country,
        output: "json",
      }),
    },
    { timeoutMs: 12000, retry: 1 }
  );
  void recordApiUsage({ provider: "keywordtool", endpoint: "volume" });

  assertNoKeywordToolErrors(payload);
  const volumeMap = buildVolumeMap(payload);
  await setCachedValue(cacheKey, volumeMap, keywordVolumeCache, 24 * 60 * 60 * 1000);
  return volumeMap;
}

export async function getYouTubeKeywordIdeasWithVolume(args: {
  seed: string;
  limit: number;
  country?: string;
  language?: string;
  suggestionMode?: SuggestionMode;
}): Promise<KeywordIdea[]> {
  const seed = args.seed.trim();
  const limit = Math.min(Math.max(args.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const country = (args.country ?? DEFAULT_COUNTRY).toUpperCase();
  const language = (args.language ?? DEFAULT_LANGUAGE).toLowerCase();
  const mode = args.suggestionMode ?? DEFAULT_MODE;

  if (mode === "trends" && !getEnvStatus().trendsEnabled) {
    throw new Error("Google Trends suggestions are disabled.");
  }

  const suggestions = await fetchSuggestions({
    seed,
    limit,
    country,
    language,
    mode,
  });

  const merged: string[] = [];
  const seen = new Set<string>();
  const addKeyword = (keyword: string) => {
    const cleaned = keyword.trim();
    if (!cleaned) return;
    const key = normalizeKey(cleaned);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(cleaned);
  };

  if (seed) addKeyword(seed);
  for (const suggestion of suggestions) addKeyword(suggestion);

  const limited = merged.slice(0, limit);
  const volumeMap = limited.length
    ? await fetchVolumes({ keywords: limited, country })
    : {};

  // Preserve suggestion order (seed first) while attaching volumes.
  return limited.map((keyword) => ({
    keyword,
    volume: volumeMap[normalizeKey(keyword)]?.volume ?? 0,
    monthlyVolumes: volumeMap[normalizeKey(keyword)]?.monthlyVolumes ?? null,
  }));
}
