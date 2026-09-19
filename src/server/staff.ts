import { randomInt } from "node:crypto";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { UserStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { generateEmployeeCode } from "@/lib/ids";
import { hashPassword, passwordIssue } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { normalizeEmail, normalizeMobile } from "@/server/auth";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid } from "@/lib/api/query";
import { emailSchema, mobileSchema } from "@/lib/validation/common";
import { assertPermissionKeys, ensurePermissionRows } from "@/server/roles";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

// ───────────────────────────── Schemas ─────────────────────────────

const optionalText = z.string().trim().max(120).optional().nullable();

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(120),
  email: emailSchema,
  mobile: z.union([z.literal(""), mobileSchema]).optional().nullable(),
  designation: optionalText,
  department: optionalText,
  roleId: z.union([z.literal(""), z.string().uuid()]).optional().nullable(),
  permissions: z.array(z.string().trim().min(3).max(60)).max(500).default([]),
  /** Leave empty to generate a strong temporary password (returned once). */
  password: z.union([z.literal(""), z.string().min(8).max(200)]).optional().nullable(),
});
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(120),
  email: emailSchema,
  mobile: z.union([z.literal(""), mobileSchema]).optional().nullable(),
  designation: optionalText,
  department: optionalText,
});
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

export const staffRoleSchema = z.object({ roleId: z.union([z.literal(""), z.string().uuid()]).nullable() });
export const staffPermissionsSchema = z.object({ permissions: z.array(z.string().trim().min(3).max(60)).max(500) });
export const staffStatusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]) });
export const staffResetPasswordSchema = z.object({ password: z.union([z.literal(""), z.string().min(8).max(200)]).optional().nullable() });

export const staffListSchema = paginationSchema.extend({
  roleId: optionalUuid,
  status: z.string().optional(),
  department: z.string().trim().max(120).optional(),
});
export type StaffListQuery = z.infer<typeof staffListSchema>;

// ───────────────────────────── Helpers ─────────────────────────────

/** 12-character password with upper/lower/digit/symbol – satisfies `passwordIssue`. */
export function generateTempPassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%&*!";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[randomInt(s.length)]!;
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

const staffInclude = {
  user: { select: { id: true, name: true, email: true, mobile: true, status: true, avatarUrl: true, lastLoginAt: true, createdAt: true, role: true } },
  role: { select: { id: true, name: true, slug: true, isSystem: true } },
  permissions: { select: { permission: { select: { key: true } } } },
} satisfies Prisma.StaffInclude;

function serializeStaff<T extends { permissions: { permission: { key: string } }[] }>(s: T) {
  return { ...s, permissions: s.permissions.map((p) => p.permission.key).sort() };
}

async function assertUniqueContact(email: string, mobile: string | null, excludeUserId?: string) {
  const emailDupe = await db.user.findFirst({ where: { email, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) }, select: { id: true } });
  if (emailDupe) throw Errors.validation("Please correct the highlighted fields.", { email: "An account with this email already exists" });
  if (mobile) {
    const mobileDupe = await db.user.findFirst({ where: { mobile, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) }, select: { id: true } });
    if (mobileDupe) throw Errors.validation("Please correct the highlighted fields.", { mobile: "An account with this mobile number already exists" });
  }
}

async function validateRole(roleId: string | null | undefined) {
  if (!roleId) return null;
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) throw Errors.validation("Please correct the highlighted fields.", { roleId: "Select a valid role" });
  return role;
}

// ───────────────────────────── Queries ─────────────────────────────

export async function listStaff(q: StaffListQuery) {
  const where: Prisma.StaffWhereInput = { deletedAt: null };
  if (q.roleId) where.roleId = q.roleId;
  if (q.status) where.user = { status: { in: q.status.split(",").filter(Boolean) as UserStatus[] } };
  if (q.department) where.department = { contains: q.department, mode: "insensitive" };
  if (q.q) where.OR = [{ employeeCode: { contains: q.q, mode: "insensitive" } }, { designation: { contains: q.q, mode: "insensitive" } }, { user: { name: { contains: q.q, mode: "insensitive" } } }, { user: { email: { contains: q.q, mode: "insensitive" } } }, { user: { mobile: { contains: q.q } } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "employeeCode", "designation", "department"] as const, "createdAt");
  const [rows, total] = await Promise.all([db.staff.findMany({ where, orderBy, ...getPaging(q), include: staffInclude }), db.staff.count({ where })]);
  return paged(rows.map(serializeStaff), total, q);
}

