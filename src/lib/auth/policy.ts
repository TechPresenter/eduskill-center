import type { UserRole } from "@/generated/prisma/enums";
import { getSetting } from "@/lib/settings";
import { isEncryptionConfigured } from "@/lib/crypto";

/**
 * Administrator sign-in policy. The switches that must not be flipped by a compromised staff
 * account live in the server .env; the 2FA requirement is a Super-Admin-only setting.
 *
 *   ADMIN_PASSWORD_LOGIN=on|off   on (default): administrators may also sign in with a password
 *                                 (and still need their authenticator when 2FA is on).
 *                                 off: Passwordless Secure Login (email code) only.
 *   ADMIN_IDLE_MINUTES=30         automatic sign-out after this long without activity.
 *   ADMIN_SESSION_HOURS=12        an administrator session never lasts longer than this.
 */

export const ADMIN_LOGIN_PATH = "/login/admin";

export function isAdminRole(role: UserRole | string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "STAFF";
}

export function adminPasswordLoginEnabled(): boolean {
  return (process.env.ADMIN_PASSWORD_LOGIN ?? "on").trim().toLowerCase() !== "off";
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function adminIdleMinutes(): number {
  return envInt("ADMIN_IDLE_MINUTES", 30, 5, 480);
}

export function adminIdleMs(): number {
  return adminIdleMinutes() * 60_000;
}

export function adminSessionMs(): number {
  return envInt("ADMIN_SESSION_HOURS", 12, 1, 72) * 60 * 60_000;
}

/**
 * Super Admin setting: every administrator must use an authenticator app. Only enforced when the
 * server can actually store authenticator secrets (DATA_ENCRYPTION_KEY) — otherwise nobody could
 * enrol and every administrator would be locked out.
 */
export async function adminTwoFactorRequired(): Promise<boolean> {
  if (!isEncryptionConfigured()) return false;
  try {
    return (await getSetting<boolean>("security.require2faForAdmins")) === true;
  } catch {
    return false;
  }
}
