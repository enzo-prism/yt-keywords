type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 30;

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(ip: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    rateLimitStore.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);
  return {
    allowed: true,
    remaining: Math.max(0, MAX_REQUESTS - entry.count),
    resetAt: entry.resetAt,
  };
}
