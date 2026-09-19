import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "esk_session";
const PROTECTED_PREFIXES = ["/admin", "/student", "/trainer"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

/**
 * Lightweight edge guard: users without a session cookie are sent to the login page
 * before any portal page renders. Full session validation and role/permission checks
 * happen server-side in layouts and API handlers.
 *
 * SUB-PATH DEPLOYMENT: every path here is base-path-FREE and must stay that way.
 * Next strips `basePath` before matching `config.matcher` and before populating
 * `req.nextUrl.pathname`, and `req.nextUrl.clone()` returns a NextURL that carries the base
 * path again when it is serialised — so `/center/admin` arrives as `/admin` and the redirect
 * below leaves as `/center/login`. Never prefix by hand; that yields `/center/center/login`.
 * The `next` query parameter is therefore also base-path-free, which is what the login page
 * and the client router expect.
 */
export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.includes(pathname) && !req.nextUrl.searchParams.has("switch")) {
    // Logged-in users hitting auth pages are redirected by the page itself (it knows the role).
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json)$).*)"],
};
