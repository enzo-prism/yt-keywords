import { NextResponse } from "next/server";
import { z } from "zod";

import { formatEnvError, getEnv } from "@/lib/env";
import {
  getYouTubeKeywordIdeasWithVolume,
  type SuggestionMode,
} from "@/lib/keywordtool";
import { formatExternalApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const requestSchema = z.object({
  seed: z.string().min(2).max(120),
  limit: z.number().int().min(1).max(50),
  country: z.string().length(2).optional(),
  language: z.string().min(2).optional(),
  suggestionMode: z
    .enum(["suggestions", "questions", "prepositions", "trends"])
    .optional(),
});

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

  try {
    getEnv();
  } catch (error) {
    return NextResponse.json(
      { error: formatEnvError(error) },
      { status: 500 }
    );
  }

  try {
    const ideas = await getYouTubeKeywordIdeasWithVolume({
      seed: parsed.data.seed.trim(),
      limit: parsed.data.limit,
      country: parsed.data.country,
      language: parsed.data.language,
      suggestionMode: parsed.data.suggestionMode as SuggestionMode | undefined,
    });
    return NextResponse.json(ideas);
  } catch (error) {
    const formatted = formatExternalApiError(error, "keyword tool");
    return NextResponse.json(
      { error: formatted.message },
      { status: formatted.status }
    );
  }
}
