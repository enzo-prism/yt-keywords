import { LRUCache } from "./cache/lru.ts";
import { getCachedValue, setCachedValue } from "./cache/persistent.ts";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const USAGE_TTL_MS = 2 * ONE_DAY_MS;

export type ApiUsageProvider = "youtube" | "keywordtool";

type ProviderUsage = {
  requests: number;
  endpoints: Record<string, number>;
  lastUpdated: number | null;
};

type UsageState = {
  dayKey: string;
  providers: Record<ApiUsageProvider, ProviderUsage>;
};

const usageCache = new LRUCache<string, UsageState>({
  maxSize: 7,
  ttlMs: USAGE_TTL_MS,
});

const PROVIDER_LABELS: Record<ApiUsageProvider, string> = {
  youtube: "YouTube Data API",
  keywordtool: "KeywordTool.io",
};

const YOUTUBE_ENDPOINT_COSTS = {
  search: 100,
  videos: 1,
  channels: 1,
  playlistItems: 1,
  unknown: 1,
} as const;

export type YouTubeEndpoint = keyof typeof YOUTUBE_ENDPOINT_COSTS;

type UsageEndpointSummary = {
  name: string;
  requests: number;
  units: number;
};

export type UsageProviderSummary = {
  id: ApiUsageProvider;
  label: string;
  unitLabel: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number | null;
  requests: number;
  endpoints: UsageEndpointSummary[];
  lastUpdated: string | null;
  note?: string;
};

export type ApiUsageSummary = {
  dayKey: string;
  windowStart: string;
  windowEnd: string;
  providers: UsageProviderSummary[];
};

function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getWindowBounds(dayKey: string) {
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + ONE_DAY_MS);
  return { start, end };
}

function cacheKeyForDay(dayKey: string) {
  return `usage:${dayKey}`;
}

function emptyProviderUsage(): ProviderUsage {
  return { requests: 0, endpoints: {}, lastUpdated: null };
}

async function loadUsageState(dayKey: string): Promise<UsageState> {
  const cacheKey = cacheKeyForDay(dayKey);
  const cached = await getCachedValue(cacheKey, usageCache, USAGE_TTL_MS);
  if (cached) return cached;
  return {
    dayKey,
    providers: {
      youtube: emptyProviderUsage(),
      keywordtool: emptyProviderUsage(),
    },
  };
}

async function saveUsageState(state: UsageState) {
  await setCachedValue(
    cacheKeyForDay(state.dayKey),
    state,
    usageCache,
    USAGE_TTL_MS
  );
}

function parseLimit(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export function getYouTubeEndpointFromUrl(url: string): YouTubeEndpoint {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (path && path in YOUTUBE_ENDPOINT_COSTS) {
      return path as YouTubeEndpoint;
    }
  } catch {
    // Fall through to unknown.
  }
  return "unknown";
}

function getYouTubeEndpointCost(endpoint: string) {
  return (
    YOUTUBE_ENDPOINT_COSTS[endpoint as YouTubeEndpoint] ??
    YOUTUBE_ENDPOINT_COSTS.unknown
  );
}

function computeYouTubeUnits(endpoints: Record<string, number>) {
  return Object.entries(endpoints).reduce((total, [endpoint, count]) => {
    return total + getYouTubeEndpointCost(endpoint) * count;
  }, 0);
}

function computeRemaining(limit: number | null, used: number): number | null {
  if (!limit) return null;
  return Math.max(0, limit - used);
}

function computePercent(limit: number | null, used: number): number | null {
  if (!limit || limit <= 0) return null;
  return Math.min(100, (used / limit) * 100);
}

function buildEndpointsSummary(
  endpoints: Record<string, number>,
  options?: { includeUnits?: boolean }
): UsageEndpointSummary[] {
  return Object.entries(endpoints)
    .map(([endpoint, requests]) => ({
      name: endpoint,
      requests,
      units: options?.includeUnits
        ? getYouTubeEndpointCost(endpoint) * requests
        : requests,
    }))
    .sort((a, b) => b.requests - a.requests);
}

export async function recordApiUsage(args: {
  provider: ApiUsageProvider;
  endpoint: string;
  requests?: number;
}) {
  try {
    const dayKey = getDayKey();
    const state = await loadUsageState(dayKey);
    const entry = state.providers[args.provider] ?? emptyProviderUsage();
    const increment = Math.max(1, Math.floor(args.requests ?? 1));

    entry.requests += increment;
    entry.endpoints[args.endpoint] =
      (entry.endpoints[args.endpoint] ?? 0) + increment;
    entry.lastUpdated = Date.now();
    state.providers[args.provider] = entry;

    await saveUsageState(state);
  } catch {
    // Ignore usage tracking errors.
  }
}

export async function getApiUsageSummary(): Promise<ApiUsageSummary> {
  const dayKey = getDayKey();
  const { start, end } = getWindowBounds(dayKey);
  const state = await loadUsageState(dayKey);
  const youtubeUsage = state.providers.youtube ?? emptyProviderUsage();
  const keywordUsage = state.providers.keywordtool ?? emptyProviderUsage();

  const youtubeUsed = computeYouTubeUnits(youtubeUsage.endpoints);
  const youtubeLimit = parseLimit(process.env.YOUTUBE_DAILY_QUOTA);
  const keywordLimit = parseLimit(process.env.KEYWORDTOOL_DAILY_LIMIT);

  const youtubeSummary: UsageProviderSummary = {
    id: "youtube",
    label: PROVIDER_LABELS.youtube,
    unitLabel: "quota units",
    used: youtubeUsed,
    limit: youtubeLimit,
    remaining: computeRemaining(youtubeLimit, youtubeUsed),
    percent: computePercent(youtubeLimit, youtubeUsed),
    requests: youtubeUsage.requests,
    endpoints: buildEndpointsSummary(youtubeUsage.endpoints, {
      includeUnits: true,
    }),
    lastUpdated: youtubeUsage.lastUpdated
      ? new Date(youtubeUsage.lastUpdated).toISOString()
      : null,
    note:
      "Quota units are estimated (search=100, videos/channels/playlistItems=1).",
  };

  const keywordUsed = keywordUsage.requests;
  const keywordSummary: UsageProviderSummary = {
    id: "keywordtool",
    label: PROVIDER_LABELS.keywordtool,
    unitLabel: "requests",
    used: keywordUsed,
    limit: keywordLimit,
    remaining: computeRemaining(keywordLimit, keywordUsed),
    percent: computePercent(keywordLimit, keywordUsed),
    requests: keywordUsage.requests,
    endpoints: buildEndpointsSummary(keywordUsage.endpoints),
    lastUpdated: keywordUsage.lastUpdated
      ? new Date(keywordUsage.lastUpdated).toISOString()
      : null,
  };

  return {
    dayKey,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    providers: [youtubeSummary, keywordSummary],
  };
}
