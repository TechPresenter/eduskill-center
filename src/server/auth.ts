import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, passwordIssue, verifyPassword } from "@/lib/auth/password";
import { createSession, revokeAllSessions, revokeSessionByToken } from "@/lib/auth/session";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { getPhoneChannels, isEmailConfigured, notify, notifyStaff } from "@/lib/notifications";
import { absoluteUrl } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { mobileVariants, parsePhone, samePhone, toE164 } from "@/lib/phone";
import { adminPasswordLoginEnabled, isAdminRole } from "@/lib/auth/policy";
import { checkRateLimit, peekRateLimit } from "@/lib/rate-limit";
import type { NotificationChannel, UserRole } from "@/generated/prisma/enums";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
/** Wrong passwords (any account) one IP may send per window before it is told to wait. */
const FAILED_LOGINS_PER_IP = 10;
const FAILED_LOGINS_WINDOW_SEC = 15 * 60;

type PasswordAttemptClaim = { ok: true; lockedNow: boolean } | { ok: false; lockedUntil: Date };

/**
 * Counts one password attempt for the account under a row lock, before the password is compared.
 * Refuses while the account is locked. The attempt that reaches MAX_FAILED_LOGINS sets the lock
 * itself, so no parallel guess can be compared after it; a correct password clears the count again.
 * An expired lock starts a fresh count.
 */
async function claimPasswordAttempt(userId: string): Promise<PasswordAttemptClaim> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { failedLoginCount: true, lockedUntil: true } });
    const now = Date.now();
    if (u.lockedUntil && u.lockedUntil.getTime() > now) return { ok: false as const, lockedUntil: u.lockedUntil };
    const count = (u.lockedUntil ? 0 : u.failedLoginCount) + 1;
    const lockedNow = count >= MAX_FAILED_LOGINS;
    await tx.user.update({ where: { id: userId }, data: { failedLoginCount: count, lockedUntil: lockedNow ? new Date(now + LOCK_MINUTES * 60_000) : null } });
    return { ok: true as const, lockedNow };
  });
}

async function countFailureFromIp(ip: string | null | undefined) {
  if (ip) await checkRateLimit(`login-fail:ip:${ip}`, FAILED_LOGINS_PER_IP, FAILED_LOGINS_WINDOW_SEC);
}

/**
 * The one canonical form of a phone number for storage and comparison: **E.164** (`+919876543210`).
 *
 * Returns `""` for anything that is not a phone number — an email address, `""`, junk — because
 * `login()` and `requestPasswordReset()` call it on whatever the user typed into the single
 * "email or mobile" box, and must not throw on an email.
 *
 * **Idempotent**, and that is load-bearing: `login-otp.ts` decides whether a typed number belongs to
 * an admission by normalising both sides and comparing. `tests/phone.test.ts` asserts it.
 *
 * Reading a stored number still works whatever spelling it is in, because every exact-match query
 * goes through `mobileVariants()` rather than comparing against this directly.
 */
export function normalizeMobile(mobile: string) {
  return toE164(mobile);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  /** esk_device cookie value — administrator sign-ins use it for new-device detection. */
  deviceId?: string | null;
}

/** A real bcrypt hash of a random string: unknown accounts still pay for one compare (no timing oracle). */
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(18).toString("base64url"));
  return dummyHash;
}

const GENERIC_LOGIN_ERROR = "Invalid email/mobile or password";

export type LoginResult =
  | { kind: "session"; user: { id: string; name: string; role: UserRole }; token: string; expiresAt: Date; sessionId: string; redirect?: string }
  | { kind: "challenge"; user: { id: string; name: string; role: UserRole }; challengeToken: string; challengeExpiresAt: Date };

/**
 * Password sign-in for every role. Failures are deliberately indistinguishable — unknown account,
 * wrong password, locked or inactive all read the same until the PASSWORD is proven — so the form
 * cannot be used to discover accounts. Administrators continue into Secure Admin Login
 * (authenticator step / 2FA set-up) whenever their policy requires a second factor.
 */
