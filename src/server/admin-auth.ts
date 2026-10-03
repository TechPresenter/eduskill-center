import { randomBytes, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { encryptSecret, isEncryptionConfigured, keyedHash, sameHex, sha256, decryptSecret } from "@/lib/crypto";
import { createSession, type AuthMethod } from "@/lib/auth/session";
import { adminPasswordLoginEnabled, adminTwoFactorRequired } from "@/lib/auth/policy";
import { deviceLabel, hashDeviceId, ipNetwork, maskIp } from "@/lib/auth/device";
import { generateTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { checkRateLimit, enforceRateLimitStrict, hashedRateKey } from "@/lib/rate-limit";
import { isEmailConfigured, sendSecurityEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { buildSetupPayload, replaceBackupCodes, verifyUserSecondFactor, type SecondFactorInput, type SetupPayload } from "@/server/two-factor";
import { istTime, raiseSecurityAlert } from "@/server/security-alerts";

/**
 * Secure Admin Login — the sign-in flow for SUPER_ADMIN and STAFF accounts.
 *
 *   1. email            → a 6-digit code is emailed (Passwordless Secure Login)
 *      (or a password, while ADMIN_PASSWORD_LOGIN is on)
 *   2. the email code   → verified against THIS browser's challenge
 *   3. authenticator    → when 2FA is on (or a backup code); first-time set-up when 2FA is required
 *   4. a brand-new session token is minted; nothing before this step can open /admin
 *
 * Every step runs against an AuthChallenge bound to the browser by the httpOnly esk_auth cookie, so
 * someone who only knows an admin's email address can neither verify, replace nor burn the codes of
 * the admin's own sign-in. Requests for an address that is not an active administrator get the same
 * neutral answer and the same flow — just no email.
 *
 * Codes: 6 digits, 10 minutes, 5 tries each, single use, keyed hash only (bound to the challenge),
 * never logged, never returned, never in a URL.
 */

export const CHALLENGE_TTL_MINUTES = 15;
export const ADMIN_OTP_TTL_MINUTES = 10;
export const ADMIN_OTP_MAX_ATTEMPTS = 5;
/** The UI counts down this long before "Resend code" is enabled. */
export const ADMIN_OTP_RESEND_AFTER_SEC = 45;
const ADMIN_OTP_MIN_GAP_MS = (ADMIN_OTP_RESEND_AFTER_SEC - 5) * 1000;
const MAX_CODES_PER_CHALLENGE = 5;
const MAX_VERIFY_ATTEMPTS_PER_CHALLENGE = 12;
/** Codes one browser on one network may have sent to one address per hour. */
const OTP_REQUESTS_PER_SOURCE_PER_HOUR = 5;
/** All sources together, per address — skipped for a browser that has signed in to the account before. */
const OTP_REQUESTS_PER_EMAIL_PER_HOUR = 30;
/** Codes one network may have emailed per hour (to any address), from browsers not seen before. */
const OTP_CODES_PER_IP_PER_HOUR = 30;
/**
 * Code requests per network per 15 minutes. Generous on purpose: a whole office or centre behind one
 * NAT signs in from the same address, and the quotas above are what keep email volume down.
 */
const OTP_REQUESTS_PER_IP_PER_15_MIN = 60;
/** A well-formed UUID no account has: the "known device" query runs (and misses) for unknown addresses too. */
const NO_USER_ID = "00000000-0000-0000-0000-000000000000";

export const ADMIN_OTP_NEUTRAL_MESSAGE = "If this email belongs to an administrator, we have sent a 6-digit code to it.";
const BAD_CODE = "That code is not correct. Please check the email and try again.";
const NO_CODE = "This code has expired. Please request a new code.";
const CODE_LOCKED = "Too many wrong attempts for this code. Please request a new code.";
const RESTART = "This sign-in has expired. Please start again.";

export type ChallengeStage = "OTP" | "SECOND_FACTOR" | "ENROLL" | "RECOVERY" | "DONE";

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  /** The esk_device cookie value (see ensureDeviceId). */
  deviceId?: string | null;
}

export interface ChallengeState {
  stage: ChallengeStage;
  /** "in••@eduskillindia.com" */
  emailHint: string | null;
  firstFactor: "EMAIL_OTP" | "PASSWORD" | null;
  expiresInSec: number;
  resendAfterSec: number;
  codeTtlMinutes: number;
}

export interface CompletedLogin {
  token: string;
  expiresAt: Date;
  sessionId: string;
  redirect: string;
}

export type StepResult =
  | { step: "totp"; state: ChallengeState }
  | { step: "enroll"; state: ChallengeState }
  | { step: "done"; session: CompletedLogin; backupCodes?: string[] };

// ───────────────────────────── helpers ─────────────────────────────

export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "••••";
  const keep = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${keep}${"•".repeat(Math.max(2, Math.min(6, local.length - keep.length)))}@${domain}`;
}

/** Only an /admin path may be the post-sign-in destination of the admin flow. */
export function safeAdminNext(next: string | null | undefined): string {
  // Control characters are refused like in postLoginRedirect: browsers strip TAB/CR/LF from URLs.
  if (next && /^\/admin(\/|$|\?)/.test(next) && !next.startsWith("//") && !/[\u0000-\u001f\u007f\\]/.test(next)) return next.slice(0, 500);
  return "/admin/dashboard";
}

function hashOtp(challengeId: string, userId: string, code: string) {
  return keyedHash("admin-login-otp", `${challengeId}:${userId}:${code}`);
}

const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  deletedAt: true,
  totpEnabledAt: true,
  emailVerifiedAt: true,
} as const;

async function findActiveAdminByEmail(email: string) {
  return db.user.findFirst({
    where: { email, role: { in: ["SUPER_ADMIN", "STAFF"] }, status: "ACTIVE", deletedAt: null },
    select: ADMIN_USER_SELECT,
  });
}

async function loadChallenge(token: string | null | undefined, stages: ChallengeStage[]) {
  if (!token || token.length < 20 || token.length > 100) throw Errors.unauthorized(RESTART);
  const ch = await db.authChallenge.findUnique({ where: { tokenHash: sha256(`challenge:${token}`) } });
  if (!ch || ch.completedAt || ch.expiresAt < new Date() || ch.purpose !== "ADMIN_LOGIN") throw Errors.unauthorized(RESTART);
  if (!stages.includes(ch.stage as ChallengeStage)) throw Errors.unauthorized(RESTART);
  return ch;
}

/**
 * The cooldown comes from the challenge's own `codeSentAt`, which is stamped for every address — an
 * address that is not an administrator "gets" a code at the same moments a real one would, so the
 * numbers on screen never reveal which is which.
 */
async function stateOf(ch: { id: string; stage: string; emailHint: string | null; firstFactor: string | null; expiresAt: Date; codeSentAt: Date | null }): Promise<ChallengeState> {
  const resendAfterSec =
    ch.stage === "OTP" && ch.codeSentAt ? Math.max(0, Math.ceil((ch.codeSentAt.getTime() + ADMIN_OTP_RESEND_AFTER_SEC * 1000 - Date.now()) / 1000)) : 0;
  return {
    stage: ch.stage as ChallengeStage,
    emailHint: ch.emailHint,
    firstFactor: (ch.firstFactor as ChallengeState["firstFactor"]) ?? null,
    expiresInSec: Math.max(0, Math.floor((ch.expiresAt.getTime() - Date.now()) / 1000)),
    resendAfterSec,
    codeTtlMinutes: ADMIN_OTP_TTL_MINUTES,
  };
}

async function newChallenge(input: { userId: string | null; stage: ChallengeStage; firstFactor: "EMAIL_OTP" | "PASSWORD" | null; email: string | null; next?: string | null; codeSent?: boolean } & RequestMeta) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000);
  const ch = await db.authChallenge.create({
    data: {
      tokenHash: sha256(`challenge:${token}`),
      userId: input.userId,
      purpose: "ADMIN_LOGIN",
      stage: input.stage,
      firstFactor: input.firstFactor,
      codesSent: input.codeSent ? 1 : 0,
      codeSentAt: input.codeSent ? new Date() : null,
      emailHash: input.email ? keyedHash("admin-email", input.email) : null,
      emailHint: input.email ? maskEmail(input.email) : null,
      next: safeAdminNext(input.next),
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt, challenge: ch };
}

async function recordLogin(input: { userId: string | null; identifier: string; success: boolean; reason?: string; method?: string; deviceIdHash?: string | null; newDevice?: boolean; suspicious?: boolean } & RequestMeta) {
  await db.loginHistory
    .create({
      data: {
        userId: input.userId,
        identifier: input.identifier.slice(0, 190),
        success: input.success,
        reason: input.reason ?? null,
        method: input.method ?? null,
        deviceIdHash: input.deviceIdHash ?? null,
        newDevice: input.newDevice ?? false,
        suspicious: input.suspicious ?? false,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    })
    .catch(() => undefined);
}

/** What the admin sign-in screen can offer right now. Reveals nothing about any account. */
export async function adminLoginOptions() {
  return { emailOtp: await isEmailConfigured(), password: adminPasswordLoginEnabled() };
}

// ───────────────────────────── 1. request a code ─────────────────────────────

async function issueAndSendCode(ch: { id: string }, user: { id: string; name: string; email: string | null }, meta: RequestMeta) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await db.$transaction([
    // Only the newest code of this challenge is ever valid.
    db.loginOtp.updateMany({ where: { challengeId: ch.id, purpose: "ADMIN_LOGIN", consumedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } }),
    db.loginOtp.create({
      data: {
        userId: user.id,
        purpose: "ADMIN_LOGIN",
        challengeId: ch.id,
        codeHash: hashOtp(ch.id, user.id, code),
        expiresAt: new Date(now.getTime() + ADMIN_OTP_TTL_MINUTES * 60_000),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
      },
    }),
  ]);
  // Delivered in the background so the response time never depends on whether the address exists.
  // The stored notification row is redacted; a failed delivery raises a Security Center alert.
  void sendSecurityEmail({
    userId: user.id,
    email: user.email!,
    event: "ADMIN_LOGIN_OTP",
    data: { name: user.name, code, minutes: ADMIN_OTP_TTL_MINUTES, device: deviceLabel(meta.userAgent), ip: meta.ip ?? "unknown", time: istTime() },
    redact: ["code"],
  }).then((res) => {
    if (!res.ok) {
      void raiseSecurityAlert({
        type: "OTP_DELIVERY_FAILED",
        severity: "critical",
        title: `A sign-in code could not be emailed to ${maskEmail(user.email!)}`,
        detail: `The SMTP server refused or could not be reached: ${res.error ?? "unknown error"}. Check Admin → Settings → Communication.`,
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
  });
}

/**
 * Code quota. Over a limit: still the neutral answer, just no email (and one alert).
 *
 * The strict limit is keyed on the address AND the requesting browser/network, so a stranger who
 * knows an administrator's address can only use up their own share — never the administrator's.
 * The looser per-address cap (all sources together) is an anti-spam backstop; a browser that has
 * already signed in to this account successfully is exempt from it, so flooding an address cannot
 * keep its owner out. The per-network cap bounds how many codes one IP can have emailed in total.
 */
async function emailQuotaAllows(email: string, user: { id: string; name: string } | null, meta: RequestMeta) {
  const ip = meta.ip ?? "unknown";
  const deviceIdHash = meta.deviceId ? hashDeviceId(meta.deviceId) : "";
  const own = await checkRateLimit(hashedRateKey("admin-otp:email-src", `${email}|${ip}|${deviceIdHash}`), OTP_REQUESTS_PER_SOURCE_PER_HOUR, 3600);
  if (!own.allowed) return false;

  // Queried for every address alike (an unknown one simply never matches), so timing tells nothing.
  const knownDevice = deviceIdHash
    ? await db.loginHistory.findFirst({ where: { userId: user?.id ?? NO_USER_ID, success: true, deviceIdHash }, select: { id: true } })
    : null;
  if (knownDevice) return true;

  const fromNetwork = await checkRateLimit(`admin-otp:ip-codes:${ip}`, OTP_CODES_PER_IP_PER_HOUR, 3600);
  if (!fromNetwork.allowed) return false;
  const r = await checkRateLimit(hashedRateKey("admin-otp:email", email), OTP_REQUESTS_PER_EMAIL_PER_HOUR, 3600);
  if (!r.allowed && user && r.remaining === 0) {
    const once = await checkRateLimit(hashedRateKey("admin-otp:abuse-alert", email), 1, 3600);
    if (once.allowed) {
      await raiseSecurityAlert({
        type: "OTP_ABUSE",
        severity: "warning",
        title: `Many sign-in codes requested for ${user.name}`,
        detail: `More than ${OTP_REQUESTS_PER_EMAIL_PER_HOUR} codes were requested in an hour from browsers this administrator has not signed in from. Codes for those browsers are held back for an hour; browsers that have signed in before still get theirs.`,
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
  }
  return r.allowed;
}

/** Expires the live code of a challenge (used when a resend could not issue a new one). */
async function expireChallengeCodes(challengeId: string) {
  const now = new Date();
  await db.loginOtp.updateMany({ where: { challengeId, purpose: "ADMIN_LOGIN", consumedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } });
}

export async function startAdminEmailOtp(input: { email: string; next?: string | null } & RequestMeta) {
  await enforceRateLimitStrict(`admin-otp:ip:${input.ip ?? "unknown"}`, OTP_REQUESTS_PER_IP_PER_15_MIN, 900);
  const email = normalizeAdminEmail(input.email);
  const user = await findActiveAdminByEmail(email);
  const allowed = await emailQuotaAllows(email, user, input);
  const { token, expiresAt, challenge } = await newChallenge({ ...input, userId: user?.id ?? null, stage: "OTP", firstFactor: null, email, next: input.next, codeSent: true });
  if (user && allowed) await issueAndSendCode(challenge, user, input);
  await audit({ action: "admin_otp_requested", module: "auth", recordType: "AuthChallenge", recordId: challenge.id, description: `Admin sign-in code requested for ${maskEmail(email)}`, ip: input.ip, userAgent: input.userAgent });
  return { challengeToken: token, expiresAt, message: ADMIN_OTP_NEUTRAL_MESSAGE, state: await stateOf(challenge) };
}

export async function resendAdminEmailOtp(token: string | null, meta: RequestMeta) {
  await enforceRateLimitStrict(`admin-otp-resend:ip:${meta.ip ?? "unknown"}`, 15, 900);
  const ch = await loadChallenge(token, ["OTP"]);
  // The gap and the cap are counted on the challenge for every address alike, so neither answer
  // (a quiet "already sent", or 429 after the fifth code) tells an administrator from anyone else.
  if (ch.codeSentAt && Date.now() - ch.codeSentAt.getTime() < ADMIN_OTP_MIN_GAP_MS) return { message: ADMIN_OTP_NEUTRAL_MESSAGE, state: await stateOf(ch) };
  if (ch.codesSent >= MAX_CODES_PER_CHALLENGE) throw Errors.tooMany(60);
  // Claimed atomically: two resends racing each other cannot both pass the cap. The per-code attempt
  // counter is reset for every address alike (so the answers never differ), which is why a resend
  // that cannot issue a new code must expire the old one: otherwise the reset would hand that code
  // a fresh set of guesses.
  const claimed = await db.authChallenge.updateMany({
    where: { id: ch.id, codesSent: ch.codesSent },
    data: { codesSent: { increment: 1 }, codeSentAt: new Date(), codeAttempts: 0 },
  });
  if (claimed.count === 1 && ch.userId) {
    const user = await db.user.findFirst({ where: { id: ch.userId, status: "ACTIVE", deletedAt: null }, select: { id: true, name: true, email: true } });
    if (user?.email && (await emailQuotaAllows(user.email, user, meta))) await issueAndSendCode(ch, user, meta);
    else await expireChallengeCodes(ch.id);
  }
  return { message: ADMIN_OTP_NEUTRAL_MESSAGE, state: await stateOf(await db.authChallenge.findUniqueOrThrow({ where: { id: ch.id } })) };
}

export async function getAdminChallengeState(token: string | null): Promise<ChallengeState | null> {
  try {
    return await stateOf(await loadChallenge(token, ["OTP", "SECOND_FACTOR", "ENROLL"]));
  } catch {
    return null;
  }
}

export async function cancelAdminChallenge(token: string | null) {
  if (!token) return;
  await db.authChallenge.updateMany({ where: { tokenHash: sha256(`challenge:${token}`), completedAt: null }, data: { expiresAt: new Date() } }).catch(() => undefined);
}

// ───────────────────────────── 2. verify the emailed code ─────────────────────────────

export async function verifyAdminEmailOtp(token: string | null, code: string, meta: RequestMeta): Promise<StepResult> {
  const ch = await loadChallenge(token, ["OTP"]);
  const bumped = await db.authChallenge.updateMany({ where: { id: ch.id, attempts: { lt: MAX_VERIFY_ATTEMPTS_PER_CHALLENGE } }, data: { attempts: { increment: 1 } } });
  if (bumped.count !== 1) {
    await cancelAdminChallenge(token);
    throw Errors.unauthorized(RESTART);
  }
  const identifier = `admin-email:${ch.emailHint ?? "unknown"}`;

  // Expiry and the wrong-code lock are judged on the challenge, the same way for an address that is
  // not an administrator (no code was ever emailed) as for one whose code is in their inbox — and a
  // real administrator held back by the per-address quota simply has a code that never matches.
  if (!ch.codeSentAt || ch.codeSentAt.getTime() + ADMIN_OTP_TTL_MINUTES * 60_000 <= Date.now()) {
    await recordLogin({ userId: ch.userId, identifier, success: false, reason: "otp_expired", method: "EMAIL_OTP", ...meta });
    throw Errors.unauthorized(NO_CODE);
  }
  // Every guess claims one of the code's attempts up front, atomically, so parallel guesses cannot
  // slip past the limit.
  const claim = await db.authChallenge.updateMany({ where: { id: ch.id, codeAttempts: { lt: ADMIN_OTP_MAX_ATTEMPTS } }, data: { codeAttempts: { increment: 1 } } });
  if (claim.count !== 1) {
    await recordLogin({ userId: ch.userId, identifier, success: false, reason: "otp_locked", method: "EMAIL_OTP", ...meta });
    throw Errors.unauthorized(CODE_LOCKED);
  }
  const otp = ch.userId
    ? await db.loginOtp.findFirst({
        where: { challengeId: ch.id, userId: ch.userId, purpose: "ADMIN_LOGIN", consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const clean = code.replace(/\s/g, "");
  if (!otp || !ch.userId || !/^\d{6}$/.test(clean) || !sameHex(hashOtp(ch.id, ch.userId, clean), otp.codeHash)) {
    if (otp) await db.loginOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const locked = ch.codeAttempts + 1 >= ADMIN_OTP_MAX_ATTEMPTS;
    await recordLogin({ userId: ch.userId, identifier, success: false, reason: locked ? "otp_locked" : "otp_bad_code", method: "EMAIL_OTP", ...meta });
    throw Errors.unauthorized(locked ? CODE_LOCKED : BAD_CODE);
  }
  const consumed = await db.loginOtp.updateMany({
    where: { id: otp.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) throw Errors.unauthorized(NO_CODE);

  const user = await db.user.findFirst({ where: { id: ch.userId, status: "ACTIVE", deletedAt: null, role: { in: ["SUPER_ADMIN", "STAFF"] } }, select: ADMIN_USER_SELECT });
  if (!user) throw Errors.unauthorized(RESTART);
  // A correct code proves the mailbox.
  if (!user.emailVerifiedAt) await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

  return advanceAfterFirstFactor(ch.id, user, "EMAIL_OTP", meta);
}

/** After the first factor: authenticator step, forced enrolment, or straight in. */
async function advanceAfterFirstFactor(challengeId: string, user: { id: string; name: string; email: string | null; role: string; totpEnabledAt: Date | null }, firstFactor: "EMAIL_OTP" | "PASSWORD", meta: RequestMeta): Promise<StepResult> {
  if (user.totpEnabledAt) {
    const ch = await db.authChallenge.update({ where: { id: challengeId }, data: { stage: "SECOND_FACTOR", firstFactor } });
    return { step: "totp", state: await stateOf(ch) };
  }
  if (await adminTwoFactorRequired()) {
    const ch = await db.authChallenge.update({ where: { id: challengeId }, data: { stage: "ENROLL", firstFactor } });
    return { step: "enroll", state: await stateOf(ch) };
  }
  const session = await completeAdminLogin({ challengeId, userId: user.id, firstFactor, secondFactor: null, meta });
  return { step: "done", session };
}

// ───────────────────────────── password as the first factor ─────────────────────────────

/**
 * Called by login() after an administrator's password checked out. Returns a challenge when a
 * second factor is needed (the route sets the cookie and sends the browser to /login/admin), or a
 * completed session when it is not.
 */
export async function adminPasswordSignIn(user: { id: string; name: string; email: string | null; role: string; totpEnabledAt: Date | null }, meta: RequestMeta & { next?: string | null }):
  Promise<{ kind: "challenge"; challengeToken: string; expiresAt: Date; stage: ChallengeStage } | { kind: "session"; session: CompletedLogin }> {
  if (!adminPasswordLoginEnabled()) throw Errors.unauthorized("Administrators sign in with Passwordless Secure Login. Use the email code on the admin sign-in page.");
  const needsSecond = !!user.totpEnabledAt || (await adminTwoFactorRequired());
  const { token, expiresAt, challenge } = await newChallenge({
    userId: user.id,
    stage: user.totpEnabledAt ? "SECOND_FACTOR" : needsSecond ? "ENROLL" : "OTP",
    firstFactor: "PASSWORD",
    email: user.email,
    next: meta.next,
    ...meta,
  });
  if (needsSecond) return { kind: "challenge", challengeToken: token, expiresAt, stage: challenge.stage as ChallengeStage };
  const session = await completeAdminLogin({ challengeId: challenge.id, userId: user.id, firstFactor: "PASSWORD", secondFactor: null, meta });
  return { kind: "session", session };
}

// ───────────────────────────── 3a. authenticator / backup code ─────────────────────────────

export async function verifyAdminSecondFactor(token: string | null, input: SecondFactorInput, meta: RequestMeta): Promise<StepResult> {
  const ch = await loadChallenge(token, ["SECOND_FACTOR"]);
  if (!ch.userId) throw Errors.unauthorized(RESTART);
  // Same per-challenge cap as the email-code and enrolment steps: one challenge cannot be used for
  // an unlimited number of guesses during its lifetime.
  const bumped = await db.authChallenge.updateMany({ where: { id: ch.id, attempts: { lt: MAX_VERIFY_ATTEMPTS_PER_CHALLENGE } }, data: { attempts: { increment: 1 } } });
  if (bumped.count !== 1) {
    await cancelAdminChallenge(token);
    throw Errors.unauthorized(RESTART);
  }
  let method;
  try {
    method = await verifyUserSecondFactor(ch.userId, input, meta);
  } catch (err) {
    await recordLogin({ userId: ch.userId, identifier: `admin-email:${ch.emailHint ?? ""}`, success: false, reason: input.backupCode ? "backup_bad_code" : "totp_bad_code", method: input.backupCode ? "BACKUP_CODE" : "TOTP", ...meta });
    throw err;
  }
  const session = await completeAdminLogin({ challengeId: ch.id, userId: ch.userId, firstFactor: (ch.firstFactor as "EMAIL_OTP" | "PASSWORD") ?? "EMAIL_OTP", secondFactor: method, meta });
  return { step: "done", session };
}

// ───────────────────────────── 3b. first-time authenticator set-up (2FA required) ─────────────────────────────

export async function beginAdminEnrollment(token: string | null): Promise<SetupPayload> {
  const ch = await loadChallenge(token, ["ENROLL"]);
  if (!ch.userId) throw Errors.unauthorized(RESTART);
  if (!isEncryptionConfigured()) throw Errors.badRequest("Two-factor set-up is not available on this server yet. Contact the server administrator.");
  const user = await db.user.findUniqueOrThrow({ where: { id: ch.userId }, select: { email: true, name: true } });
  // The secret is shown only while set-up is unfinished; after confirmation it is never returned.
  let secret: string;
  if (ch.pendingSecretEnc) {
    secret = decryptSecret(ch.pendingSecretEnc);
  } else {
    secret = generateTotpSecret();
    await db.authChallenge.update({ where: { id: ch.id }, data: { pendingSecretEnc: encryptSecret(secret), secretShownAt: new Date() } });
  }
  return buildSetupPayload(secret, user.email ?? user.name);
}

export async function confirmAdminEnrollment(token: string | null, code: string, meta: RequestMeta): Promise<StepResult> {
  const ch = await loadChallenge(token, ["ENROLL"]);
  if (!ch.userId || !ch.pendingSecretEnc) throw Errors.badRequest("Scan the QR code first.");
  const bumped = await db.authChallenge.updateMany({ where: { id: ch.id, attempts: { lt: MAX_VERIFY_ATTEMPTS_PER_CHALLENGE } }, data: { attempts: { increment: 1 } } });
  if (bumped.count !== 1) {
    await cancelAdminChallenge(token);
    throw Errors.unauthorized(RESTART);
  }
  const secret = decryptSecret(ch.pendingSecretEnc);
  const step = verifyTotp(secret, code);
  if (step === null) throw Errors.unauthorized("That code is not correct. Check the time on your phone and enter the newest code.");
  const userId = ch.userId;
  const backupCodes = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { totpSecretEnc: ch.pendingSecretEnc, totpEnabledAt: new Date(), totpLastStep: step, totpPendingSecretEnc: null, totpPendingAt: null, mfaFailedCount: 0, mfaLockedUntil: null },
    });
    await tx.authChallenge.update({ where: { id: ch.id }, data: { pendingSecretEnc: null } });
    return replaceBackupCodes(userId, tx);
  });
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, role: true } });
  await audit({ user: { id: userId, name: user.name, role: user.role }, action: "2fa_enabled", module: "security", recordType: "User", recordId: userId, description: `${user.name} set up two-factor authentication while signing in`, ip: meta.ip, userAgent: meta.userAgent });
  if (user.email) void sendSecurityEmail({ userId, email: user.email, event: "TWO_FACTOR_ENABLED", data: { name: user.name, time: istTime() } });
  await raiseSecurityAlert({ type: "TWO_FACTOR_ENABLED", severity: "info", title: `${user.name} set up two-factor authentication`, userId, ip: meta.ip, userAgent: meta.userAgent });
  const session = await completeAdminLogin({ challengeId: ch.id, userId, firstFactor: (ch.firstFactor as "EMAIL_OTP" | "PASSWORD") ?? "EMAIL_OTP", secondFactor: "TOTP", meta });
  return { step: "done", session, backupCodes };
}

// ───────────────────────────── 4. the session ─────────────────────────────

/**
 * Consumes the challenge exactly once and mints a NEW session token. Records login history with the
 * device, detects a new device / unfamiliar network, and notifies.
 */
export async function completeAdminLogin(input: {
  challengeId: string | null;
  userId: string;
  firstFactor: "EMAIL_OTP" | "PASSWORD" | "RECOVERY";
  secondFactor: "TOTP" | "BACKUP_CODE" | null;
  meta: RequestMeta;
  /** Break-glass recovery only: the server-side link stands in for every factor. */
  mfaSatisfied?: boolean;
}): Promise<CompletedLogin> {
  let next = "/admin/dashboard";
  if (input.challengeId) {
    const done = await db.authChallenge.updateMany({ where: { id: input.challengeId, completedAt: null, expiresAt: { gt: new Date() } }, data: { completedAt: new Date(), stage: "DONE" } });
    if (done.count !== 1) throw Errors.unauthorized(RESTART);
    const ch = await db.authChallenge.findUnique({ where: { id: input.challengeId }, select: { next: true } });
    next = safeAdminNext(ch?.next);
  }
  const user = await db.user.findFirst({ where: { id: input.userId, status: "ACTIVE", deletedAt: null }, select: { id: true, name: true, email: true, role: true } });
  if (!user) throw Errors.unauthorized(RESTART);
  const { ip, userAgent, deviceId } = input.meta;
  const deviceIdHash = deviceId ? hashDeviceId(deviceId) : null;

  const priorSuccess = await db.loginHistory.findFirst({ where: { userId: user.id, success: true }, select: { id: true } });
  const knownDevice = deviceIdHash ? await db.loginHistory.findFirst({ where: { userId: user.id, success: true, deviceIdHash }, select: { id: true } }) : null;
  const newDevice = !knownDevice;
  const network = ipNetwork(ip);
  const since = new Date(Date.now() - 60 * 24 * 60 * 60_000);
  const knownNetwork = network ? await db.loginHistory.findFirst({ where: { userId: user.id, success: true, createdAt: { gt: since }, ip: { startsWith: network.includes(":") ? `${network}:` : `${network}.` } }, select: { id: true } }) : null;
  const suspicious = !!priorSuccess && newDevice && !knownNetwork;

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
  const authMethod: AuthMethod = input.firstFactor === "PASSWORD" ? "PASSWORD" : input.firstFactor === "RECOVERY" ? "RECOVERY" : "EMAIL_OTP";
  const session = await createSession(user.id, { role: user.role, authMethod, mfa: !!input.secondFactor || input.mfaSatisfied === true, deviceIdHash, ip, userAgent });
  const method = [input.firstFactor, input.secondFactor].filter(Boolean).join("+");
  await recordLogin({ userId: user.id, identifier: user.email ?? user.id, success: true, method, deviceIdHash, newDevice, suspicious, ip, userAgent });
  await audit({
    user: { id: user.id, name: user.name, role: user.role },
    action: "login",
    module: "auth",
    recordType: "User",
    recordId: user.id,
    description: `${user.name} signed in to the admin panel (${method.replace(/_/g, " ").toLowerCase()})${newDevice ? " from a new device" : ""}`,
    ip,
    userAgent,
  });

  if (priorSuccess && newDevice) {
    const methodLabel = { EMAIL_OTP: "Email code", PASSWORD: "Password", RECOVERY: "Recovery link" }[input.firstFactor] + (input.secondFactor === "TOTP" ? " + authenticator" : input.secondFactor === "BACKUP_CODE" ? " + backup code" : "");
    const alertsOn = (await getSetting<boolean>("security.newDeviceAlerts").catch(() => true)) !== false;
    if (alertsOn && user.email) {
      void sendSecurityEmail({ userId: user.id, email: user.email, event: "NEW_DEVICE_LOGIN", data: { name: user.name, device: deviceLabel(userAgent), ip: ip ?? "unknown", time: istTime(), method: methodLabel } });
    }
    await raiseSecurityAlert({
      type: suspicious ? "SUSPICIOUS_LOGIN" : "NEW_DEVICE_LOGIN",
      severity: suspicious ? "warning" : "info",
      title: suspicious ? `Sign-in to ${user.name} from a new device on an unfamiliar network` : `${user.name} signed in from a new device`,
      detail: `${deviceLabel(userAgent)} · IP ${maskIp(ip)} · ${methodLabel}`,
      userId: user.id,
      ip,
      userAgent,
    });
  }
  return { token: session.token, expiresAt: session.expiresAt, sessionId: session.sessionId, redirect: next };
}

// ───────────────────────────── break-glass recovery ─────────────────────────────

const RECOVERY_TTL_MINUTES = 15;

/**
 * A one-time sign-in link for an administrator who is locked out (email down, phone lost). Issued
 * ONLY by the shell script `scripts/admin-recovery.ts` on the server — there is no HTTP endpoint
 * that creates one, because server access is already the highest privilege. Valid 15 minutes,
 * single use, raises a critical Security Center alert, and the session counts as fully verified.
 */
export async function createRecoveryLink(userId: string, issuedBy: string): Promise<{ token: string; expiresAt: Date; name: string }> {
  const user = await db.user.findFirst({ where: { id: userId, role: { in: ["SUPER_ADMIN", "STAFF"] }, status: "ACTIVE", deletedAt: null }, select: { id: true, name: true, email: true } });
  if (!user) throw Errors.notFound("Active administrator");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RECOVERY_TTL_MINUTES * 60_000);
  await db.authChallenge.create({
    data: { tokenHash: sha256(`challenge:${token}`), userId: user.id, purpose: "ADMIN_LOGIN", stage: "RECOVERY", firstFactor: "RECOVERY", emailHint: user.email ? maskEmail(user.email) : null, next: "/admin/account/security", expiresAt },
  });
  await audit({ action: "recovery_link", module: "security", recordType: "User", recordId: user.id, description: `A one-time recovery sign-in link was issued for ${user.name} from the server (${issuedBy})` });
  await raiseSecurityAlert({ type: "RECOVERY_LOGIN", severity: "critical", title: `A recovery sign-in link was issued for ${user.name}`, detail: `Issued on the server by ${issuedBy}. Valid ${RECOVERY_TTL_MINUTES} minutes, single use.`, userId: user.id });
  return { token, expiresAt, name: user.name };
}

export async function consumeRecoveryLink(token: string | null, meta: RequestMeta): Promise<CompletedLogin> {
  const ch = await loadChallenge(token, ["RECOVERY"]);
  if (!ch.userId) throw Errors.unauthorized(RESTART);
  const session = await completeAdminLogin({ challengeId: ch.id, userId: ch.userId, firstFactor: "RECOVERY", secondFactor: null, meta, mfaSatisfied: true });
  await raiseSecurityAlert({ type: "RECOVERY_LOGIN", severity: "critical", title: "A recovery sign-in link was used", detail: `${deviceLabel(meta.userAgent)} · IP ${maskIp(meta.ip)}`, userId: ch.userId, ip: meta.ip, userAgent: meta.userAgent });
  return session;
}
