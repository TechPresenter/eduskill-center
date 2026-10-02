import { randomInt } from "node:crypto";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { AuthUser } from "@/lib/auth/session";
import { revokeAllSessions, revokeSessionById } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { adminIdleMinutes, adminPasswordLoginEnabled, adminSessionMs, adminTwoFactorRequired } from "@/lib/auth/policy";
import { deviceLabel, maskIp } from "@/lib/auth/device";
import { isEncryptionConfigured, keyedHash, sameHex, secretIssues } from "@/lib/crypto";
import { emailConfigStatus, sendSecurityEmail } from "@/lib/notifications";
import { getSettingsGroup, setSettings } from "@/lib/settings";
import { enforceRateLimitStrict } from "@/lib/rate-limit";
import { getPaging, paged, paginationSchema, optionalBool, optionalDate } from "@/lib/api/query";
import { isValidAddress } from "@/lib/email/sanitize";
import { istTime, raiseSecurityAlert } from "@/server/security-alerts";

/**
 * Admin → Security Center.
 *
 * Who can do what:
 *   - security.view        overview, sessions, sign-in activity, administrators, alerts.
 *   - security.manage      revoke sessions / unlock — only for staff of a LOWER tier than the actor.
 *   - Super Admin          everything, including resetting 2FA, disabling accounts and the
 *                          security settings. Nobody else ever acts on, or sees the IPs and devices
 *                          of, a Super Admin.
 */

export interface Ctx {
  user: AuthUser;
  ip?: string | null;
  userAgent?: string | null;
}

const ADMIN_ROLES = ["SUPER_ADMIN", "STAFF"] as const;

const isSuper = (u: AuthUser) => u.role === "SUPER_ADMIN";

async function targetOf(userId: string) {
  const t = await db.user.findFirst({
    where: { id: userId, role: { in: [...ADMIN_ROLES] }, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, status: true, staff: { select: { deletedAt: true, role: { select: { level: true } } } } },
  });
  if (!t) throw Errors.notFound("Administrator");
  const tier = t.role === "SUPER_ADMIN" ? 0 : t.staff && !t.staff.deletedAt ? (t.staff.role?.level ?? 3) : 3;
  return { ...t, tier };
}

/** Only a Super Admin acts on a Super Admin; security.manage acts on lower tiers only. */
function assertCanActOn(actor: AuthUser, target: { id: string; role: string; tier: number }) {
  if (isSuper(actor)) return;
  if (target.role === "SUPER_ADMIN") throw Errors.forbidden("Only a Super Admin can manage a Super Admin.");
  if (!hasPermission(actor, "security.manage")) throw Errors.forbidden();
  if (target.id !== actor.id && target.tier <= actor.security.tier) throw Errors.forbidden("You can only manage staff below your own tier.");
}

/** Non-super-admins never see Super Admin rows. */
function visibleUserFilter(actor: AuthUser): Prisma.UserWhereInput {
  return isSuper(actor) ? { role: { in: [...ADMIN_ROLES] } } : { role: "STAFF" };
}

const ip = (actor: AuthUser, value: string | null) => (isSuper(actor) ? (value ?? "—") : maskIp(value));

// ───────────────────────────── Overview ─────────────────────────────

