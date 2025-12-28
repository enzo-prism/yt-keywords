import pLimit from "p-limit";

import { getYouTubeEndpointFromUrl, recordApiUsage } from "./api-usage.ts";
import { getEnv } from "./env.ts";

const YOUTUBE_CONCURRENCY = 4;
const MIN_INTERVAL_MS = 120;
const MAX_RETRIES = 2;

const limiter = pLimit(YOUTUBE_CONCURRENCY);
const inflight = new Map<string, Promise<unknown>>();
let lastRequestAt = 0;

type ErrorReason =
  | "quotaExceeded"
  | "dailyLimitExceeded"
  | "rateLimitExceeded"
  | "userRateLimitExceeded"
  | "accessNotConfigured"
  | "keyInvalid"
  | "invalidKey"
  | "forbidden"
  | string;

export class YouTubeApiError extends Error {
  status: number;
  reason?: ErrorReason;
  isRateLimit: boolean;
  isQuotaExceeded: boolean;
  isAuthError: boolean;

  constructor(
    message: string,
    status: number,
    reason?: ErrorReason,
    isRateLimit = false,
    isQuotaExceeded = false,
    isAuthError = false
  ) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
    this.reason = reason;
    this.isRateLimit = isRateLimit;
    this.isQuotaExceeded = isQuotaExceeded;
    this.isAuthError = isAuthError;
  }
}

type YouTubeErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: ErrorReason; message?: string }>;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSignature(method: string, url: string) {
  const parsed = new URL(url);
  const entries = Array.from(parsed.searchParams.entries());
  entries.sort((a, b) => {
    if (a[0] === b[0]) return a[1].localeCompare(b[1]);
    return a[0].localeCompare(b[0]);
  });
  const query = entries.map(([key, value]) => `${key}=${value}`).join("&");
  return `${method.toUpperCase()} ${parsed.origin}${parsed.pathname}?${query}`;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

function parseYouTubeError(
  status: number,
  payload: unknown,
  fallback: string
) {
  const parsed = payload as YouTubeErrorPayload | null;
  const reason = parsed?.error?.errors?.[0]?.reason;
  const message =
    parsed?.error?.message ??
    parsed?.error?.errors?.[0]?.message ??
    fallback;

  const isQuotaExceeded =
    reason === "quotaExceeded" || reason === "dailyLimitExceeded";
  const isRateLimit =
    status === 429 ||
    reason === "rateLimitExceeded" ||
    reason === "userRateLimitExceeded" ||
    isQuotaExceeded;
  const isAuthError =
    reason === "accessNotConfigured" ||
    reason === "keyInvalid" ||
    reason === "invalidKey" ||
    reason === "forbidden";

  return { reason, message, isRateLimit, isQuotaExceeded, isAuthError };
}

function shouldRetry(error: YouTubeApiError) {
  if (error.isQuotaExceeded || error.isAuthError) return false;
  if (error.status === 429) return true;
  if (error.status >= 500 && error.status < 600) return true;
  if (error.isRateLimit) return true;
  return false;
}

async function withGlobalLimit<T>(fn: () => Promise<T>) {
  return limiter(async () => {
    const now = Date.now();
    const waitFor = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
    if (waitFor > 0) {
      await sleep(waitFor);
    }
    lastRequestAt = Date.now();
    return fn();
  });
}

export function isYouTubeRateLimitError(error: unknown): boolean {
  if (error instanceof YouTubeApiError) {
    return error.isRateLimit || error.isQuotaExceeded;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("rate limit") ||
      message.includes("quota") ||
      message.includes("userRateLimitExceeded".toLowerCase())
    );
  }
  return false;
}

export async function youtubeFetchJson<T>(
  url: string,
  options?: {
    quotaUser?: string;
    retries?: number;
  }
): Promise<T> {
  const signature = buildSignature("GET", url);
  const inflightExisting = inflight.get(signature) as Promise<T> | undefined;
  if (inflightExisting) return inflightExisting;

  const task = withGlobalLimit(async () => {
    const env = getEnv();
    const retries = options?.retries ?? MAX_RETRIES;
    let attempt = 0;

    while (attempt <= retries) {
      const response = await fetch(url, {
        headers: {
          "X-Goog-Api-Key": env.YOUTUBE_API_KEY,
          ...(options?.quotaUser
            ? { "X-Goog-Quota-User": options.quotaUser }
            : {}),
        },
      });

      if (response.ok) {
        const endpoint = getYouTubeEndpointFromUrl(url);
        void recordApiUsage({ provider: "youtube", endpoint });
        return (await response.json()) as T;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      let body: unknown = null;
      let fallbackText = "";

      try {
        body = await response.json();
      } catch {
        try {
          fallbackText = await response.text();
        } catch {
          fallbackText = "";
        }
      }

      const parsed = parseYouTubeError(
        response.status,
        body,
        fallbackText || "YouTube API request failed."
      );
      const apiError = new YouTubeApiError(
        parsed.message,
        response.status,
        parsed.reason,
        parsed.isRateLimit,
        parsed.isQuotaExceeded,
        parsed.isAuthError
      );

      if (attempt >= retries || !shouldRetry(apiError)) {
        const endpoint = getYouTubeEndpointFromUrl(url);
        void recordApiUsage({ provider: "youtube", endpoint });
        throw apiError;
      }

      const baseDelay = 500 * Math.pow(2, attempt);
      const jitter = Math.round(Math.random() * 200);
      const delayMs = Math.min(4000, retryAfterMs ?? baseDelay + jitter);
      await sleep(delayMs);
      attempt += 1;
    }

    throw new YouTubeApiError("YouTube API request failed.", 500);
  });

  inflight.set(signature, task);
  try {
    return await task;
  } finally {
    inflight.delete(signature);
  }
}
