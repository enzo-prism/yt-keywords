import { NextResponse } from "next/server";

import { getEnvStatus } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const status = getEnvStatus();

  return NextResponse.json({
    ok: true,
    keywordtoolConfigured: status.keywordtoolConfigured,
    youtubeConfigured: status.youtubeConfigured,
  });
}