export async function securityOverview(actor: AuthUser) {
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const userFilter = visibleUserFilter(actor);
  const [activeSessions, failed24h, openAlerts, critical, admins, with2fa, locked, email] = await Promise.all([
    db.session.count({ where: { ...liveSession(), user: { ...userFilter, deletedAt: null } } }),
    db.loginHistory.count({ where: { success: false, createdAt: { gt: since }, OR: [{ user: userFilter }, { identifier: { startsWith: "admin-email:" } }] } }),
    db.securityAlert.count({ where: { acknowledgedAt: null, ...(isSuper(actor) ? {} : { OR: [{ userId: null }, { user: { role: "STAFF" } }] }) } }),
    db.securityAlert.count({ where: { acknowledgedAt: null, severity: "critical", ...(isSuper(actor) ? {} : { OR: [{ userId: null }, { user: { role: "STAFF" } }] }) } }),
    db.user.count({ where: { ...userFilter, deletedAt: null, status: "ACTIVE" } }),
    db.user.count({ where: { ...userFilter, deletedAt: null, status: "ACTIVE", totpEnabledAt: { not: null } } }),
    db.user.count({ where: { ...userFilter, deletedAt: null, OR: [{ lockedUntil: { gt: new Date() } }, { mfaLockedUntil: { gt: new Date() } }] } }),
    emailConfigStatus(),
  ]);
  return {
    activeSessions,
    failed24h,
    openAlerts,
    criticalAlerts: critical,
    admins,
    with2fa,
    locked,
    policy: {
      passwordLogin: adminPasswordLoginEnabled(),
      idleMinutes: adminIdleMinutes(),
      sessionHours: Math.round(adminSessionMs() / 3_600_000),
      require2fa: await adminTwoFactorRequired(),
      encryptionConfigured: isEncryptionConfigured(),
      emailConfigured: email.configured,
    },
    // Problems with server secrets — shown to the Super Admin only, never their values.
    issues: isSuper(actor) ? secretIssues() : [],
  };
}

// ───────────────────────────── Sessions ─────────────────────────────

/** Sessions that would still be accepted: not revoked, not expired, and not idle past the limit. */
function liveSession(): Prisma.SessionWhereInput {
  const now = Date.now();
  return { revokedAt: null, expiresAt: { gt: new Date(now) }, lastSeenAt: { gt: new Date(now - adminIdleMinutes() * 60_000) } };
}

export const sessionsQuery = paginationSchema.extend({ userId: z.string().uuid().optional() });

export async function listAdminSessions(actor: AuthUser, q: z.infer<typeof sessionsQuery>) {
  const where: Prisma.SessionWhereInput = { ...liveSession(), user: { ...visibleUserFilter(actor), deletedAt: null }, ...(q.userId ? { userId: q.userId } : {}) };
  const { skip, take } = getPaging(q);
  const [rows, total] = await Promise.all([
    db.session.findMany({ where, orderBy: { lastSeenAt: "desc" }, skip, take, select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true, authMethod: true, mfaAt: true, user: { select: { id: true, name: true, email: true, role: true } } } }),
    db.session.count({ where }),
  ]);
  return paged(
    rows.map((s) => ({
      id: s.id,
      current: s.id === actor.sessionId,
      user: s.user,
      device: deviceLabel(s.userAgent),
      ip: ip(actor, s.ip),
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      authMethod: s.authMethod,
      twoFactor: !!s.mfaAt,
    })),
    total,
    q
  );
}

