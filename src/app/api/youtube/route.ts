import { NextResponse } from "next/server";
import { z } from "zod";

import { formatEnvError, getEnv } from "@/lib/env";
import { formatExternalApiError } from "@/lib/api-errors";
import { buildQuotaUser } from "@/lib/quota-user";
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

  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (error) {
    return NextResponse.json(
      { error: formatEnvError(error) },
      { status: 500 }
    );
  }

  const quotaUser = buildQuotaUser(request, env.YOUTUBE_API_KEY);

  try {
    let staleUsed = false;
    const serp = await getYouTubeSerp(parsed.data.keyword, parsed.data.maxVideos, {
      quotaUser,
      allowStaleOnRateLimit: true,
      onStale: () => {
        staleUsed = true;
      },
    });
    const response = NextResponse.json(serp);
    if (staleUsed) {
      response.headers.set("X-HotContent-Cache", "STALE_FALLBACK");
    }
    return response;
  } catch (error) {
    const formatted = formatExternalApiError(error, "google");
    return NextResponse.json(
      { error: formatted.message },
      { status: formatted.status }
    );
  }
}
