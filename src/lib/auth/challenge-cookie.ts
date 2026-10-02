import { cookies } from "next/headers";
import { BASE_PATH } from "@/lib/base-path";
import { DEVICE_COOKIE, deviceCookieOptions, newDeviceId } from "@/lib/auth/device";

/**
 * The httpOnly cookie that binds an administrator sign-in in progress (an AuthChallenge) to the
 * browser that started it. It authenticates nothing by itself: it only lets the SAME browser
 * continue to the next step. No session cookie exists until every factor has passed.
 */
export const CHALLENGE_COOKIE = "esk_auth";

function challengeCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // Strict: a sign-in step is never a cross-site navigation.
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: BASE_PATH || "/",
    expires: expiresAt,
  };
}

export async function getChallengeToken(): Promise<string | null> {
  return (await cookies()).get(CHALLENGE_COOKIE)?.value ?? null;
}

export async function setChallengeCookie(token: string, expiresAt: Date) {
  (await cookies()).set(CHALLENGE_COOKIE, token, challengeCookieOptions(expiresAt));
}

export async function clearChallengeCookie() {
  (await cookies()).set(CHALLENGE_COOKIE, "", { ...challengeCookieOptions(new Date(0)), maxAge: 0 });
}

/** The browser's long-lived device id, created on first use. */
export async function ensureDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{20,64}$/.test(existing)) return existing;
  const id = newDeviceId();
  store.set(DEVICE_COOKIE, id, deviceCookieOptions());
  return id;
}

export async function readDeviceId(): Promise<string | null> {
  const v = (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
  return v && /^[A-Za-z0-9_-]{20,64}$/.test(v) ? v : null;
}