export async function revokeAdminSession(sessionId: string, ctx: Ctx) {
  const s = await db.session.findUnique({ where: { id: sessionId }, select: { id: true, userId: true, revokedAt: true, userAgent: true } });
  if (!s || s.revokedAt) throw Errors.notFound("Session");
  if (s.id === ctx.user.sessionId) throw Errors.badRequest("This is your current session. Use Log out instead.");
  const target = await targetOf(s.userId);
  assertCanActOn(ctx.user, target);
  await revokeSessionById(s.id);
  await audit({ user: ctx.user, action: "session_revoke", module: "security", recordType: "Session", recordId: s.id, description: `${ctx.user.name} signed out a session of ${target.name} (${deviceLabel(s.userAgent)})`, ip: ctx.ip, userAgent: ctx.userAgent });
  if (target.id !== ctx.user.id) await raiseSecurityAlert({ type: "SESSIONS_REVOKED", severity: "info", title: `${ctx.user.name} signed out a device of ${target.name}`, userId: target.id, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function revokeAllAdminSessions(userId: string, ctx: Ctx) {
  const target = await targetOf(userId);
  assertCanActOn(ctx.user, target);
  const keep = target.id === ctx.user.id ? ctx.user.sessionId : undefined;
  const count = await revokeAllSessions(target.id, keep);
  await audit({ user: ctx.user, action: "sessions_revoke_all", module: "security", recordType: "User", recordId: target.id, description: `${ctx.user.name} signed out ${count} session(s) of ${target.name}`, ip: ctx.ip, userAgent: ctx.userAgent });
  if (target.id !== ctx.user.id) await raiseSecurityAlert({ type: "SESSIONS_REVOKED", severity: "info", title: `${ctx.user.name} signed out every device of ${target.name}`, detail: `${count} session(s) ended.`, userId: target.id, ip: ctx.ip, userAgent: ctx.userAgent });
  return { revoked: count };
}

// ───────────────────────────── Sign-in activity ─────────────────────────────

export const activityQuery = paginationSchema.extend({
  failedOnly: optionalBool,
  userId: z.string().uuid().optional(),
  suspiciousOnly: optionalBool,
  from: optionalDate,
  to: optionalDate,
});

export async function listLoginActivity(actor: AuthUser, q: z.infer<typeof activityQuery>) {
  const where: Prisma.LoginHistoryWhereInput = {
    OR: [{ user: visibleUserFilter(actor) }, { userId: null, identifier: { startsWith: "admin-email:" } }],
    ...(q.failedOnly ? { success: false } : {}),
    ...(q.suspiciousOnly ? { suspicious: true } : {}),
    ...(q.userId ? { userId: q.userId } : {}),
    // Search by administrator only: raw typed identifiers are never searchable (they may hold a mistyped password).
    ...(q.q ? { AND: [{ OR: [{ user: { name: { contains: q.q, mode: "insensitive" as const } } }, { user: { email: { contains: q.q, mode: "insensitive" as const } } }] }] } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: new Date(q.to.getTime() + 86_400_000) } : {}) } } : {}),
  };
  const { skip, take } = getPaging(q);
  const [rows, total] = await Promise.all([
    db.loginHistory.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, select: { id: true, success: true, reason: true, method: true, ip: true, userAgent: true, newDevice: true, suspicious: true, createdAt: true, identifier: true, user: { select: { id: true, name: true, role: true } } } }),
    db.loginHistory.count({ where }),
  ]);
  return paged(
    rows.map((r) => ({
      id: r.id,
      success: r.success,
      reason: r.reason,
      method: r.method,
      user: r.user,
      // Typed identifiers are never shown raw: unknown ones could be someone's password typed into the wrong box.
      identifier: r.user ? null : r.identifier.startsWith("admin-email:") ? r.identifier.slice("admin-email:".length) : "—",
      device: deviceLabel(r.userAgent),
      ip: ip(actor, r.ip),
      newDevice: r.newDevice,
      suspicious: r.suspicious,
      createdAt: r.createdAt,
    })),
    total,
    q
  );
}

// ───────────────────────────── Administrators ─────────────────────────────

export async function listAdministrators(actor: AuthUser) {
  const users = await db.user.findMany({
    where: { ...visibleUserFilter(actor), deletedAt: null },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, totpEnabledAt: true, lockedUntil: true, mfaLockedUntil: true, emailVerifiedAt: true,
      staff: { select: { id: true, deletedAt: true, role: { select: { name: true, level: true } } } },
      _count: { select: { sessions: { where: liveSession() }, backupCodes: { where: { usedAt: null } } } },
    },
  });
  const now = new Date();
  return users.map((u) => {
    const tier = u.role === "SUPER_ADMIN" ? 0 : u.staff && !u.staff.deletedAt ? (u.staff.role?.level ?? 3) : 3;
    return {
      id: u.id,
      staffId: u.staff && !u.staff.deletedAt ? u.staff.id : null,
      name: u.name,
      email: u.email,
      role: u.role,
      roleName: u.role === "SUPER_ADMIN" ? "Super Admin" : (u.staff?.role?.name ?? "Foundation Staff"),
      tier,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      emailVerified: !!u.emailVerifiedAt,
      twoFactor: !!u.totpEnabledAt,
      backupCodesLeft: u._count.backupCodes,
      activeSessions: u._count.sessions,
      locked: (!!u.lockedUntil && u.lockedUntil > now) || (!!u.mfaLockedUntil && u.mfaLockedUntil > now),
      self: u.id === actor.id,
      canManage: isSuper(actor) || (u.role !== "SUPER_ADMIN" && hasPermission(actor, "security.manage") && tier > actor.security.tier),
    };
  });
}

