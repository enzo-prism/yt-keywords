import { fitScore } from "@/lib/scoring/fit";
import { tokenize } from "@/lib/scoring/tokenize";
import type { OpportunityResult, ScoredVideo, YouTubeVideo } from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function logNorm(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  const numerator = Math.log(1 + value) - Math.log(1 + min);
  const denominator = Math.log(1 + max) - Math.log(1 + min);
  return clamp(numerator / denominator, 0, 1);
}

export function normalizeTo01(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max <= min) return values.map(() => 0.5);
  return values.map((value) => clamp((value - min) / (max - min), 0, 1));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function getAgeDays(publishedAt: string, now: number): number {
  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((now - timestamp) / (1000 * 60 * 60 * 24)));
}

function fitLabel(fit: number): "Perfect" | "Close" | "Off" {
  if (fit >= 0.8) return "Perfect";
  if (fit >= 0.6) return "Close";
  return "Off";
}

export function scoreOpportunity(input: {
  keyword: string;
  volume: number;
  videos: YouTubeVideo[];
  minVolume: number;
  maxVolume: number;
  now?: Date;
}): OpportunityResult {
  const nowMs = (input.now ?? new Date()).getTime();
  const keywordTokens = tokenize(input.keyword);

  const scoredVideos: ScoredVideo[] = input.videos.map((video) => {
    const titleTokens = tokenize(video.title);
    const descTokens = tokenize(video.description);
    const tagTokens = tokenize(video.tags.join(" "));
    const fit = fitScore(keywordTokens, titleTokens, descTokens, tagTokens);
    const ageDays = getAgeDays(video.publishedAt, nowMs);

    return {
      ...video,
      fit,
      fitLabel: fitLabel(fit),
      ageDays,
    };
  });

  const topFive = scoredVideos.slice(0, 5);
  const topTen = scoredVideos.slice(0, 10);
  const avgTopFit = average(topFive.map((video) => video.fit));
  const weakCount = topTen.filter((video) => video.fit < 0.5).length;
  const weakFitRate = weakCount / 10;

  const strongMatches = topTen.filter((video) => video.fit >= 0.7);
  let noStrongMatch = false;
  let bestGoodFitAgeDays = 0;

  if (strongMatches.length > 0) {
    bestGoodFitAgeDays = Math.min(
      ...strongMatches.map((video) => video.ageDays)
    );
  } else {
    noStrongMatch = true;
    bestGoodFitAgeDays = median(topTen.map((video) => video.ageDays));
  }

  const freshnessBonus = clamp(bestGoodFitAgeDays / 365, 0, 2);

  const viewCounts = topTen.map((video) => video.viewCount);
  const minViews = viewCounts.length ? Math.min(...viewCounts) : 0;
  const maxViews = viewCounts.length ? Math.max(...viewCounts) : 0;
  const mismatchRaw = topTen.reduce((sum, video) => {
    const viewCountNormalized = logNorm(video.viewCount, minViews, maxViews);
    return sum + viewCountNormalized * (1 - video.fit);
  }, 0);

  const volumeScore = logNorm(input.volume, input.minVolume, input.maxVolume);
  const mismatchBonus = clamp(mismatchRaw, 0, 1);

  const score01 =
    0.45 * volumeScore +
    0.25 * (1 - avgTopFit) +
    0.2 * (freshnessBonus / 2) +
    0.1 * mismatchBonus;

  const coverageLabel: OpportunityResult["coverageLabel"] =
    avgTopFit >= 0.75 ? "Strong" : avgTopFit >= 0.55 ? "Medium" : "Weak";

  const freshnessLabel: OpportunityResult["freshnessLabel"] =
    bestGoodFitAgeDays < 90
      ? "Fresh"
      : bestGoodFitAgeDays < 365
      ? "Aging"
      : "Stale";

  const bullets: string[] = [
    `High demand: ~${Math.round(input.volume)} searches`,
    `Weak coverage: avg fit ${avgTopFit.toFixed(2)}`,
    noStrongMatch
      ? "No strong matches in top results"
      : `Best strong match is ${Math.round(bestGoodFitAgeDays)} days old`,
  ];

  if (mismatchBonus >= 0.5) {
    bullets.push("High mismatch: popular videos don't precisely match the keyword");
  } else {
    bullets.push("Mismatch signal: alignment is mixed among popular videos");
  }

  return {
    keyword: input.keyword,
    volume: input.volume,
    score: Math.round(clamp(score01, 0, 1) * 100),
    volumeScore,
    avgTopFit,
    weakFitRate,
    bestGoodFitAgeDays,
    noStrongMatch,
    freshnessLabel,
    coverageLabel,
    bullets,
    topVideos: scoredVideos,
  };
}
