import { titleCase } from "@/lib/utils";

/*
 * Plain-text labels for the sign-in records shown on My account → Security. Server-safe (no hooks),
 * so the server page and any client component can share them.
 */

const METHOD_LABELS: Record<string, string> = {
  PASSWORD: "Password",
  EMAIL_OTP: "Email code",
  SMS_OTP: "SMS code",
  TOTP: "Authenticator app",
  BACKUP_CODE: "Backup code",
  RECOVERY: "Recovery link",
  REGISTER: "Registration",
};

/** "EMAIL_OTP+TOTP" → "Email code + Authenticator app". */
export function signInMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return method
    .split("+")
    .filter(Boolean)
    .map((m) => METHOD_LABELS[m] ?? titleCase(m))
    .join(" + ");
}

const REASON_LABELS: Record<string, string> = {
  bad_password: "Wrong password",
  unknown_user: "Unknown account",
  inactive: "Account not active",
  locked: "Account locked",
  otp_bad_code: "Wrong email code",
  otp_expired: "Email code expired",
  otp_locked: "Too many wrong codes",
  otp_no_match: "Code not recognised",
  totp_bad_code: "Wrong authenticator code",
  backup_bad_code: "Wrong backup code",
  password_ok_second_factor_pending: "Password accepted, second step pending",
};

export function signInReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return REASON_LABELS[reason] ?? titleCase(reason);
}

/** A successful row that is only the first half of a two-step sign-in. */
export function isPartialSignIn(reason: string | null | undefined): boolean {
  return reason === "password_ok_second_factor_pending";
}
