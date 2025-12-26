import { normalizeKeyword } from "../keywords/normalize.ts";
import { logNorm } from "./opportunity.ts";
import { fitScore } from "./fit.ts";
import { overlapRatio, tokenize } from "./tokenize.ts";
import type {
  ChannelProfile,
  OpportunityResult,
  ScoredVideo,
  SerpMetrics,
  YouTubeVideo,
} from "../types.ts";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function getAgeDays(publishedAt: string, now: number) {
  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((now - timestamp) / 86400000));
}

function fitLabel(fit: number): "Strong" | "Medium" | "Weak" {
  if (fit >= 0.75) return "Strong";
  if (fit >= 0.55) return "Medium";
  return "Weak";
}

function computeTrendScore(monthlyVolumes?: number[] | null) {
  if (!monthlyVolumes || monthlyVolumes.length < 6) {
    return { score: null as number | null, ratio: null as number | null };
  }

  const recent = monthlyVolumes.slice(-3);
  const previous = monthlyVolumes.slice(-6, -3);
  const recentAvg = average(recent);
  const prevAvg = average(previous);
  if (prevAvg <= 0) {
    return { score: null, ratio: null };
  }

  const ratio = recentAvg / prevAvg;
  const normalized = clamp((ratio - 0.5) / 1.5, 0, 1);
  return { score: Math.round(normalized * 100), ratio };
}

function buildSerpWeaknessSummary(params: {
  exactTitleRate: number;
  exactDescRate: number;
  tagRate: number;
  bestAnswerAgeDays: number;
  noStrongMatch: boolean;
  mismatchHigh: boolean;
}) {
  const bullets: string[] = [];
  if (params.exactTitleRate < 0.4) {
    bullets.push("Few top results use the exact keyword in the title.");
  }
  if (params.exactDescRate < 0.4) {
    bullets.push("Descriptions rarely feature the exact keyword early.");
  }
  if (params.tagRate < 0.2) {
    bullets.push("Tags are weak or missing for the exact phrase.");
  }
  if (params.noStrongMatch) {
    bullets.push("No strong matches in the top results.");
  } else if (params.bestAnswerAgeDays > 180) {
    bullets.push("Best matching video is aging, leaving room for a new entry.");
  }
  if (params.mismatchHigh) {
    bullets.push("Popular videos are only loosely aligned with the keyword.");
  }

  return bullets;
}

function computeChannelPower(profile: ChannelProfile | null | undefined) {
  if (!profile) return null;
  const subsScore = logNorm(profile.subscriberCount, 500, 2_000_000);
  const viewsScore = logNorm(profile.avgViewsPerDay, 50, 50_000);
  return clamp(0.6 * subsScore + 0.4 * viewsScore, 0, 1);
}

function computeSerpPower(medianSubs: number, medianViewsPerDay: number) {
  const subsScore = logNorm(medianSubs, 1000, 2_000_000);
  const viewsScore = logNorm(medianViewsPerDay, 100, 100_000);
  return clamp(0.6 * subsScore + 0.4 * viewsScore, 0, 1);
}