export async function unlockAdministrator(userId: string, ctx: Ctx) {
  const target = await targetOf(userId);
  assertCanActOn(ctx.user, target);
  await db.user.update({ where: { id: target.id }, data: { failedLoginCount: 0, lockedUntil: null, mfaFailedCount: 0, mfaLockedUntil: null } });
  await audit({ user: ctx.user, action: "unlock", module: "security", recordType: "User", recordId: target.id, description: `${ctx.user.name} unlocked sign-in for ${target.name}`, ip: ctx.ip, userAgent: ctx.userAgent });
}

/** Disable / re-enable an administrator account. Super Admin only (the route enforces the role). */
export async function setAdministratorStatus(userId: string, status: "ACTIVE" | "SUSPENDED", ctx: Ctx) {
  if (!isSuper(ctx.user)) throw Errors.forbidden();
  const target = await targetOf(userId);
  if (target.id === ctx.user.id) throw Errors.badRequest("You cannot disable your own account.");
  if (status !== "ACTIVE" && target.role === "SUPER_ADMIN") {
    const others = await db.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null, id: { not: target.id } } });
    if (others === 0) throw Errors.badRequest("This is the only active Super Admin.");
  }
  await db.user.update({ where: { id: target.id }, data: { status } });
  const revoked = status === "ACTIVE" ? 0 : await revokeAllSessions(target.id);
  await audit({ user: ctx.user, action: status === "ACTIVE" ? "activate" : "suspend", module: "security", recordType: "User", recordId: target.id, description: `${ctx.user.name} ${status === "ACTIVE" ? "re-enabled" : "disabled"} the account of ${target.name}${revoked ? ` and signed out ${revoked} session(s)` : ""}`, oldValue: { status: target.status }, newValue: { status }, ip: ctx.ip, userAgent: ctx.userAgent });
  await raiseSecurityAlert({ type: "ACCOUNT_STATUS_CHANGED", severity: "warning", title: `${ctx.user.name} ${status === "ACTIVE" ? "re-enabled" : "disabled"} ${target.name}'s account`, userId: target.id, ip: ctx.ip, userAgent: ctx.userAgent });
  return { status, revoked };
}

// ───────────────────────────── Alerts ─────────────────────────────

export const alertsQuery = paginationSchema.extend({
  status: z.enum(["open", "acknowledged", "all"]).default("open"),
  severity: z.enum(["info", "warning", "critical"]).optional(),
});

export async function listSecurityAlerts(actor: AuthUser, q: z.infer<typeof alertsQuery>) {
  const where: Prisma.SecurityAlertWhereInput = {
    ...(q.status === "open" ? { acknowledgedAt: null } : q.status === "acknowledged" ? { acknowledgedAt: { not: null } } : {}),
    ...(q.severity ? { severity: q.severity } : {}),
    ...(isSuper(actor) ? {} : { OR: [{ userId: null }, { user: { role: "STAFF" } }] }),
  };
  const { skip, take } = getPaging(q);
  const [rows, total] = await Promise.all([
    db.securityAlert.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, name: true, role: true } } } }),
    db.securityAlert.count({ where }),
  ]);
  return paged(rows.map((a) => ({ ...a, ip: ip(actor, a.ip), device: a.userAgent ? deviceLabel(a.userAgent) : null, userAgent: undefined })), total, q);
}

