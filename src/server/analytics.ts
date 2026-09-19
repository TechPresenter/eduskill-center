import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { AnalyticsEventType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/** Event types the public website may record from the browser. */
export const PUBLIC_EVENT_TYPES = ["PAGE_VIEW", "COURSE_VIEW", "CENTER_VIEW", "APPLICATION_STARTED", "TRAINER_APPLICATION_STARTED"] as const satisfies readonly AnalyticsEventType[];

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export interface TrackEventInput {
  type: AnalyticsEventType;
  path?: string | null;
  refId?: string | null;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Stores an analytics event. IPs are never stored raw – only a SHA-256 hash – and the
 * user agent is truncated. Failures are swallowed so tracking never breaks a page.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        type: input.type,
        path: input.path ? input.path.slice(0, 500) : null,
        refId: input.refId ?? null,
        sessionId: input.sessionId ? input.sessionId.slice(0, 100) : null,
        ipHash: hashIp(input.ip),
        userAgent: input.userAgent ? input.userAgent.slice(0, 300) : null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("[analytics] failed to record event:", err);
  }
}
