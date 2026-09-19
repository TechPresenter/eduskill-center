"use client";

/** Small fetch wrapper for client components talking to the internal JSON API. */

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
  const res = await fetch(url, {
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
