import QRCode from "qrcode";
import { db, type DbClient } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { formatTotpSecret, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";
import { BACKUP_CODE_COUNT, generateBackupCodes, hashBackupCode, looksLikeBackupCode } from "@/lib/auth/backup-codes";
import { revokeAllSessions } from "@/lib/auth/session";
import { adminTwoFactorRequired } from "@/lib/auth/policy";
import { deviceLabel } from "@/lib/auth/device";
import { sendSecurityEmail } from "@/lib/notifications";
import { getBranding } from "@/lib/settings";
import { istTime, raiseSecurityAlert } from "@/server/security-alerts";
import type { AuthUser } from "@/lib/auth/session";

/**
 * Google Authenticator (TOTP) two-factor authentication for administrators: set-up, the second
 * sign-in step, backup codes and Super Admin reset.
 *
 *   - The secret is encrypted at rest (DATA_ENCRYPTION_KEY) and shown exactly once, during set-up.
 *   - A code's 30-second step is remembered, so the same code can never be accepted twice.
 *   - Wrong codes are counted per USER across every sign-in attempt, with an escalating cooldown
 *     (5, then 30, then 120 minutes) — starting a new sign-in does not reset the count.
 *   - Disabling 2FA and creating new backup codes need a fresh code from the authenticator.
 */

const PENDING_SETUP_MINUTES = 15;
const FAILURES_PER_STEP = 5;
const COOLDOWN_MINUTES = [5, 30, 120];

export interface Ctx {
  user: AuthUser;
  ip?: string | null;
  userAgent?: string | null;
}

export interface SetupPayload {
  /** PNG data URL of the otpauth:// QR code. */
  qrDataUrl: string;
  /** The same secret, grouped for typing ("ABCD EFGH …"). */
  manualKey: string;
  issuer: string;
  account: string;
}

async function issuerName() {
  try {
    return (await getBranding()).shortName || "EduSkill";
  } catch {
    return "EduSkill";
  }
}

export async function buildSetupPayload(secret: string, account: string): Promise<SetupPayload> {
  const issuer = `${await issuerName()} Admin`;
  const uri = otpauthUri({ issuer, account, secret });
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return { qrDataUrl, manualKey: formatTotpSecret(secret), issuer, account };
}

function assertEncryption() {
  if (!isEncryptionConfigured()) {
    throw Errors.badRequest("Two-factor authentication cannot be set up yet: the server's DATA_ENCRYPTION_KEY is not configured. Ask the server administrator to set it.");
  }
}

// ───────────────────────────── Status ─────────────────────────────

export async function twoFactorStatus(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpEnabledAt: true, totpPendingAt: true } });
  const remaining = user.totpEnabledAt ? await db.twoFactorBackupCode.count({ where: { userId, usedAt: null } }) : 0;
  return {
    enabled: !!user.totpEnabledAt,
    enabledAt: user.totpEnabledAt,
    backupCodesRemaining: remaining,
    required: await adminTwoFactorRequired(),
    encryptionConfigured: isEncryptionConfigured(),
  };
}

// ───────────────────────────── Verifying a second factor ─────────────────────────────

export type SecondFactorInput = { code?: string | null; backupCode?: string | null };
export type SecondFactorMethod = "TOTP" | "BACKUP_CODE";

/**
 * Checks an authenticator code or a backup code for a user, with replay protection and the
 * per-user escalating cooldown. Returns the method that succeeded; throws a neutral 401 otherwise.
 */
