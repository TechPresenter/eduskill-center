import { ShieldCheck, ShieldOff } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

/*
 * Server-safe labels and badges shared by the Security Center pages and the staff profile.
 * No "use client": these render inside server components.
 */

const METHOD_LABELS: Record<string, string> = {
  PASSWORD: "Password",
  EMAIL_OTP: "Email code",
  SMS_OTP: "SMS code",
  TOTP: "Authenticator",
  BACKUP_CODE: "Backup code",
  RECOVERY: "Recovery link",
  REGISTER: "Registration",
};

/** How a session or sign-in attempt authenticated ("Email code", "Authenticator"…). */
export function methodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return METHOD_LABELS[method] ?? titleCase(method);
}

const REASON_LABELS: Record<string, string> = {
  bad_password: "Wrong password",
  unknown_user: "Unknown account",
  locked: "Account locked",
  inactive: "Account not active",
  otp_bad_code: "Wrong email code",
  otp_expired: "Email code expired",
  otp_locked: "Too many wrong codes",
  totp_bad_code: "Wrong authenticator code",
  backup_bad_code: "Invalid backup code",
  password_ok_second_factor_pending: "Password correct, 2FA not completed",
};

/** Plain-language reason for a failed sign-in. */
export function reasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_LABELS[reason] ?? titleCase(reason);
}

const SEVERITY_TONE: Record<string, BadgeTone> = { critical: "danger", warning: "warning", info: "info" };
const SEVERITY_LABEL: Record<string, string> = { critical: "Critical", warning: "Warning", info: "Info" };

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge tone={SEVERITY_TONE[severity] ?? "neutral"} dot>
      {SEVERITY_LABEL[severity] ?? titleCase(severity)}
    </Badge>
  );
}

/** "2FA on" / "No 2FA", optionally with the number of unused backup codes. */
export function TwoFactorBadge({ enabled, backupCodesLeft }: { enabled: boolean; backupCodesLeft?: number }) {
  if (!enabled) {
    return (
      <Badge tone="warning">
        <ShieldOff className="h-3.5 w-3.5" aria-hidden />
        No 2FA
      </Badge>
    );
  }
  const low = backupCodesLeft !== undefined && backupCodesLeft <= 2;
  return (
    <Badge tone="success" title={backupCodesLeft !== undefined ? `${backupCodesLeft} unused backup code${backupCodesLeft === 1 ? "" : "s"}` : undefined}>
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      2FA on
      {backupCodesLeft !== undefined && <span className={low ? "font-bold text-danger" : "font-normal"}>· {backupCodesLeft} backup</span>}
    </Badge>
  );
}

/** The alert type ("NEW_DEVICE_LOGIN") as a short label ("New Device Login"). */
export function alertTypeLabel(type: string): string {
  return titleCase(type);
}
