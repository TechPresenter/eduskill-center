import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { touchSession } from "@/lib/auth/session";
import { adminIdleMinutes } from "@/lib/auth/policy";

/**
 * Keeps an administrator session alive while the person is actually working (the admin idle timer
 * in src/components/admin/idle-timeout.tsx calls it at most once a minute, and for "Stay signed in").
 *
 * Resolving the session in `apiHandler` already enforces the inactivity limit, so a session that has
 * timed out answers 401 here and cannot be revived. Never cached: the answer is per-session.
 */
export const POST = apiHandler(
  { roles: ["SUPER_ADMIN", "STAFF"], rateLimit: { limit: 10, windowSec: 60, keyBy: "user", name: "auth-keepalive" } },
  async ({ user }) => {
    await touchSession(user!.sessionId);
    return NextResponse.json({ success: true, data: { idleMinutes: adminIdleMinutes() } }, { headers: { "Cache-Control": "no-store" } });
  }
);
