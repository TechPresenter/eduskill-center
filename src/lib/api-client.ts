"use client";

import { stripBasePath, withBasePath } from "@/lib/base-path";
import { purgeOfflineCaches } from "@/components/pwa/register-sw";

/** Small fetch wrapper for client components talking to the internal JSON API. */

/** Keep in step with ADMIN_LOGIN_PATH in src/lib/auth/policy.ts (client bundles cannot import it). */
const ADMIN_LOGIN_PATH = "/login/admin";
/** sessionStorage marker of the last "session expired" redirect: never bounce twice within this window. */
const EXPIRED_REDIRECT_KEY = "esk:admin-expired-redirect";
const EXPIRED_REDIRECT_COOLDOWN_MS = 15_000;
let redirectingToLogin = false;

function isAdminPath(path: string) {
  return path === "/admin" || path.startsWith("/admin/");
}

/**
 * An admin API call answered 401 while an admin page is open: the session timed out, was revoked
 * from the Security Center, or ended in another tab. Sends the browser to Secure Admin Login once,
 * with the page to come back to, instead of leaving every button on the page failing.
 *
 * Returns true when the redirect was started.
 */
function redirectToAdminLogin(url: string): boolean {
  if (redirectingToLogin || typeof window === "undefined") return false;
  let apiPath: string;
  try {
    const target = new URL(withBasePath(url), window.location.href);
    if (target.origin !== window.location.origin) return false;
    apiPath = stripBasePath(target.pathname);
  } catch {
    return false;
  }
  if (!apiPath.startsWith("/api/admin/")) return false;
  const pagePath = stripBasePath(window.location.pathname);
  if (!isAdminPath(pagePath)) return false;
  try {
    // A login page that bounced straight back here would otherwise loop.
    const last = Number(window.sessionStorage.getItem(EXPIRED_REDIRECT_KEY));
    if (Number.isFinite(last) && Date.now() - last < EXPIRED_REDIRECT_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(EXPIRED_REDIRECT_KEY, String(Date.now()));
  } catch {
    /* Storage blocked: the module flag still allows only one redirect for this page. */
  }
  redirectingToLogin = true;
  // Same clean-up as the shell's LogoutButton; the admin idle timer passes the news to other tabs.
  window.dispatchEvent(new CustomEvent("esk:logout", { detail: { reason: "expired" } }));
  purgeOfflineCaches();
  const params = new URLSearchParams({ reason: "expired", next: pagePath + window.location.search });
  window.location.replace(withBasePath(`${ADMIN_LOGIN_PATH}?${params.toString()}`));
  return true;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, string> | unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
  /** Field-level validation messages when the server returned 422. */
  get fieldErrors(): Record<string, string> {
    return this.details && typeof this.details === "object" && !Array.isArray(this.details) ? (this.details as Record<string, string>) : {};
  }
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  // Call sites pass app-absolute paths ("/api/admin/centers"); under a sub-path deployment the
  // browser has to hit "/center/api/admin/centers". `withBasePath` is the identity function without
  // a base path, leaves absolute/scheme/relative URLs alone, and is idempotent — so a caller that
  // already holds a prefixed URL (a stored "/center/api/files/…") is never prefixed twice.
  const res = await fetch(withBasePath(url), {
    method,
    headers: isForm ? undefined : body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    ...init,
  });
  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    json = null;
  }
  if (!res.ok || !json?.success) {
    // Only a missing or ended session (SESSION_REQUIRED) means "sign in again". A 401 for a wrong
    // authenticator or email-change code must reach the form that sent it.
    if (res.status === 401 && json?.error?.code === "SESSION_REQUIRED" && redirectToAdminLogin(url)) {
      // Callers still get their error (and stop their spinners); the page is already on its way out.
      throw new ApiClientError(401, "Your session has ended. Please sign in again.", json?.error?.code ?? "SESSION_REQUIRED", json?.error?.details);
    }
    throw new ApiClientError(res.status, json?.error?.message ?? `Request failed (${res.status})`, json?.error?.code, json?.error?.details);
  }
  return json.data as T;
}

export const api = {
  get: <T>(url: string, init?: RequestInit) => request<T>("GET", url, undefined, init),
  post: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>("POST", url, body, init),
  put: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>("PUT", url, body, init),
  patch: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>("PATCH", url, body, init),
  delete: <T>(url: string, init?: RequestInit) => request<T>("DELETE", url, undefined, init),
};

export function errorMessage(err: unknown, fallback = "Something went wrong") {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
