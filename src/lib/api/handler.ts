import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import { ApiError, Errors } from "@/lib/api/errors";
import { getSessionUser, type AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";

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
  rateLimit?: { limit: number; windowSec: number; keyBy?: "ip" | "user"; name?: string };
  /** Same-origin enforcement for state-changing requests (default true). Disable for gateway webhooks. */
  csrf?: boolean;
}

export function getClientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
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
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: target ? `A record with the same ${target} already exists.` : "Duplicate record.", details: err.meta } },
        { status: 409 }
      );
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

function assertSameOrigin(req: NextRequest) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite === "cross-site") throw Errors.forbidden("Cross-site request blocked");
  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (originHost && host && originHost !== host) throw Errors.forbidden("Cross-site request blocked");
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
        await enforceRateLimit(`${rl.name ?? req.nextUrl.pathname}:${subject}`, rl.limit, rl.windowSec);
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
