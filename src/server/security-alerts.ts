import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { notify, sendSecurityEmail } from "@/lib/notifications";

export type AlertSeverity = "info" | "warning" | "critical";

export type SecurityAlertType =
  | "NEW_DEVICE_LOGIN"
  | "SUSPICIOUS_LOGIN"
  | "ACCOUNT_LOCKED"
  | "MFA_LOCKED"
  | "TWO_FACTOR_ENABLED"
  | "TWO_FACTOR_DISABLED"
  | "TWO_FACTOR_RESET"
  | "BACKUP_CODE_USED"
  | "BACKUP_CODES_REGENERATED"
  | "OTP_DELIVERY_FAILED"
  | "OTP_ABUSE"
  | "EMAIL_CONFIG_CHANGED"
  | "SECURITY_SETTINGS_CHANGED"
  | "LOGIN_EMAIL_CHANGED"
  | "ACCOUNT_STATUS_CHANGED"
  | "ACCOUNT_UNLOCKED"
  | "BULK_EMAIL_SENT"
  | "SESSIONS_REVOKED"
  | "RECOVERY_LOGIN"
  /** A secret setting cannot be decrypted with the current DATA_ENCRYPTION_KEY. */
  | "SECRET_UNREADABLE";

export interface SecurityAlertInput {
  type: SecurityAlertType;
  severity: AlertSeverity;
  title: string;
  /** Plain text. Never put a code, token, password or secret in here — it is emailed and stored. */
  detail?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Email the Super Admins and the security alert address. Default: warning and critical only. */
  notifyAdmins?: boolean;
}

/** "2 Oct 2026, 6:42 pm IST" */
export function istTime(date: Date = new Date()): string {
  return `${date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })} IST`;
}

/**
 * Records a security event for the Security Center and, for anything worth waking someone up for,
 * tells every Super Admin (in-app + email) and the configured security alert mailbox
 * (info@eduskillindia.com by default).
 *
 * Never throws and never blocks the request on email delivery: an alert failing must not break
 * the sign-in or the change that triggered it.
 */
export async function raiseSecurityAlert(input: SecurityAlertInput): Promise<void> {
  try {
    await db.securityAlert.create({
      data: {
        type: input.type,
        severity: input.severity,
        title: input.title.slice(0, 300),
        detail: input.detail?.slice(0, 2000) ?? null,
        userId: input.userId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
    const shouldNotify = input.notifyAdmins ?? input.severity !== "info";
    if (shouldNotify) void notifyAdmins(input);
  } catch (err) {
    console.error("[security-alert] failed:", err instanceof Error ? err.message : err);
  }
}

async function notifyAdmins(input: SecurityAlertInput) {
  try {
    const admins = await db.user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null }, select: { id: true, email: true } });
    const data = { title: input.title, body: input.detail ?? "", time: istTime(), link: absoluteUrl("/admin/security/alerts") };
    const sent = new Set<string>();
    for (const a of admins) {
      await notify({ userId: a.id, event: "SECURITY_ALERT", data, channels: ["IN_APP"] });
      if (a.email && !sent.has(a.email.toLowerCase())) {
        sent.add(a.email.toLowerCase());
        await sendSecurityEmail({ userId: a.id, email: a.email, event: "SECURITY_ALERT", data });
      }
    }
    const extra = String((await getSetting<string>("security.alertEmail").catch(() => "")) ?? "").trim();
    if (extra.includes("@") && !sent.has(extra.toLowerCase())) await sendSecurityEmail({ email: extra, event: "SECURITY_ALERT", data });
  } catch (err) {
    console.error("[security-alert] notify failed:", err instanceof Error ? err.message : err);
  }
}
