import { ok } from "@/lib/api/handler";
import { setSessionCookie } from "@/lib/auth/session";
import { clearChallengeCookie, ensureDeviceId } from "@/lib/auth/challenge-cookie";
import type { RequestMeta } from "@/server/admin-auth";

/**
 * Shared by the Secure Admin Login routes (a private folder: `_lib` is never routed).
 *
 * Every answer of the sign-in flow is `Cache-Control: no-store` — some carry a QR code, a set-up key
 * or backup codes that must never sit in a browser or proxy cache, and the rest describe a sign-in
 * in progress, which is just as stale a second later.
 */
export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function noStore<T>(data: T) {
  return ok(data, { headers: NO_STORE });
}

export async function requestMeta(ip: string, userAgent: string): Promise<RequestMeta> {
  return { ip, userAgent, deviceId: await ensureDeviceId() };
}

/** The last step passed: the challenge cookie goes, a brand-new session cookie arrives. */
export async function startSession(session: { token: string; expiresAt: Date }) {
  await clearChallengeCookie();
  await setSessionCookie(session.token, session.expiresAt);
}
