import { createHash } from "node:crypto";

export function buildQuotaUser(request: Request, salt: string) {
  const explicitId =
    request.headers.get("x-user-id") ??
    request.headers.get("x-clerk-user-id") ??
    request.headers.get("x-vercel-user-id");

  const ip =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";

  const base = explicitId ? `uid:${explicitId}` : `ip:${ip}|ua:${userAgent}`;
  const hash = createHash("sha256")
    .update(`${base}|${salt}`)
    .digest("hex")
    .slice(0, 32);

  return hash;
}
