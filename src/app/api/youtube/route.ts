import { NextResponse } from "next/server";
import { z } from "zod";

import { formatEnvError, getEnv } from "@/lib/env";
import { formatExternalApiError } from "@/lib/api-errors";
import { getYouTubeSerp } from "@/lib/youtube";

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
    getEnv();
  } catch (error) {
    return NextResponse.json(
      { error: formatEnvError(error) },
      { status: 500 }
    );
  }

  try {
    const serp = await getYouTubeSerp(parsed.data.keyword, parsed.data.maxVideos);
    return NextResponse.json(serp);
  } catch (error) {
    const formatted = formatExternalApiError(error, "google");
    return NextResponse.json(
      { error: formatted.message },
      { status: formatted.status }
    );
  }
}
