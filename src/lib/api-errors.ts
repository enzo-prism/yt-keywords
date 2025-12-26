import { YouTubeApiError } from "./youtube-request.ts";

export type ExternalProvider = "google" | "keyword tool";

type ExternalApiError = {
  message: string;
  status: number;
  isRateLimit: boolean;
};

function detectRateLimit(message: string, error?: unknown): boolean {
  if (error instanceof YouTubeApiError) {
    return error.isRateLimit;
  }
  const lower = message.toLowerCase();
  const statusMatch = message.match(/\((\d{3})\)/);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  const rateLimitText =
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("limit exceeded") ||
    lower.includes("exceeded your");

  return status === 429 || rateLimitText;
}

export function formatExternalApiError(
  error: unknown,
  provider: ExternalProvider
): ExternalApiError {
  const message = error instanceof Error ? error.message : "";

  if (provider === "keyword tool" && message.toLowerCase().includes("disabled")) {
    return {
      message: "Google Trends suggestions are disabled.",
      status: 400,
      isRateLimit: false,
    };
  }

  if (detectRateLimit(message, error)) {
    return {
      message: `API rate limit exceeded (${provider})`,
      status: 429,
      isRateLimit: true,
    };
  }

  return {
    message:
      provider === "google"
        ? "YouTube API request failed."
        : "KeywordTool API request failed.",
    status: 500,
    isRateLimit: false,
  };
}
