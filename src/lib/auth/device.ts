import { randomBytes } from "node:crypto";
import { BASE_PATH } from "@/lib/base-path";
import { sha256 } from "@/lib/crypto";

/**
 * A long-lived random identifier per browser (httpOnly cookie). Only its SHA-256 is stored, on the
 * session and in login history, so the Security Center can list devices and the sign-in flow can
 * tell a returning browser from a new one. It authenticates nothing on its own.
 */
export const DEVICE_COOKIE = "esk_device";
const DEVICE_COOKIE_DAYS = 400;

export function newDeviceId(): string {
  return randomBytes(24).toString("base64url");
}

export function hashDeviceId(id: string): string {
  return sha256(`device:${id}`);
}

export function deviceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: BASE_PATH || "/",
    maxAge: DEVICE_COOKIE_DAYS * 24 * 60 * 60,
  };
}

/** "Chrome on Windows" from a user-agent string. Rendered as plain text only. */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad/i.test(ua)
        ? "iOS"
        : /Mac OS|Macintosh/i.test(ua)
          ? "macOS"
          : /CrOS/i.test(ua)
            ? "ChromeOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Other";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /SamsungBrowser/i.test(ua)
        ? "Samsung Internet"
        : /Chrome\//i.test(ua)
          ? "Chrome"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : /Safari\//i.test(ua)
              ? "Safari"
              : /curl/i.test(ua)
                ? "curl"
                : "Browser";
  return `${browser} on ${os}`;
}

/** 203.0.113.42 → 203.0.113.x ; 2001:db8:1:2::5 → 2001:db8:1:… — for staff who may not see full IPs. */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  if (ip.includes(".") && !ip.includes(":")) {
    const p = ip.split(".");
    return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.x` : ip;
  }
  const groups = ip.split(":").filter(Boolean);
  return `${groups.slice(0, 3).join(":")}:…`;
}

/** The network an address belongs to (IPv4 /24, IPv6 /48) — "a network seen before" check. */
export function ipNetwork(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(".") && !ip.includes(":")) {
    const p = ip.split(".");
    return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}` : null;
  }
  const groups = ip.split(":").filter(Boolean);
  return groups.length >= 3 ? groups.slice(0, 3).join(":").toLowerCase() : null;
}
