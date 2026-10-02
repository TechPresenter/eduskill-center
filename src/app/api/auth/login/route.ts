import { NextResponse } from "next/server";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { loginSchema } from "@/lib/validation/auth";
import { login } from "@/server/auth";
import { postLoginRedirect, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { ensureDeviceId, setChallengeCookie } from "@/lib/auth/challenge-cookie";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/policy";

export const POST = apiHandler({ auth: "none", rateLimit: { limit: 10, windowSec: 15 * 60, name: "login" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, loginSchema);
  const deviceId = await ensureDeviceId();
  const result = await login({ ...body, ip, userAgent, deviceId });

  if (result.kind === "challenge") {
    // An administrator whose password checked out but who still needs a second factor: no session
    // yet — the browser continues on Secure Admin Login with the challenge cookie.
    await setChallengeCookie(result.challengeToken, result.challengeExpiresAt);
    return NextResponse.json({ success: true, data: { mfaRequired: true, redirect: ADMIN_LOGIN_PATH } });
  }

  const next = result.redirect ?? postLoginRedirect(body.next, result.user.role);
  const res = NextResponse.json({
    success: true,
    data: { redirect: next, user: { id: result.user.id, name: result.user.name, role: result.user.role } },
  });
  res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
  return res;
});
