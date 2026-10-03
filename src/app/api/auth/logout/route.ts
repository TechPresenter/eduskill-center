import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { getSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { clearChallengeCookie } from "@/lib/auth/challenge-cookie";
import { ADMIN_LOGIN_PATH, isAdminRole } from "@/lib/auth/policy";
import { logout } from "@/server/auth";

/** True when the request came from an /admin page (the session may already have expired there). */
function fromAdminPage(referer: string | null): boolean {
  if (!referer) return false;
  try {
    return /\/admin(\/|$)/.test(new URL(referer).pathname);
  } catch {
    return false;
  }
}

/** The optional `{ sessionId }` an admin tab sends to sign out ITS session only. */
async function requestedSessionId(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { sessionId?: unknown } | null;
    return typeof body?.sessionId === "string" && body.sessionId.length <= 100 ? body.sessionId : null;
  } catch {
    return null;
  }
}

export const POST = apiHandler({ auth: "optional" }, async ({ req, user, ip, userAgent }) => {
  // An idle admin tab names the session it belongs to. When the cookie now holds a different, live
  // session (someone else signed in after that admin session ended), it is not this tab's to end.
  const sessionId = await requestedSessionId(req);
  if (sessionId && user && user.sessionId !== sessionId) {
    return NextResponse.json({ success: true, data: { redirect: isAdminRole(user.role) ? ADMIN_LOGIN_PATH : "/login", skipped: true } });
  }
  const token = await getSessionToken();
  if (token) await logout(token, user, { ip, userAgent });
  await clearChallengeCookie();
  const admin = isAdminRole(user?.role) || (!user && fromAdminPage(req.headers.get("referer")));
  const res = NextResponse.json({ success: true, data: { redirect: admin ? ADMIN_LOGIN_PATH : "/login" } });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
  return res;
});