export function scoreKeywordOpportunity(input: {
  keyword: string;
  volume: number;
  monthlyVolumes?: number[] | null;
  videos: YouTubeVideo[];
  totalResults: number | null;
  minVolume: number;
  maxVolume: number;
  relatedKeywords?: string[];
  channelProfile?: ChannelProfile | null;
  now?: Date;
}): OpportunityResult {
  const nowMs = (input.now ?? new Date()).getTime();
  const normalizedKeyword = normalizeKeyword(input.keyword);
  const keywordTokens = tokenize(input.keyword);

  const scoredVideos: ScoredVideo[] = input.videos.map((video) => {
    const titleTokens = tokenize(video.title);
    const descTokens = tokenize(video.description);
    const tagTokens = tokenize(video.tags.join(" "));
    const fit = fitScore(keywordTokens, titleTokens, descTokens, tagTokens);
    const ageDays = getAgeDays(video.publishedAt, nowMs);
    const viewsPerDay = ageDays > 0 ? video.viewCount / ageDays : video.viewCount;

    const normalizedTitle = normalizeKeyword(video.title);
    const normalizedDesc = normalizeKeyword(video.description);
    const titleMatch = normalizedTitle.includes(normalizedKeyword);
    const earlyTitleMatch = normalizedTitle
      .slice(0, 60)
      .includes(normalizedKeyword);
    const descMatch = normalizedDesc.includes(normalizedKeyword);
    const earlyDescMatch = normalizedDesc
      .slice(0, 200)
      .includes(normalizedKeyword);
    const tagMatch = video.tags
      .map((tag) => normalizeKeyword(tag))
      .includes(normalizedKeyword);

    return {
      ...video,
      fit,
      fitLabel: fitLabel(fit),
      ageDays,
      viewsPerDay,
      exactTitleMatch: titleMatch,
      earlyTitleMatch,
      exactDescMatch: descMatch,
      earlyDescMatch,
      exactTagMatch: tagMatch,
    };
  });

  const topFive = scoredVideos.slice(0, 5);
  const topTen = scoredVideos.slice(0, 10);

  const avgTopFit = average(topFive.map((video) => video.fit));
  const weakCount = topTen.filter((video) => video.fit < 0.5).length;
  const weakFitRate = topTen.length > 0 ? weakCount / topTen.length : 0;

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

  const medianVideoAgeDays = median(topTen.map((video) => video.ageDays));

  const exactTitleRate =
    topTen.filter((video) => video.exactTitleMatch).length /
    Math.max(1, topTen.length);
  const earlyTitleRate =
    topTen.filter((video) => video.earlyTitleMatch).length /
    Math.max(1, topTen.length);
  const exactDescRate =
    topTen.filter((video) => video.earlyDescMatch).length /
    Math.max(1, topTen.length);
  const tagRate =
    topTen.filter((video) => video.exactTagMatch).length /
    Math.max(1, topTen.length);
  const avgOverlap = average(
    topTen.map((video) =>
      overlapRatio(keywordTokens, tokenize(video.title + " " + video.description))
    )
  );

  const optimizationStrengthScore = Math.round(
    clamp(
      0.35 * exactTitleRate +
        0.15 * earlyTitleRate +
        0.2 * exactDescRate +
        0.1 * tagRate +
        0.2 * avgOverlap,
      0,
      1
    ) * 100
  );

  const viewCounts = topTen.map((video) => video.viewCount);
  const minViews = viewCounts.length ? Math.min(...viewCounts) : 0;
  const maxViews = viewCounts.length ? Math.max(...viewCounts) : 0;
  const mismatchRaw = topTen.reduce((sum, video) => {
    const viewCountNormalized = logNorm(video.viewCount, minViews, maxViews);
    return sum + viewCountNormalized * (1 - video.fit);
  }, 0);
  const mismatchHigh = mismatchRaw >= 0.6;

  const medianChannelSubs = median(
    topTen.map((video) => video.channelSubscriberCount)
  );
  const medianViewsPerDay = median(topTen.map((video) => video.viewsPerDay));
  const dominanceFactor =
    topTen.filter((video) => video.channelSubscriberCount >= 1_000_000).length /
    Math.max(1, topTen.length);

  const serpMetrics: SerpMetrics = {
    totalResults: input.totalResults,
    medianChannelSubs,
    medianViewsPerDay,
    medianVideoAgeDays,
    dominanceFactor,
  };

  const totalResultsScore =
    input.totalResults !== null
      ? logNorm(input.totalResults, 1_000, 50_000_000)
      : 0.5;
  const subsScore = logNorm(medianChannelSubs, 1_000, 2_000_000);
  const viewsScore = logNorm(medianViewsPerDay, 100, 100_000);
  const competitionHardness = clamp(
    0.35 * totalResultsScore +
      0.35 * subsScore +
      0.2 * viewsScore +
      0.1 * dominanceFactor,
    0,
    1
  );
  const competitionScore = Math.round((1 - competitionHardness) * 100);

  const difficulty = Math.round(
    clamp(
      0.7 * competitionHardness + 0.3 * (optimizationStrengthScore / 100),
      0,
      1
    ) * 100
  );

  const searchVolumeScore = Math.round(
    logNorm(input.volume, input.minVolume, input.maxVolume) * 100
  );

  const freshnessRaw =
    clamp(bestGoodFitAgeDays / 365, 0, 2) * 0.6 +
    clamp(medianVideoAgeDays / 365, 0, 2) * 0.4;
  const freshnessScore = Math.round(clamp(freshnessRaw / 2, 0, 1) * 100);

  const { score: trendScore, ratio: trendRatio } = computeTrendScore(
    input.monthlyVolumes
  );

  const optimizationWeaknessScore = 100 - optimizationStrengthScore;
  const weights = {
    volume: 0.35,
    competition: 0.25,
    optimization: 0.2,
    freshness: 0.15,
    trend: trendScore !== null ? 0.05 : 0,
  };
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);

  const opportunityScore = Math.round(
    clamp(
      (weights.volume * searchVolumeScore +
        weights.competition * competitionScore +
        weights.optimization * optimizationWeaknessScore +
        weights.freshness * freshnessScore +
        weights.trend * (trendScore ?? 0)) /
        Math.max(1, totalWeight),
      0,
      100
    )
  );

  const serpPower = computeSerpPower(medianChannelSubs, medianViewsPerDay);
  const channelPower = computeChannelPower(input.channelProfile);
  const rankabilityFactor =
    channelPower !== null && serpPower > 0
      ? clamp(channelPower / serpPower, 0.5, 1.3)
      : null;

  const weightedOpportunityScore =
    rankabilityFactor !== null
      ? Math.round(clamp(opportunityScore * rankabilityFactor, 0, 100))
      : null;

  const difficultyLabel: OpportunityResult["labels"]["difficulty"] =
    difficulty < 40 ? "Easy" : difficulty < 70 ? "Medium" : "Hard";

  const coverageLabel: OpportunityResult["labels"]["coverage"] =
    avgTopFit >= 0.75 ? "Strong" : avgTopFit >= 0.55 ? "Medium" : "Weak";

  const freshnessLabel: OpportunityResult["labels"]["freshness"] =
    bestGoodFitAgeDays < 90
      ? "Fresh"
      : bestGoodFitAgeDays < 365
      ? "Aging"
      : "Stale";

  const serpWeakness = buildSerpWeaknessSummary({
    exactTitleRate,
    exactDescRate,
    tagRate,
    bestAnswerAgeDays: bestGoodFitAgeDays,
    noStrongMatch,
    mismatchHigh,
  });

  const bullets: string[] = [
    `Search volume ~${Math.round(input.volume)} / month`,
    `Competition is ${difficultyLabel.toLowerCase()} with median channel size ${Math.round(
      medianChannelSubs
    )}`,
    noStrongMatch
      ? "No strong matches in the top results"
      : `Best strong match is ${Math.round(bestGoodFitAgeDays)} days old`,
  ];

  if (mismatchHigh) {
    bullets.push("Popular videos only loosely match the keyword intent");
  } else {
    bullets.push("Results show mixed alignment with the keyword");
  }

  const explanations = {
    searchVolume: [
      `Monthly volume ~${Math.round(input.volume)}.`,
      `Relative volume score ${searchVolumeScore}/100.`,
    ],
    competition: [
      `Median channel subs ~${Math.round(medianChannelSubs)}.`,
      `Dominance: ${Math.round(dominanceFactor * 100)}% of results over 1M subs.`,
    ],
    optimization: [
      `Exact keyword in titles: ${Math.round(exactTitleRate * 100)}%.`,
      `Average relevance score ${Math.round(avgTopFit * 100)}%.`,
    ],
    freshness: [
      `Best strong match is ${Math.round(bestGoodFitAgeDays)} days old.`,
      `Median SERP age ${Math.round(medianVideoAgeDays)} days.`,
    ],
    trend:
      trendScore !== null && trendRatio !== null
        ? [
            `Recent momentum ${trendRatio.toFixed(2)}x vs prior 3 months.`,
            `Trend score ${trendScore}/100.`,
          ]
        : null,
    serpWeakness,
  };

  return {
    keyword: input.keyword,
    volume: input.volume,
    monthlyVolumes: input.monthlyVolumes ?? null,
    scores: {
      searchVolumeScore,
      competitionScore,
      optimizationStrengthScore,
      freshnessScore,
      trendScore,
      difficulty,
      opportunityScore,
      weightedOpportunityScore,
    },
    labels: {
      difficulty: difficultyLabel,
      coverage: coverageLabel,
      freshness: freshnessLabel,
    },
    avgTopFit,
    weakFitRate,
    bestAnswerAgeDays: bestGoodFitAgeDays,
    noStrongMatch,
    bullets,
    explanations,
    topVideos: scoredVideos,
    serpMetrics,
    relatedKeywords: input.relatedKeywords ?? [],
  };
}
