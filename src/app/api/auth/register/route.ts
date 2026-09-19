import { NextResponse } from "next/server";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { registerSchema } from "@/lib/validation/auth";
import { registerStudent } from "@/server/auth";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export const POST = apiHandler({ auth: "none", rateLimit: { limit: 5, windowSec: 60 * 60, name: "register" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, registerSchema);
  const user = await registerStudent({ name: body.name, email: body.email || null, mobile: body.mobile, password: body.password, ip, userAgent });
  const { token, expiresAt } = await createSession(user.id, { ip, userAgent });
  const res = NextResponse.json({ success: true, data: { redirect: "/student/profile?welcome=1", user: { id: user.id, name: user.name, role: user.role } } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
});
