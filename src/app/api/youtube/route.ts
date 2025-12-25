import { NextResponse } from "next/server";
import { z } from "zod";

import { getYouTubeVideos } from "@/lib/youtube";

export const runtime = "nodejs";

const requestSchema = z.object({
  keyword: z.string().min(2).max(120),
  maxVideos: z.number().int().min(1).max(50),
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
    const videos = await getYouTubeVideos(
      parsed.data.keyword,
      parsed.data.maxVideos
    );
    return NextResponse.json(videos);
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube API failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
