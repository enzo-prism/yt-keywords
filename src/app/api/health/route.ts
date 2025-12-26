import { NextResponse } from "next/server";

import { getEnvStatus } from "@/lib/env";
import pkg from "../../../../package.json";

export const runtime = "nodejs";

export async function GET() {
  const status = getEnvStatus();

  return NextResponse.json({
    ok: true,
    keywordtoolConfigured: status.keywordtoolConfigured,
    youtubeConfigured: status.youtubeConfigured,
    kvConfigured: status.kvConfigured,
    trendsEnabled: status.trendsEnabled,
    missingKeys: status.missingKeys,
    version: pkg.version,
  });
}