export async function verifyUserSecondFactor(userId: string, input: SecondFactorInput, meta: { ip?: string | null; userAgent?: string | null } = {}): Promise<SecondFactorMethod> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, totpSecretEnc: true, totpEnabledAt: true, totpLastStep: true, mfaFailedCount: true, mfaLockedUntil: true },
  });
  if (!user || !user.totpEnabledAt || !user.totpSecretEnc) throw Errors.unauthorized("Two-factor authentication is not set up for this account.");

  if (user.mfaLockedUntil && user.mfaLockedUntil > new Date()) {
    const mins = Math.ceil((user.mfaLockedUntil.getTime() - Date.now()) / 60_000);
    throw Errors.tooMany(mins * 60);
  }

  let method: SecondFactorMethod | null = null;
  const code = input.code?.replace(/\s/g, "") ?? "";
  const backup = input.backupCode?.trim() ?? "";

  if (code) {
    let secret: string;
    try {
      secret = decryptSecret(user.totpSecretEnc);
    } catch {
      throw Errors.internal("The authenticator secret cannot be read. Ask a Super Admin to reset your two-factor authentication.");
    }
    const step = verifyTotp(secret, code, { lastStep: user.totpLastStep });
    if (step !== null) {
      // Conditional write: two tabs submitting the same code cannot both succeed.
      const claimed = await db.user.updateMany({
        where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
        data: { totpLastStep: step },
      });
      if (claimed.count === 1) method = "TOTP";
    }
  } else if (backup && looksLikeBackupCode(backup)) {
    const used = await db.twoFactorBackupCode.updateMany({
      where: { userId: user.id, codeHash: hashBackupCode(user.id, backup), usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 1) method = "BACKUP_CODE";
  }

  if (!method) {
    const after = await db.user.update({ where: { id: user.id }, data: { mfaFailedCount: { increment: 1 } }, select: { mfaFailedCount: true } });
    if (after.mfaFailedCount % FAILURES_PER_STEP === 0) {
      const idx = Math.min(after.mfaFailedCount / FAILURES_PER_STEP - 1, COOLDOWN_MINUTES.length - 1);
      const minutes = COOLDOWN_MINUTES[idx]!;
      await db.user.update({ where: { id: user.id }, data: { mfaLockedUntil: new Date(Date.now() + minutes * 60_000) } });
      await raiseSecurityAlert({
        type: "MFA_LOCKED",
        severity: "warning",
        title: `Two-factor sign-in paused for ${user.name}`,
        detail: `${after.mfaFailedCount} wrong authenticator or backup codes. Sign-in with a second factor is paused for ${minutes} minutes.`,
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
    throw Errors.unauthorized(backup ? "That backup code is not valid or was already used." : "That code is not correct. Check the time on your phone and try the newest code.");
  }

  await db.user.update({ where: { id: user.id }, data: { mfaFailedCount: 0, mfaLockedUntil: null } });

  if (method === "BACKUP_CODE") {
    const remaining = await db.twoFactorBackupCode.count({ where: { userId: user.id, usedAt: null } });
    if (user.email) {
      void sendSecurityEmail({
        userId: user.id,
        email: user.email,
        event: "BACKUP_CODE_USED",
        data: { name: user.name, device: deviceLabel(meta.userAgent), ip: meta.ip ?? "unknown", time: istTime(), remaining },
      });
    }
    await raiseSecurityAlert({
      type: "BACKUP_CODE_USED",
      severity: "warning",
      title: `${user.name} signed in with a backup code`,
      detail: `${remaining} backup code${remaining === 1 ? "" : "s"} left. Device: ${deviceLabel(meta.userAgent)}.`,
      userId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
  return method;
}

// ───────────────────────────── Backup codes ─────────────────────────────

/** Replaces every backup code with a fresh set; returns the plain codes (shown once). */
export async function replaceBackupCodes(userId: string, client: DbClient = db): Promise<string[]> {
  const codes = generateBackupCodes(BACKUP_CODE_COUNT);
  await client.twoFactorBackupCode.deleteMany({ where: { userId } });
  await client.twoFactorBackupCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashBackupCode(userId, c) })) });
  return codes;
}

// ───────────────────────────── Self-service (Admin → My account → Security) ─────────────────────────────

/** Starts set-up: a new secret is kept (encrypted) as pending until a valid code confirms it. */
export async function beginTwoFactorSetup(ctx: Ctx): Promise<SetupPayload> {
  assertEncryption();
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { email: true, totpEnabledAt: true } });
  if (user.totpEnabledAt) throw Errors.conflict("Two-factor authentication is already on. Turn it off first to set up a new phone.");
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: ctx.user.id }, data: { totpPendingSecretEnc: encryptSecret(secret), totpPendingAt: new Date() } });
  await audit({ user: ctx.user, action: "2fa_setup_started", module: "security", recordType: "User", recordId: ctx.user.id, description: `${ctx.user.name} started setting up two-factor authentication`, ip: ctx.ip, userAgent: ctx.userAgent });
  return buildSetupPayload(secret, user.email ?? ctx.user.name);
}

/** Confirms set-up with a code from the app. Returns the backup codes (shown once). */
export async function confirmTwoFactorSetup(code: string, ctx: Ctx): Promise<{ backupCodes: string[] }> {
  assertEncryption();
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { id: true, name: true, email: true, totpEnabledAt: true, totpPendingSecretEnc: true, totpPendingAt: true } });
  if (user.totpEnabledAt) throw Errors.conflict("Two-factor authentication is already on.");
  if (!user.totpPendingSecretEnc || !user.totpPendingAt || Date.now() - user.totpPendingAt.getTime() > PENDING_SETUP_MINUTES * 60_000) {
    throw Errors.badRequest("The set-up has expired. Start again to get a new QR code.");
  }
  const secret = decryptSecret(user.totpPendingSecretEnc);
  const step = verifyTotp(secret, code);
  if (step === null) throw Errors.unauthorized("That code is not correct. Check the time on your phone and enter the newest code.");

  const backupCodes = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { totpSecretEnc: user.totpPendingSecretEnc, totpEnabledAt: new Date(), totpLastStep: step, totpPendingSecretEnc: null, totpPendingAt: null, mfaFailedCount: 0, mfaLockedUntil: null },
    });
    // This session just proved the authenticator; every other session was signed in without it.
    await tx.session.update({ where: { id: ctx.user.sessionId }, data: { mfaAt: new Date() } });
    return replaceBackupCodes(user.id, tx);
  });
  await revokeAllSessions(user.id, ctx.user.sessionId);

  await audit({ user: ctx.user, action: "2fa_enabled", module: "security", recordType: "User", recordId: user.id, description: `${ctx.user.name} turned on two-factor authentication (other sessions signed out)`, ip: ctx.ip, userAgent: ctx.userAgent });
  if (user.email) void sendSecurityEmail({ userId: user.id, email: user.email, event: "TWO_FACTOR_ENABLED", data: { name: user.name, time: istTime() } });
  await raiseSecurityAlert({ type: "TWO_FACTOR_ENABLED", severity: "info", title: `${user.name} turned on two-factor authentication`, userId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });
  return { backupCodes };
}

