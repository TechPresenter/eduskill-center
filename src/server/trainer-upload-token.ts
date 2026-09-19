import { createHmac, timingSafeEqual } from "node:crypto";
import { Errors } from "@/lib/api/errors";

/**
 * Short-lived, signed upload tokens for volunteer-trainer applicants (who have no login yet).
 * Token = base64url(`${applicationId}:${expiresAt}`) + "." + base64url(HMAC-SHA256(payload, AUTH_SECRET)).
 */

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 8) throw new Error("AUTH_SECRET is not configured");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createUploadToken(applicationId: string, ttlMs = DEFAULT_TTL_MS): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${applicationId}:${expiresAt}`;
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(payload)}`;
}

/** Returns the applicationId the token was issued for, or throws a 403 ApiError. */
export function verifyUploadToken(token: unknown): string {
  if (typeof token !== "string" || !token) throw Errors.forbidden("Upload link is missing. Please look up your application to get a new one.");
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw Errors.forbidden("Upload link is invalid.");
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    throw Errors.forbidden("Upload link is invalid.");
  }
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw Errors.forbidden("Upload link is invalid.");
  const sep = payload.lastIndexOf(":");
  const applicationId = payload.slice(0, sep);
  const expiresAt = Number(payload.slice(sep + 1));
  if (!applicationId || !Number.isFinite(expiresAt)) throw Errors.forbidden("Upload link is invalid.");
  if (Date.now() > expiresAt) throw Errors.forbidden("Upload link has expired. Look up your application status to get a fresh link.");
  return applicationId;
}

/** Verifies the token and that it belongs to the given application. */
export function assertUploadTokenFor(token: unknown, applicationId: string): void {
  const owner = verifyUploadToken(token);
  if (owner !== applicationId) throw Errors.forbidden("Upload link does not match this application.");
}
