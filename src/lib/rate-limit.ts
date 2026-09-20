import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Database-backed fixed-window rate limiter (works across multiple app instances).
 * A single atomic upsert increments the counter or resets the window.
 *
 * `rate_limits.reset_at` is TIMESTAMP(3) WITHOUT TIME ZONE, so every comparison here uses
 * LOCALTIMESTAMP (the un-zoned counterpart of now()) and the seconds left are computed IN SQL.
 * Reading the column into JavaScript and subtracting Date.now() does NOT work: the driver hands
 * back a naive timestamp that JS reads as local time, which on an IST server inflated every
 * Retry-After by exactly the 19800-second offset (a 1-hour window reported as ~6.5 hours).
 */
export async function checkRateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  try {
    const rows = await db.$queryRaw<{ count: number; retry_after: number }[]>`
      INSERT INTO "rate_limits" ("key", "count", "reset_at")
      VALUES (${key}, 1, LOCALTIMESTAMP + make_interval(secs => ${windowSec}::double precision))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limits"."reset_at" < LOCALTIMESTAMP THEN 1 ELSE "rate_limits"."count" + 1 END,
        "reset_at" = CASE WHEN "rate_limits"."reset_at" < LOCALTIMESTAMP
          THEN LOCALTIMESTAMP + make_interval(secs => ${windowSec}::double precision)
          ELSE "rate_limits"."reset_at" END
      RETURNING "count", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("reset_at" - LOCALTIMESTAMP))))::int AS retry_after`;
    const row = rows[0];
    if (!row) return { allowed: true, remaining: limit, retryAfterSec: 0 };
    const count = Number(row.count);
    const retryAfterSec = Number(row.retry_after);
    if (Math.random() < 0.01) {
      void db.$executeRaw`DELETE FROM "rate_limits" WHERE "reset_at" < LOCALTIMESTAMP - interval '1 day'`.catch(() => undefined);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSec };
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
}

export async function enforceRateLimit(key: string, limit: number, windowSec: number): Promise<void> {
  const result = await checkRateLimit(key, limit, windowSec);
  if (!result.allowed) throw Errors.tooMany(result.retryAfterSec);
}
