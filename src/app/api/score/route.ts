import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { z } from "zod";

import { getKeywordIdeas } from "@/lib/keywordtool";
import { scoreOpportunity } from "@/lib/scoring/opportunity";
import { getYouTubeVideos } from "@/lib/youtube";
import type { OpportunityResult } from "@/lib/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  seed: z.string().min(2).max(120),
  limitKeywords: z.number().int().min(1).max(50),
  maxVideos: z.number().int().min(1).max(50),
});

const CONCURRENCY = 5;

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

  const { seed, limitKeywords, maxVideos } = parsed.data;

  try {
    const ideas = await getKeywordIdeas(seed, limitKeywords);
    const volumes = ideas.map((idea) => idea.volume);
    const minVolume = volumes.length ? Math.min(...volumes) : 0;
    const maxVolume = volumes.length ? Math.max(...volumes) : 0;

    const limiter = pLimit(CONCURRENCY);
    const results: OpportunityResult[] = await Promise.all(
      ideas.map((idea) =>
        limiter(async () => {
          const videos = await getYouTubeVideos(idea.keyword, maxVideos);
          return scoreOpportunity({
            keyword: idea.keyword,
            volume: idea.volume,
            videos,
            minVolume,
            maxVolume,
          });
        })
      )
    );

    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      seed,
      generatedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scoring failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
