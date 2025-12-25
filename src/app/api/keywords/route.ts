import { NextResponse } from "next/server";
import { z } from "zod";

import { getKeywordIdeas } from "@/lib/keywordtool";

export const runtime = "nodejs";

const requestSchema = z.object({
  seed: z.string().min(2).max(120),
  limit: z.number().int().min(1).max(50),
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
    const ideas = await getKeywordIdeas(parsed.data.seed, parsed.data.limit);
    return NextResponse.json(ideas);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Keyword API failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