export async function getStaff(id: string) {
  const s = await db.staff.findFirst({ where: { id, deletedAt: null }, include: staffInclude });
  if (!s) throw Errors.notFound("Staff member");
  const [rolePermissions, loginHistory, sessions, recentAudit] = await Promise.all([
    s.roleId ? db.rolePermission.findMany({ where: { roleId: s.roleId }, select: { permission: { select: { key: true } } } }) : Promise.resolve([]),
    db.loginHistory.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.session.count({ where: { userId: s.userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    db.auditLog.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, action: true, module: true, description: true, createdAt: true } }),
  ]);
  return { ...serializeStaff(s), rolePermissions: rolePermissions.map((p) => p.permission.key).sort(), loginHistory, activeSessions: sessions, recentAudit };
}

export async function staffLoginHistory(userId: string, q: { page: number; limit: number }) {
  const [items, total] = await Promise.all([db.loginHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, ...getPaging(q) }), db.loginHistory.count({ where: { userId } })]);
  return paged(items, total, q);
}

// ───────────────────────────── Mutations ─────────────────────────────

export async function createStaff(input: StaffCreateInput, ctx: Ctx) {
  const email = normalizeEmail(input.email);
  const mobile = input.mobile ? normalizeMobile(input.mobile) : null;
  await assertUniqueContact(email, mobile);
  const role = await validateRole(input.roleId || null);
  const keys = assertPermissionKeys(input.permissions);
  const password = input.password || generateTempPassword();
  const issue = passwordIssue(password);
  if (issue) throw Errors.validation("Please correct the highlighted fields.", { password: issue });
  const passwordHash = await hashPassword(password);
  const permId = keys.length ? await ensurePermissionRows() : null;

  const staff = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: input.name, email, mobile, passwordHash, role: "STAFF", status: "ACTIVE" } });
    const employeeCode = await generateEmployeeCode(tx);
    return tx.staff.create({
      data: {
        userId: user.id,
        employeeCode,
        designation: input.designation || null,
        department: input.department || null,
        roleId: role?.id ?? null,
        createdById: ctx.user.id,
        permissions: keys.length && permId ? { create: keys.map((k) => ({ permissionId: permId.get(k)! })) } : undefined,
      },
      include: staffInclude,
    });
  });
  await audit({
    user: ctx.user,
    action: "create",
    module: "users",
    recordType: "Staff",
    recordId: staff.id,
    description: `${ctx.user.name} created staff account ${staff.employeeCode} for ${input.name}${role ? ` (${role.name})` : ""}`,
    newValue: { employeeCode: staff.employeeCode, name: input.name, email, mobile, designation: input.designation, department: input.department, role: role?.name ?? null, permissions: keys },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return { staff: serializeStaff(staff), temporaryPassword: input.password ? null : password };
}

export async function updateStaff(id: string, input: StaffUpdateInput, ctx: Ctx) {
  const existing = await db.staff.findFirst({ where: { id, deletedAt: null }, include: staffInclude });
  if (!existing) throw Errors.notFound("Staff member");
  const email = normalizeEmail(input.email);
  const mobile = input.mobile ? normalizeMobile(input.mobile) : null;
  await assertUniqueContact(email, mobile, existing.userId);
  const staff = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: existing.userId }, data: { name: input.name, email, mobile } });
    return tx.staff.update({ where: { id }, data: { designation: input.designation || null, department: input.department || null }, include: staffInclude });
  });
  await audit({
    user: ctx.user,
    action: "update",
    module: "users",
    recordType: "Staff",
    recordId: id,
    description: `${ctx.user.name} updated staff profile ${staff.employeeCode}`,
    oldValue: { name: existing.user.name, email: existing.user.email, mobile: existing.user.mobile, designation: existing.designation, department: existing.department },
    newValue: { name: input.name, email, mobile, designation: input.designation, department: input.department },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return serializeStaff(staff);
}

export async function setStaffRole(id: string, roleId: string | null, ctx: Ctx) {
  const existing = await db.staff.findFirst({ where: { id, deletedAt: null }, include: { role: true, user: { select: { name: true } } } });
  if (!existing) throw Errors.notFound("Staff member");
  const role = await validateRole(roleId);
  const staff = await db.staff.update({ where: { id }, data: { roleId: role?.id ?? null }, include: staffInclude });
  await audit({ user: ctx.user, action: "set_role", module: "users", recordType: "Staff", recordId: id, description: `${ctx.user.name} changed role of ${existing.user.name} from ${existing.role?.name ?? "none"} to ${role?.name ?? "none"}`, oldValue: { role: existing.role?.name ?? null }, newValue: { role: role?.name ?? null }, ip: ctx.ip, userAgent: ctx.userAgent });
  return serializeStaff(staff);
}

/** Replaces all direct permission grants for a staff member. */
export async function setStaffPermissions(id: string, permissions: string[], ctx: Ctx) {
  const existing = await db.staff.findFirst({ where: { id, deletedAt: null }, include: { user: { select: { name: true } }, permissions: { select: { permission: { select: { key: true } } } } } });
  if (!existing) throw Errors.notFound("Staff member");
  const keys = assertPermissionKeys(permissions);
  const permId = await ensurePermissionRows();
  await db.$transaction(async (tx) => {
    await tx.staffPermission.deleteMany({ where: { staffId: id } });
    if (keys.length) await tx.staffPermission.createMany({ data: keys.map((k) => ({ staffId: id, permissionId: permId.get(k)! })), skipDuplicates: true });
  });
  await audit({ user: ctx.user, action: "set_permissions", module: "users", recordType: "Staff", recordId: id, description: `${ctx.user.name} updated direct permissions of ${existing.user.name} (${keys.length} granted)`, oldValue: { permissions: existing.permissions.map((p) => p.permission.key).sort() }, newValue: { permissions: keys.sort() }, ip: ctx.ip, userAgent: ctx.userAgent });
  return keys;
}

export async function setStaffStatus(id: string, status: UserStatus, ctx: Ctx) {
  const existing = await db.staff.findFirst({ where: { id, deletedAt: null }, include: { user: { select: { id: true, name: true, status: true } } } });
  if (!existing) throw Errors.notFound("Staff member");
  if (existing.userId === ctx.user.id) throw Errors.badRequest("You cannot change the status of your own account.");
  await db.user.update({ where: { id: existing.userId }, data: { status } });
  if (status !== "ACTIVE") await revokeAllSessions(existing.userId);
  await audit({ user: ctx.user, action: status === "ACTIVE" ? "activate" : "deactivate", module: "users", recordType: "Staff", recordId: id, description: `${ctx.user.name} set ${existing.user.name}'s account to ${status}`, oldValue: { status: existing.user.status }, newValue: { status }, ip: ctx.ip, userAgent: ctx.userAgent });
  return { status };
}

/** Sets a new (temporary) password and logs the staff member out of every device. */
export async function resetStaffPassword(id: string, password: string | null | undefined, ctx: Ctx) {
  const existing = await db.staff.findFirst({ where: { id, deletedAt: null }, include: { user: { select: { id: true, name: true } } } });
  if (!existing) throw Errors.notFound("Staff member");
  const pwd = password || generateTempPassword();
  const issue = passwordIssue(pwd);
  if (issue) throw Errors.validation("Please correct the highlighted fields.", { password: issue });
  await db.user.update({ where: { id: existing.userId }, data: { passwordHash: await hashPassword(pwd), failedLoginCount: 0, lockedUntil: null } });
  await revokeAllSessions(existing.userId);
  await audit({ user: ctx.user, action: "reset_password", module: "users", recordType: "Staff", recordId: id, description: `${ctx.user.name} reset the password of ${existing.user.name} and revoked their sessions`, ip: ctx.ip, userAgent: ctx.userAgent });
  return { temporaryPassword: password ? null : pwd };
}

/** Soft-deletes the staff record and disables the login. */
export async function deleteStaff(id: string, ctx: Ctx) {
  const existing = await db.staff.findFirst({ where: { id, deletedAt: null }, include: { user: { select: { id: true, name: true, email: true } } } });
  if (!existing) throw Errors.notFound("Staff member");
  if (existing.userId === ctx.user.id) throw Errors.badRequest("You cannot delete your own account.");
  await db.$transaction([
    db.staffPermission.deleteMany({ where: { staffId: id } }),
    db.staff.update({ where: { id }, data: { deletedAt: new Date(), roleId: null } }),
    db.user.update({ where: { id: existing.userId }, data: { status: "INACTIVE", deletedAt: new Date() } }),
  ]);
  await revokeAllSessions(existing.userId);
  await audit({ user: ctx.user, action: "delete", module: "users", recordType: "Staff", recordId: id, description: `${ctx.user.name} deleted staff account ${existing.employeeCode} (${existing.user.name})`, oldValue: { employeeCode: existing.employeeCode, name: existing.user.name, email: existing.user.email }, ip: ctx.ip, userAgent: ctx.userAgent });
}
