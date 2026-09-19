import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, passwordIssue, verifyPassword } from "@/lib/auth/password";
import { createSession, revokeAllSessions, revokeSessionByToken } from "@/lib/auth/session";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { notify, notifyStaff } from "@/lib/notifications";
import { absoluteUrl } from "@/lib/utils";
import { getSetting } from "@/lib/settings";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export function normalizeMobile(mobile: string) {
  const digits = mobile.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export async function login(input: { identifier: string; password: string; remember?: boolean } & RequestMeta) {
  const raw = input.identifier.trim();
  const email = normalizeEmail(raw);
  const mobile = normalizeMobile(raw);
  const user = await db.user.findFirst({
    where: { deletedAt: null, OR: [{ email }, ...(mobile.length >= 10 ? [{ mobile }] : [])] },
  });

  const record = (success: boolean, reason?: string) =>
    db.loginHistory.create({
      data: { userId: user?.id ?? null, identifier: raw.slice(0, 190), success, reason, ip: input.ip ?? null, userAgent: input.userAgent?.slice(0, 500) ?? null },
    });

  if (!user) {
    await record(false, "unknown_user");
    throw Errors.unauthorized("Invalid email/mobile or password");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await record(false, "locked");
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw Errors.unauthorized(`Too many failed attempts. Account locked for ${mins} more minute${mins === 1 ? "" : "s"}.`);
  }
  if (user.status !== "ACTIVE") {
    await record(false, "inactive");
    throw Errors.unauthorized("Your account is not active. Please contact the Foundation.");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      },
    });
    await record(false, "bad_password");
    throw Errors.unauthorized(
      failed >= MAX_FAILED_LOGINS ? `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.` : "Invalid email/mobile or password"
    );
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await record(true);
  const session = await createSession(user.id, { ip: input.ip, userAgent: input.userAgent, remember: input.remember });
  await audit({ user: { id: user.id, name: user.name, role: user.role }, action: "login", module: "auth", recordType: "User", recordId: user.id, description: `${user.name} logged in`, ip: input.ip, userAgent: input.userAgent });
  return { user, ...session };
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

  const mobile = normalizeMobile(input.mobile);
  if (!/^[6-9]\d{9}$/.test(mobile)) throw Errors.validation("Please correct the highlighted fields.", { mobile: "Enter a valid 10-digit Indian mobile number" });
  const email = input.email ? normalizeEmail(input.email) : null;

  const clash = await db.user.findFirst({ where: { OR: [{ mobile }, ...(email ? [{ email }] : [])] }, select: { email: true, mobile: true } });
  if (clash) {
    const details: Record<string, string> = {};
    if (clash.mobile === mobile) details.mobile = "An account with this mobile number already exists";
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
  const mobile = normalizeMobile(raw);
  const user = await db.user.findFirst({ where: { deletedAt: null, status: "ACTIVE", OR: [{ email }, ...(mobile.length >= 10 ? [{ mobile }] : [])] } });
  // Always respond identically to avoid account enumeration.
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 30 * 60000) } });
  const link = absoluteUrl(`/reset-password?token=${token}`);
  await notify({ userId: user.id, email: user.email, mobile: user.mobile, event: "PASSWORD_RESET", data: { name: user.name, link } });
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