export async function acknowledgeAlerts(ids: string[] | "all", ctx: Ctx) {
  const scope: Prisma.SecurityAlertWhereInput = { acknowledgedAt: null, ...(isSuper(ctx.user) ? {} : { OR: [{ userId: null }, { user: { role: "STAFF" } }] }) };
  const res = await db.securityAlert.updateMany({ where: ids === "all" ? scope : { ...scope, id: { in: ids } }, data: { acknowledgedAt: new Date(), acknowledgedById: ctx.user.id } });
  await audit({ user: ctx.user, action: "alerts_ack", module: "security", recordType: "SecurityAlert", description: `${ctx.user.name} marked ${res.count} security alert(s) as reviewed`, ip: ctx.ip, userAgent: ctx.userAgent });
  return { acknowledged: res.count };
}

// ───────────────────────────── Security settings (Super Admin) ─────────────────────────────

export const securitySettingsSchema = z.object({
  require2faForAdmins: z.boolean(),
  alertEmail: z.string().trim().toLowerCase().refine((v) => v === "" || isValidAddress(v), "Enter a valid email address"),
  newDeviceAlerts: z.boolean(),
});

export async function getSecuritySettings() {
  const s = await getSettingsGroup("security");
  return {
    require2faForAdmins: s["security.require2faForAdmins"] === true,
    alertEmail: String(s["security.alertEmail"] ?? ""),
    newDeviceAlerts: s["security.newDeviceAlerts"] !== false,
    env: {
      passwordLogin: adminPasswordLoginEnabled(),
      idleMinutes: adminIdleMinutes(),
      sessionHours: Math.round(adminSessionMs() / 3_600_000),
      encryptionConfigured: isEncryptionConfigured(),
      trustedProxyHops: Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 0,
    },
  };
}

