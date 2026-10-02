import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import { ApiError, Errors } from "@/lib/api/errors";
import { getSessionUser, type AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { enforceRateLimit, enforceRateLimitStrict } from "@/lib/rate-limit";

export type RouteParams = Record<string, string | string[]>;

export interface ApiContext<P extends RouteParams = RouteParams> {
  req: NextRequest;
  params: P;
  user: AuthUser | null;
  ip: string;
  userAgent: string;
}

export interface ApiOptions {
  /** required (default) → 401 when not logged in. optional → user may be null. none → no session lookup. */
  auth?: "required" | "optional" | "none";
  roles?: UserRole[];
  /** Any-of permission check (only meaningful for admin/staff). */
  permission?: string | string[];
  rateLimit?: {
    limit: number;
    windowSec: number;
    keyBy?: "ip" | "user";
    name?: string;
    /** Refuse (429) when the limiter itself fails — for sign-in codes and second factors. */
    failClosed?: boolean;
  };
  /** Same-origin enforcement for state-changing requests (default true). Disable for gateway webhooks. */
  csrf?: boolean;
}

const IP_SHAPE = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * The client's IP address, as the trusted reverse proxy saw it.
 *
 * X-Forwarded-For is a list every proxy APPENDS to — and a client can send its own value first.
 * Trusting the left-most entry (as this used to) let anyone pick their own IP, which defeated every
 * per-IP rate limit and poisoned login history. With TRUSTED_PROXY_HOPS proxies in front (default
 * 1: nginx, which appends `$remote_addr`), the real client is the entry that many places from the
 * RIGHT. X-Real-IP is used only when TRUST_X_REAL_IP=1, i.e. the proxy is known to overwrite it.
 */
export function getClientIp(req: NextRequest): string {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  const xf = req.headers.get("x-forwarded-for");
  if (xf && Number.isFinite(hops) && hops > 0) {
    const parts = xf.split(",").map((p) => p.trim()).filter(Boolean);
    const ip = parts[parts.length - hops];
    if (ip && IP_SHAPE.test(ip)) return ip;
  }
  if (process.env.TRUST_X_REAL_IP === "1") {
    const real = req.headers.get("x-real-ip")?.trim();
    if (real && IP_SHAPE.test(real)) return real;
  }
  return "0.0.0.0";
}

function zodDetails(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.map(String).join(".") || "_";
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const res = NextResponse.json(
      { success: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status }
    );
    if (err.status === 429 && err.details && typeof err.details === "object" && "retryAfterSec" in err.details) {
      res.headers.set("Retry-After", String((err.details as { retryAfterSec: number }).retryAfterSec));
    }
    return res;
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Please correct the highlighted fields.", details: zodDetails(err) } },
      { status: 422 }
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]).join(", ") : undefined;
      // err.meta is NOT sent: under the Prisma driver adapter it carries raw database messages and
      // constraint names.
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: target ? `A record with the same ${target} already exists.` : "Duplicate record." } }, { status: 409 });
    }
    if (err.code === "P2025") {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Record not found." } }, { status: 404 });
    }
    if (err.code === "P2003") {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "A related record does not exist or is still referenced." } },
        { status: 400 }
      );
    }
  }
  console.error("[api] Unhandled error:", err);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 }
  );
}

const SENSITIVE_API = /^\/api\/(admin|auth)(\/|$)/;

function assertSameOrigin(req: NextRequest) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite === "cross-site") throw Errors.forbidden("Cross-site request blocked");
  const origin = req.headers.get("origin");
  // Sign-in and admin endpoints accept browser requests only: every current browser sends Origin
  // (or at least Sec-Fetch-Site) on a POST, and an opaque "null" origin (sandboxed frame, data: URL)
  // is cross-site by definition.
  const sensitive = SENSITIVE_API.test(req.nextUrl.pathname);
  if (origin === "null" || (sensitive && !origin && !fetchSite)) throw Errors.forbidden("Cross-site request blocked");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))?.split(",")[0]?.trim();
    if (!originHost || (host && originHost !== host)) throw Errors.forbidden("Cross-site request blocked");
  }
}

/**
 * Wraps a Next.js route handler with authentication, authorization, rate limiting,
 * CSRF (same-origin) enforcement and consistent JSON error handling.
 *
 * Return a plain value to send `{ success: true, data }`, or return a `Response` directly.
 */
export function apiHandler<P extends RouteParams = RouteParams>(
  opts: ApiOptions,
  fn: (ctx: ApiContext<P>) => Promise<unknown>
) {
  return async (req: NextRequest, routeCtx?: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = (routeCtx ? await routeCtx.params : {}) as P;
      const ip = getClientIp(req);
      const userAgent = req.headers.get("user-agent") ?? "";

      if (opts.csrf !== false) assertSameOrigin(req);

      let user: AuthUser | null = null;
      if (opts.auth !== "none") {
        user = await getSessionUser();
        if (opts.auth !== "optional" && !user) throw Errors.unauthorized();
      }
      if (user && opts.roles && !opts.roles.includes(user.role)) throw Errors.forbidden();
      if (opts.permission && !hasPermission(user, opts.permission)) throw Errors.forbidden();

      if (opts.rateLimit) {
        const rl = opts.rateLimit;
        const subject = rl.keyBy === "user" && user ? `u:${user.id}` : `ip:${ip}`;
        const key = `${rl.name ?? req.nextUrl.pathname}:${subject}`;
        if (rl.failClosed) await enforceRateLimitStrict(key, rl.limit, rl.windowSec);
        else await enforceRateLimit(key, rl.limit, rl.windowSec);
      }

      const result = await fn({ req, params, user, ip, userAgent });
      if (result instanceof Response) return result;
      return NextResponse.json({ success: true, data: result ?? null });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

/** Parses JSON or form bodies and validates with a Zod schema (422 on failure). */
export async function parseBody<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      const obj: Record<string, unknown> = {};
      fd.forEach((v, k) => {
        obj[k] = v;
      });
      raw = obj;
    } else {
      const text = await req.text();
      raw = text ? JSON.parse(text) : {};
    }
  } catch {
    throw Errors.badRequest("Invalid request body");
  }
  return schema.parse(raw);
}

/** Validates URL search params with a Zod schema. Repeated keys become arrays. */
export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.output<S> {
  const obj: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    const existing = obj[k];
    if (existing === undefined) obj[k] = v;
    else obj[k] = ([] as string[]).concat(existing, v);
  });
  return schema.parse(obj);
}

/** Helper to require that a user is present (narrowing). */
export function requireCtxUser(ctx: ApiContext): AuthUser {
  if (!ctx.user) throw Errors.unauthorized();
  return ctx.user;
}
