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
 */
export async function checkRateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  try {
    const rows = await db.$queryRaw<{ count: number; reset_at: Date }[]>`
      INSERT INTO "rate_limits" ("key", "count", "reset_at")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}::double precision))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limits"."reset_at" < now() THEN 1 ELSE "rate_limits"."count" + 1 END,
        "reset_at" = CASE WHEN "rate_limits"."reset_at" < now()
          THEN now() + make_interval(secs => ${windowSec}::double precision)
          ELSE "rate_limits"."reset_at" END
      RETURNING "count", "reset_at"`;
    const row = rows[0];
    if (!row) return { allowed: true, remaining: limit, retryAfterSec: 0 };
    const count = Number(row.count);
    const retryAfterSec = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
    if (Math.random() < 0.01) {
      void db.$executeRaw`DELETE FROM "rate_limits" WHERE "reset_at" < now() - interval '1 day'`.catch(() => undefined);
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
