import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { z } from "zod";

import { formatEnvError, getEnv } from "@/lib/env";
import { formatExternalApiError } from "@/lib/api-errors";
import {
  getYouTubeKeywordIdeasWithVolume,
  type SuggestionMode,
} from "@/lib/keywordtool";
import { clusterKeywordIdeas } from "@/lib/keywords/cluster";
import {
  applyIncludeExclude,
  isLowSignalAutocompleteVariant,
  normalizeKeyword,
} from "@/lib/keywords/normalize";
import { scoreKeywordOpportunity } from "@/lib/scoring/keywordExplorer";
import {
  getChannelProfile,
  getYouTubeSerp,
  resolveChannel,
} from "@/lib/youtube";
import type { ChannelProfile, KeywordIdea, OpportunityResult } from "@/lib/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  seed: z.string().min(2).max(120),
  maxKeywords: z.number().int().min(1).max(50).optional(),
  limitKeywords: z.number().int().min(1).max(50).optional(),
  videosPerKeyword: z.number().int().min(1).max(50).optional(),
  maxVideos: z.number().int().min(1).max(50).optional(),
  country: z.string().length(2).optional(),
  language: z.string().min(2).optional(),
  suggestionMode: z
    .enum(["suggestions", "questions", "prepositions", "trends"])
    .optional(),
  minVolume: z.number().int().min(0).optional(),
  include: z.string().optional(),
  exclude: z.string().optional(),
  hideNoise: z.boolean().optional(),
  cluster: z.boolean().optional(),
  channel: z.string().optional(),
  showWeighted: z.boolean().optional(),
});

const CONCURRENCY = 5;
const DEFAULT_MAX_KEYWORDS = 25;
const DEFAULT_MAX_VIDEOS = 30;

function splitTerms(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function dedupeIdeas(ideas: KeywordIdea[]) {
  const map = new Map<string, KeywordIdea>();
  for (const idea of ideas) {
    const key = normalizeKeyword(idea.keyword);
    const existing = map.get(key);
    if (!existing || idea.volume > existing.volume) {
      map.set(key, idea);
    }
  }
  return Array.from(map.values());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const maxKeywords =
    parsed.data.maxKeywords ??
    parsed.data.limitKeywords ??
    DEFAULT_MAX_KEYWORDS;
  const videosPerKeyword =
    parsed.data.videosPerKeyword ?? parsed.data.maxVideos ?? DEFAULT_MAX_VIDEOS;
  const minVolume = parsed.data.minVolume ?? 0;
  const hideNoise = parsed.data.hideNoise ?? true;
  const cluster = parsed.data.cluster ?? true;
  const includeTerms = splitTerms(parsed.data.include);
  const excludeTerms = splitTerms(parsed.data.exclude);
  const suggestionMode = (parsed.data.suggestionMode ??
    "suggestions") as SuggestionMode;
  const country = parsed.data.country ?? "US";
  const language = parsed.data.language ?? "en";

  try {
    getEnv();
  } catch (error) {
    return NextResponse.json({ error: formatEnvError(error) }, { status: 500 });
  }

  const seed = parsed.data.seed.trim();
  const suggestionLimit = Math.min(Math.max(maxKeywords * 3, 10), 50);

  let ideas: KeywordIdea[];
  try {
    ideas = await getYouTubeKeywordIdeasWithVolume({
      seed,
      limit: suggestionLimit,
      country,
      language,
      suggestionMode,
    });
  } catch (error) {
    const formatted = formatExternalApiError(error, "keyword tool");
    return NextResponse.json(
      { error: formatted.message },
      { status: formatted.status }
    );
  }

  try {
    const filtered = dedupeIdeas(
      ideas.filter((idea) => {
        if (idea.volume < minVolume) return false;
        if (
          hideNoise &&
          isLowSignalAutocompleteVariant(idea.keyword, seed)
        ) {
          return false;
        }
        return applyIncludeExclude(idea.keyword, includeTerms, excludeTerms);
      })
    );

    const volumes = filtered.map((idea) => idea.volume);
    const minVol = volumes.length ? Math.min(...volumes) : 0;
    const maxVol = volumes.length ? Math.max(...volumes) : 0;

    const clusterResult = cluster ? clusterKeywordIdeas(filtered) : null;
    const ideasByKeyword = new Map(
      filtered.map((idea) => [normalizeKeyword(idea.keyword), idea])
    );

    type AnalysisEntry = {
      idea: KeywordIdea;
      relatedKeywords: string[];
      clusterId?: string;
      clusterLabel?: string;
      clusterSize?: number;
    };

    const clusterRepresentatives: AnalysisEntry[] = [];

    if (clusterResult) {
      for (const entry of clusterResult.clusters) {
        const clusterIdeas = entry.keywords
          .map((keyword) => ideasByKeyword.get(normalizeKeyword(keyword)))
          .filter((idea): idea is KeywordIdea => Boolean(idea))
          .sort((a, b) => b.volume - a.volume);
        const representative = clusterIdeas[0];
        if (!representative) continue;
        clusterRepresentatives.push({
          idea: representative,
          relatedKeywords: clusterIdeas
            .slice(0, 12)
            .map((item) => item.keyword),
          clusterId: entry.id,
          clusterLabel: entry.label,
          clusterSize: entry.keywords.length,
        });
      }
    }

    const ideasToAnalyze: AnalysisEntry[] = (clusterResult
      ? clusterRepresentatives
      : filtered
          .sort((a, b) => b.volume - a.volume)
          .slice(0, maxKeywords)
          .map((idea) => ({
            idea,
            relatedKeywords: [idea.keyword],
          }))
    )
      .sort((a, b) => b.idea.volume - a.idea.volume)
      .slice(0, maxKeywords);

    let channelProfile: ChannelProfile | null = null;
    if (parsed.data.channel && parsed.data.showWeighted) {
      const channelId = await resolveChannel(parsed.data.channel);
      if (channelId) {
        channelProfile = await getChannelProfile(channelId);
      }
    }

    const limiter = pLimit(CONCURRENCY);
    let results: OpportunityResult[];
    try {
      results = await Promise.all(
        ideasToAnalyze.map((entry) =>
          limiter(async () => {
            const serp = await getYouTubeSerp(
              entry.idea.keyword,
              videosPerKeyword
            );
            const scored = scoreKeywordOpportunity({
              keyword: entry.idea.keyword,
              volume: entry.idea.volume,
              monthlyVolumes: entry.idea.monthlyVolumes ?? null,
              videos: serp.videos,
              totalResults: serp.totalResults,
              minVolume: minVol,
              maxVolume: maxVol,
              relatedKeywords: entry.relatedKeywords,
              channelProfile,
            });

            return {
              ...scored,
              clusterId: entry.clusterId,
              clusterLabel: entry.clusterLabel,
              clusterSize: entry.clusterSize,
            };
          })
        )
      );
    } catch (error) {
      const formatted = formatExternalApiError(error, "google");
      return NextResponse.json(
        { error: formatted.message },
        { status: formatted.status }
      );
    }

    results.sort((a, b) => b.scores.opportunityScore - a.scores.opportunityScore);

    return NextResponse.json({
      seed,
      generatedAt: new Date().toISOString(),
      results,
      meta: {
        totalSuggestions: ideas.length,
        filteredCount: filtered.length,
        analyzedCount: results.length,
        clustered: cluster,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scoring failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
