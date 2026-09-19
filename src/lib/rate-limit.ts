import "server-only";

import { AppError } from "@/lib/panta/errors";

/**
 * Minimal fixed-window limiter for the AI route.
 *
 * Deliberately in-process and dependency-free: it raises the cost of casual
 * abuse without adding Redis or another service to a no-database product.
 * On serverless this is per-instance, which is acknowledged in the docs.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

export function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(options.key);

  if (!existing || existing.resetAt <= now) {
    // Opportunistically drop expired entries so the map cannot grow forever.
    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }
    const fresh: Bucket = { count: 1, resetAt: now + options.windowMs };
    buckets.set(options.key, fresh);
    return { remaining: options.limit - 1, resetAt: fresh.resetAt };
  }

  if (existing.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw new AppError({
      code: "AI_RATE_LIMITED",
      message: `Too many analysis requests. Try again in ${retryAfter}s.`,
      details: { retryAfterSeconds: retryAfter },
      status: 429,
      retryable: true,
    });
  }

  existing.count += 1;
  return { remaining: options.limit - existing.count, resetAt: existing.resetAt };
}

/** Best-effort client identity for rate limiting. Not used for anything else. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}
