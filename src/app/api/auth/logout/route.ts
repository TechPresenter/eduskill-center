import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { getSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { logout } from "@/server/auth";

export const POST = apiHandler({ auth: "optional" }, async ({ user, ip, userAgent }) => {
  const token = await getSessionToken();
  if (token) await logout(token, user, { ip, userAgent });
  const res = NextResponse.json({ success: true, data: { redirect: "/login" } });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
  return res;
});
