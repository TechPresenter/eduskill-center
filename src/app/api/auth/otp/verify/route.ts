import { NextResponse } from "next/server";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { loginOtpVerifySchema } from "@/lib/validation/auth";
import { verifyLoginOtp } from "@/server/login-otp";
import { postLoginRedirect, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/**
 * Step 2 of admission-number sign-in. On success it sets the session cookie and returns the redirect
 * exactly like POST /api/auth/login. Brute force is bounded twice: each code locks after 5 wrong
 * tries, and this per-IP limit caps guesses across codes.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 30, windowSec: 15 * 60, name: "login-otp-verify" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, loginOtpVerifySchema);
  const { user, token, expiresAt } = await verifyLoginOtp({ admissionNo: body.admissionNo, mobile: body.mobile, code: body.code, ip, userAgent });
  const res = NextResponse.json({
    success: true,
    data: { redirect: postLoginRedirect(body.next, user.role), user: { id: user.id, name: user.name, role: user.role } },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
});