/** Turns 2FA off — needs a current authenticator or backup code, and is refused while 2FA is required. */
export async function disableTwoFactor(input: SecondFactorInput, ctx: Ctx) {
  if (await adminTwoFactorRequired()) throw Errors.forbidden("Two-factor authentication is required for administrators and cannot be turned off.");
  await verifyUserSecondFactor(ctx.user.id, input, ctx);
  const user = await db.$transaction(async (tx) => {
    await tx.twoFactorBackupCode.deleteMany({ where: { userId: ctx.user.id } });
    return tx.user.update({
      where: { id: ctx.user.id },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, totpPendingSecretEnc: null, totpPendingAt: null },
      select: { id: true, name: true, email: true },
    });
  });
  await audit({ user: ctx.user, action: "2fa_disabled", module: "security", recordType: "User", recordId: user.id, description: `${ctx.user.name} turned off two-factor authentication`, ip: ctx.ip, userAgent: ctx.userAgent });
  if (user.email) void sendSecurityEmail({ userId: user.id, email: user.email, event: "TWO_FACTOR_DISABLED", data: { name: user.name, time: istTime() } });
  await raiseSecurityAlert({ type: "TWO_FACTOR_DISABLED", severity: "warning", title: `${user.name} turned off two-factor authentication`, userId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });
}

/** New backup codes (the old ones stop working) — needs a current authenticator code. */
export async function regenerateBackupCodes(code: string, ctx: Ctx): Promise<{ backupCodes: string[] }> {
  await verifyUserSecondFactor(ctx.user.id, { code }, ctx);
  const backupCodes = await replaceBackupCodes(ctx.user.id);
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { name: true, email: true } });
  await audit({ user: ctx.user, action: "2fa_backup_codes", module: "security", recordType: "User", recordId: ctx.user.id, description: `${ctx.user.name} created new two-factor backup codes`, ip: ctx.ip, userAgent: ctx.userAgent });
  if (user.email) void sendSecurityEmail({ userId: ctx.user.id, email: user.email, event: "BACKUP_CODES_REGENERATED", data: { name: user.name, time: istTime() } });
  await raiseSecurityAlert({ type: "BACKUP_CODES_REGENERATED", severity: "info", title: `${user.name} created new backup codes`, userId: ctx.user.id, ip: ctx.ip, userAgent: ctx.userAgent });
  return { backupCodes };
}

// ───────────────────────────── Super Admin reset ─────────────────────────────

/**
 * Clears another administrator's 2FA and signs them out everywhere. Super Admin only (the route
 * enforces the role); a Super Admin cannot reset their own — that is the recovery script's job, so a
 * stolen session alone can never remove its owner's second factor.
 */
export async function resetTwoFactorFor(targetUserId: string, ctx: Ctx) {
  if (ctx.user.role !== "SUPER_ADMIN") throw Errors.forbidden();
  if (targetUserId === ctx.user.id) throw Errors.badRequest("You cannot reset your own two-factor authentication here. Use a backup code, or the server recovery script.");
  const target = await db.user.findFirst({ where: { id: targetUserId, deletedAt: null, role: { in: ["SUPER_ADMIN", "STAFF"] } }, select: { id: true, name: true, email: true, totpEnabledAt: true } });
  if (!target) throw Errors.notFound("Administrator");
  await db.$transaction(async (tx) => {
    await tx.twoFactorBackupCode.deleteMany({ where: { userId: target.id } });
    await tx.user.update({
      where: { id: target.id },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, totpPendingSecretEnc: null, totpPendingAt: null, mfaFailedCount: 0, mfaLockedUntil: null },
    });
  });
  const revoked = await revokeAllSessions(target.id);
  await audit({ user: ctx.user, action: "2fa_reset", module: "security", recordType: "User", recordId: target.id, description: `${ctx.user.name} reset two-factor authentication for ${target.name} and signed out ${revoked} session(s)`, ip: ctx.ip, userAgent: ctx.userAgent });
  if (target.email) void sendSecurityEmail({ userId: target.id, email: target.email, event: "TWO_FACTOR_RESET", data: { name: target.name, actor: ctx.user.name, time: istTime() } });
  await raiseSecurityAlert({ type: "TWO_FACTOR_RESET", severity: "warning", title: `${ctx.user.name} reset two-factor authentication for ${target.name}`, userId: target.id, ip: ctx.ip, userAgent: ctx.userAgent });
  return { revokedSessions: revoked };
}