export async function login(input: { identifier: string; password: string; remember?: boolean; next?: string | null } & RequestMeta): Promise<LoginResult> {
  // Wrong passwords per network are capped here; successful sign-ins do not count, so a whole office
  // or computer lab behind one IP can still sign in (the route's own per-IP ceiling is generous).
  if (input.ip) {
    const failures = await peekRateLimit(`login-fail:ip:${input.ip}`, FAILED_LOGINS_PER_IP);
    if (!failures.allowed) throw Errors.tooMany(failures.retryAfterSec);
  }
  const raw = input.identifier.trim();
  const email = normalizeEmail(raw);
  // One free-text box for "email or mobile", so both readings are tried. `mobileVariants` is empty
  // when the input is not a phone number at all, and matches a stored number in any spelling —
  // E.164 for anything written since the country selector shipped, bare digits for older rows.
  const mobiles = mobileVariants(raw);
  const user = await db.user.findFirst({
    where: { deletedAt: null, OR: [{ email }, ...(mobiles.length ? [{ mobile: { in: mobiles } }] : [])] },
  });

  const record = (success: boolean, reason?: string) =>
    db.loginHistory.create({
      data: { userId: user?.id ?? null, identifier: raw.slice(0, 190), success, reason, method: "PASSWORD", ip: input.ip ?? null, userAgent: input.userAgent?.slice(0, 500) ?? null },
    });

  if (!user) {
    await verifyPassword(input.password, await getDummyHash());
    await record(false, "unknown_user");
    await countFailureFromIp(input.ip);
    throw Errors.unauthorized(GENERIC_LOGIN_ERROR);
  }

  // The attempt is claimed (counted) under a row lock BEFORE the slow bcrypt compare, so a burst of
  // parallel guesses cannot all read "not locked" from one stale snapshot: once the lock is set no
  // further password is ever checked for a session, and a correct password then clears the count.
  const claim = await claimPasswordAttempt(user.id);
  const ok = await verifyPassword(input.password, user.passwordHash);

  if (!ok) {
    if (claim.ok && claim.lockedNow && isAdminRole(user.role)) {
      const { raiseSecurityAlert } = await import("@/server/security-alerts");
      await raiseSecurityAlert({ type: "ACCOUNT_LOCKED", severity: "warning", title: `Password sign-in locked for ${user.name}`, detail: `${MAX_FAILED_LOGINS} wrong passwords. Password sign-in is paused for ${LOCK_MINUTES} minutes (the email-code sign-in still works).`, userId: user.id, ip: input.ip, userAgent: input.userAgent });
    }
    await record(false, claim.ok ? "bad_password" : "locked");
    await countFailureFromIp(input.ip);
    throw Errors.unauthorized(GENERIC_LOGIN_ERROR);
  }
  // The password is proven: from here the account's real state may be told.
  if (!claim.ok) {
    await record(false, "locked");
    const mins = Math.max(1, Math.ceil((claim.lockedUntil.getTime() - Date.now()) / 60000));
    throw Errors.unauthorized(`Too many failed attempts. The account is locked for ${mins} more minute${mins === 1 ? "" : "s"}.`);
  }
  // This attempt counted against the lock up front; a correct password clears it again.
  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  if (user.status !== "ACTIVE") {
    await record(false, "inactive");
    throw Errors.unauthorized("Your account is not active. Please contact the Foundation.");
  }

  if (isAdminRole(user.role)) {
    const { adminPasswordSignIn } = await import("@/server/admin-auth");
    await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    const res = await adminPasswordSignIn(user, { ip: input.ip, userAgent: input.userAgent, deviceId: input.deviceId, next: input.next });
    if (res.kind === "challenge") {
      await record(true, "password_ok_second_factor_pending");
      return { kind: "challenge", user: { id: user.id, name: user.name, role: user.role }, challengeToken: res.challengeToken, challengeExpiresAt: res.expiresAt };
    }
    return { kind: "session", user: { id: user.id, name: user.name, role: user.role }, token: res.session.token, expiresAt: res.session.expiresAt, sessionId: res.session.sessionId, redirect: res.session.redirect };
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await record(true);
  const session = await createSession(user.id, { ip: input.ip, userAgent: input.userAgent, remember: input.remember, role: user.role, authMethod: "PASSWORD" });
  await audit({ user: { id: user.id, name: user.name, role: user.role }, action: "login", module: "auth", recordType: "User", recordId: user.id, description: `${user.name} logged in`, ip: input.ip, userAgent: input.userAgent });
  return { kind: "session", user: { id: user.id, name: user.name, role: user.role }, ...session };
}

export async function logout(token: string, user?: { id: string; name: string; role: string } | null, meta: RequestMeta = {}) {
  await revokeSessionByToken(token);
  if (user) await audit({ user, action: "logout", module: "auth", recordType: "User", recordId: user.id, description: `${user.name} logged out`, ...meta });
}

export async function registerStudent(
  input: { name: string; email?: string | null; mobile: string; password: string; whatsapp?: string | null } & RequestMeta
) {
  const registrationOpen = await getSetting<boolean>("admissions.registrationOpen");
  if (!registrationOpen) throw Errors.forbidden("Student registration is currently closed.");

  const issue = passwordIssue(input.password);
  if (issue) throw Errors.validation("Please correct the highlighted fields.", { password: issue });

  // `registerSchema` has already validated and normalised this per selected country; re-checking the
  // shape here is belt and braces for the service's other callers, and must not assume India.
  const parsed = parsePhone(input.mobile);
  if (!parsed.ok) throw Errors.validation("Please correct the highlighted fields.", { mobile: parsed.message });
  const mobile = parsed.e164;
  const email = input.email ? normalizeEmail(input.email) : null;

  // Duplicate detection FAILS OPEN if this misses: a second account for a phone that already has
  // one, which `User.mobile @unique` cannot catch while a number can be stored in two spellings.
  // Hence every spelling, not just the canonical one.
  const clash = await db.user.findFirst({ where: { OR: [{ mobile: { in: mobileVariants(mobile) } }, ...(email ? [{ email }] : [])] }, select: { email: true, mobile: true } });
  if (clash) {
    const details: Record<string, string> = {};
    if (samePhone(clash.mobile, mobile)) details.mobile = "An account with this mobile number already exists";
    if (email && clash.email === email) details.email = "An account with this email already exists";
    throw Errors.validation("Account already exists. Please log in.", details);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      name: input.name.trim(),
      email,
      mobile,
      passwordHash,
      role: "STUDENT",
      student: { create: { name: input.name.trim(), mobile, email, whatsapp: input.whatsapp ? normalizeMobile(input.whatsapp) : mobile } },
    },
    include: { student: true },
  });

  await audit({ user: { id: user.id, name: user.name, role: user.role }, action: "register", module: "students", recordType: "Student", recordId: user.student?.id, description: `Student ${user.name} registered`, ip: input.ip, userAgent: input.userAgent });
  await notify({ userId: user.id, email, mobile, event: "REGISTRATION", data: { name: user.name } });
  await notifyStaff({
    permission: "students.view",
    title: "New student registration",
    body: `${user.name} has registered.\nMobile: ${mobile}\nEmail: ${email}`,
    path: user.student ? `/admin/students/${user.student.id}` : "/admin/students",
  });
  return user;
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(identifier: string, meta: RequestMeta = {}) {
  const raw = identifier.trim();
  const email = normalizeEmail(raw);
  const mobiles = mobileVariants(raw);
  const user = await db.user.findFirst({ where: { deletedAt: null, status: "ACTIVE", OR: [{ email }, ...(mobiles.length ? [{ mobile: { in: mobiles } }] : [])] } });
  // Always respond identically to avoid account enumeration.
  if (!user) return;
  // With passwordless administrator sign-in, a password reset would be a way around the email code.
  if (isAdminRole(user.role) && !adminPasswordLoginEnabled()) return;
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 30 * 60000) } });
  const link = absoluteUrl(`/reset-password?token=${token}`);
  // The link is a credential: stored redacted (the notification log is readable by staff), sent only
  // by email/SMS (no in-app copy), never resendable from the log.
  const channels: NotificationChannel[] = [...(user.email && (await isEmailConfigured()) ? (["EMAIL"] as NotificationChannel[]) : []), ...(user.mobile ? await getPhoneChannels() : [])];
  if (channels.length) await notify({ userId: user.id, email: user.email, mobile: user.mobile, event: "PASSWORD_RESET", data: { name: user.name, link }, channels, redact: ["link"] });
  await audit({ user: { id: user.id, name: user.name, role: user.role }, action: "password_reset_requested", module: "auth", recordType: "User", recordId: user.id, description: `${user.name} requested a password reset`, ...meta });
}

export async function resetPassword(token: string, password: string, meta: RequestMeta = {}) {
  const issue = passwordIssue(password);
  if (issue) throw Errors.validation("Please correct the highlighted fields.", { password: issue });
  const row = await db.passwordReset.findUnique({ where: { tokenHash: hashResetToken(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw Errors.badRequest("This reset link is invalid or has expired. Please request a new one.");
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null } }),
    db.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  await revokeAllSessions(row.userId);
  await audit({ user: { id: row.user.id, name: row.user.name, role: row.user.role }, action: "password_reset", module: "auth", recordType: "User", recordId: row.userId, description: `${row.user.name} reset their password`, ...meta });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId: string, meta: RequestMeta = {}) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw Errors.validation("Please correct the highlighted fields.", { currentPassword: "Current password is incorrect" });
  const issue = passwordIssue(newPassword);
  if (issue) throw Errors.validation("Please correct the highlighted fields.", { newPassword: issue });
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeAllSessions(userId, keepSessionId);
  await audit({ user: { id: user.id, name: user.name, role: user.role }, action: "password_change", module: "auth", recordType: "User", recordId: user.id, description: `${user.name} changed their password`, ...meta });
}
