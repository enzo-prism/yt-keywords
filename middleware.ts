import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { checkRateLimit } from "@/lib/rateLimit";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    request.headers.get("cf-connecting-ip")?.trim() ??
    "unknown";

  const { allowed, remaining, resetAt } = checkRateLimit(ip);

  if (!allowed) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(resetAt));
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