export async function updateSecuritySettings(input: z.infer<typeof securitySettingsSchema>, ctx: Ctx) {
  if (!isSuper(ctx.user)) throw Errors.forbidden();
  const before = await getSecuritySettings();
  if (input.require2faForAdmins && !before.require2faForAdmins) {
    if (!isEncryptionConfigured()) throw Errors.badRequest("Set DATA_ENCRYPTION_KEY on the server before requiring two-factor authentication.");
    // Never let the switch lock its own author out: they must already use an authenticator.
    if (!ctx.user.security.twoFactorEnabled) throw Errors.badRequest("Set up your own authenticator app (My account → Security) and save your backup codes before requiring 2FA for everyone.");
  }
  await setSettings({ "security.require2faForAdmins": input.require2faForAdmins, "security.alertEmail": input.alertEmail, "security.newDeviceAlerts": input.newDeviceAlerts }, ctx.user.id);
  await audit({ user: ctx.user, action: "update", module: "security", recordType: "Setting", recordId: "security", description: `${ctx.user.name} changed the security settings`, oldValue: { require2faForAdmins: before.require2faForAdmins, alertEmail: before.alertEmail, newDeviceAlerts: before.newDeviceAlerts }, newValue: input, ip: ctx.ip, userAgent: ctx.userAgent });
  await raiseSecurityAlert({
    type: "SECURITY_SETTINGS_CHANGED",
    severity: "warning",
    title: `${ctx.user.name} changed the security settings`,
    detail: `2FA required: ${input.require2faForAdmins ? "yes" : "no"} · new-device emails: ${input.newDeviceAlerts ? "on" : "off"} · alert email: ${input.alertEmail || "none"}`,
    userId: ctx.user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return getSecuritySettings();
}

// ───────────────────────────── Own login email (Super Admin) ─────────────────────────────

const EMAIL_CHANGE_TTL_MIN = 10;

function hashEmailChange(userId: string, email: string, code: string) {
  return keyedHash("email-change-otp", `${userId}:${email}:${code}`);
}

/** Sends a code to the NEW address; the change happens only when that code comes back. */
export async function requestLoginEmailChange(newEmailRaw: string, ctx: Ctx) {
  if (!isSuper(ctx.user)) throw Errors.forbidden("Only a Super Admin can change their login email here.");
  const newEmail = newEmailRaw.trim().toLowerCase();
  if (!isValidAddress(newEmail)) throw Errors.validation("Please correct the highlighted fields.", { email: "Enter a valid email address" });
  await enforceRateLimitStrict(`email-change:u:${ctx.user.id}`, 5, 3600);
  const taken = await db.user.findFirst({ where: { email: newEmail, id: { not: ctx.user.id } }, select: { id: true } });
  if (taken) throw Errors.validation("Please correct the highlighted fields.", { email: "Another account already uses this email" });
  if (newEmail === ctx.user.email) throw Errors.validation("Please correct the highlighted fields.", { email: "This is already your login email" });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  await db.$transaction([
    db.loginOtp.updateMany({ where: { userId: ctx.user.id, purpose: "EMAIL_CHANGE", consumedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } }),
    db.loginOtp.create({ data: { userId: ctx.user.id, purpose: "EMAIL_CHANGE", target: newEmail, codeHash: hashEmailChange(ctx.user.id, newEmail, code), expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TTL_MIN * 60_000), ip: ctx.ip ?? null, userAgent: ctx.userAgent?.slice(0, 500) ?? null } }),
  ]);
  const sent = await sendSecurityEmail({ userId: ctx.user.id, email: newEmail, event: "EMAIL_CHANGE_OTP", data: { name: ctx.user.name, newEmail, code, minutes: EMAIL_CHANGE_TTL_MIN }, redact: ["code"] });
  if (!sent.ok) throw Errors.badRequest("The code could not be emailed. Check Admin → Settings → Communication, or use the Send test email button.");
  return { sentTo: newEmail, expiresInMinutes: EMAIL_CHANGE_TTL_MIN };
}

export async function confirmLoginEmailChange(code: string, ctx: Ctx) {
  if (!isSuper(ctx.user)) throw Errors.forbidden("Only a Super Admin can change their login email here.");
  const otp = await db.loginOtp.findFirst({ where: { userId: ctx.user.id, purpose: "EMAIL_CHANGE", consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp || !otp.target) throw Errors.unauthorized("This code has expired. Request a new one.");
  if (otp.attempts >= 5) throw Errors.unauthorized("Too many wrong attempts. Request a new code.");
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !sameHex(hashEmailChange(ctx.user.id, otp.target, clean), otp.codeHash)) {
    await db.loginOtp.updateMany({ where: { id: otp.id, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
    throw Errors.unauthorized("That code is not correct.");
  }
  const consumed = await db.loginOtp.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) throw Errors.unauthorized("This code has expired. Request a new one.");
  const before = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { email: true, name: true } });
  const taken = await db.user.findFirst({ where: { email: otp.target, id: { not: ctx.user.id } }, select: { id: true } });
  if (taken) throw Errors.conflict("Another account now uses this email.");
  await db.user.update({ where: { id: ctx.user.id }, data: { email: otp.target, emailVerifiedAt: new Date() } });
  const revoked = await revokeAllSessions(ctx.user.id, ctx.user.sessionId);
  await audit({ user: ctx.user, action: "email_change", module: "security", recordType: "User", recordId: ctx.user.id, description: `${ctx.user.name} changed their login email (other sessions signed out: ${revoked})`, oldValue: { email: before.email }, newValue: { email: otp.target }, ip: ctx.ip, userAgent: ctx.userAgent });
  if (before.email) void sendSecurityEmail({ userId: ctx.user.id, email: before.email, event: "LOGIN_EMAIL_CHANGED", data: { name: before.name, oldEmail: before.email, newEmail: otp.target, time: istTime() } });
  await raiseSecurityAlert({ type: "LOGIN_EMAIL_CHANGED", severity: "warning", title: `${before.name} changed their login email`, detail: `New address: ${otp.target}.`, userId: ctx.user.id, ip: ctx.ip, userAgent: ctx.userAgent });
  return { email: otp.target };
}
