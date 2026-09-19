import { NextResponse } from "next/server";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { loginSchema } from "@/lib/validation/auth";
import { login } from "@/server/auth";
import { portalHome, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const POST = apiHandler({ auth: "none", rateLimit: { limit: 10, windowSec: 15 * 60, name: "login" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, loginSchema);
  const { user, token, expiresAt } = await login({ ...body, ip, userAgent });
  const next = body.next && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : portalHome(user.role);
  const res = NextResponse.json({
    success: true,
    data: { redirect: next, user: { id: user.id, name: user.name, role: user.role } },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
});
