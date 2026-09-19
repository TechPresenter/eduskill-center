import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { ALL_PERMISSIONS, PERMISSION_KEYS, PERMISSION_MODULES } from "@/lib/rbac/permissions";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

export const roleInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name").max(80),
  description: z.string().trim().max(500).optional().nullable(),
  permissions: z.array(z.string().trim().min(3).max(60)).max(500).default([]),
});
export type RoleInput = z.infer<typeof roleInputSchema>;

/** Validates permission keys against the catalog; "*" is never grantable. */
export function assertPermissionKeys(keys: string[]) {
  const invalid = keys.filter((k) => k === "*" || !PERMISSION_KEYS.has(k));
  if (invalid.length) throw Errors.validation("Please correct the highlighted fields.", { permissions: `Unknown permission(s): ${invalid.slice(0, 5).join(", ")}` });
  return Array.from(new Set(keys));
}

/** Makes sure every permission in the catalog exists in the database (new keys added in code). */
export async function ensurePermissionRows() {
  const existing = await db.permission.findMany({ select: { id: true, key: true } });
  const have = new Set(existing.map((p) => p.key));
  const missing = ALL_PERMISSIONS.filter((p) => !have.has(p.key));
  if (missing.length) await db.permission.createMany({ data: missing.map((p) => ({ key: p.key, module: p.module, label: p.label })), skipDuplicates: true });
  const all = missing.length ? await db.permission.findMany({ select: { id: true, key: true } }) : existing;
  return new Map(all.map((p) => [p.key, p.id]));
}

export async function listRoles() {
  const roles = await db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { permissions: { include: { permission: { select: { key: true } } } }, _count: { select: { staff: { where: { deletedAt: null } } } } },
  });
  return roles.map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description, isSystem: r.isSystem, createdAt: r.createdAt, updatedAt: r.updatedAt, permissions: r.permissions.map((p) => p.permission.key).sort(), staffCount: r._count.staff }));
}

export async function getRole(id: string) {
  const r = await db.role.findUnique({
    where: { id },
    include: {
      permissions: { include: { permission: { select: { key: true } } } },
      staff: { where: { deletedAt: null }, include: { user: { select: { id: true, name: true, email: true, status: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) throw Errors.notFound("Role");
  return { id: r.id, name: r.name, slug: r.slug, description: r.description, isSystem: r.isSystem, createdAt: r.createdAt, updatedAt: r.updatedAt, permissions: r.permissions.map((p) => p.permission.key).sort(), staff: r.staff.map((s) => ({ id: s.id, employeeCode: s.employeeCode, designation: s.designation, user: s.user })) };
}

async function uniqueRoleSlug(name: string, excludeId?: string) {
  let slug = slugify(name) || "role";
  let i = 1;
  while (await db.role.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) slug = `${slugify(name)}-${++i}`;
  return slug;
}

export async function createRole(input: RoleInput, ctx: Ctx) {
  const dupe = await db.role.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } });
  if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A role with this name already exists" });
  const keys = assertPermissionKeys(input.permissions);
  const permId = await ensurePermissionRows();
  const role = await db.role.create({
    data: { name: input.name, slug: await uniqueRoleSlug(input.name), description: input.description || null, isSystem: false, permissions: { create: keys.map((k) => ({ permissionId: permId.get(k)! })) } },
  });
  await audit({ user: ctx.user, action: "create", module: "roles", recordType: "Role", recordId: role.id, description: `${ctx.user.name} created role ${role.name} with ${keys.length} permission(s)`, newValue: { ...role, permissions: keys }, ip: ctx.ip, userAgent: ctx.userAgent });
  return getRole(role.id);
}

export async function updateRole(id: string, input: RoleInput, ctx: Ctx) {
  const existing = await getRole(id);
  if (input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const dupe = await db.role.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, id: { not: id } } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A role with this name already exists" });
  }
  const keys = assertPermissionKeys(input.permissions);
  const permId = await ensurePermissionRows();
  await db.$transaction(async (tx) => {
    await tx.role.update({ where: { id }, data: { name: input.name, description: input.description || null, slug: existing.isSystem ? undefined : input.name !== existing.name ? await uniqueRoleSlug(input.name, id) : undefined } });
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    if (keys.length) await tx.rolePermission.createMany({ data: keys.map((k) => ({ roleId: id, permissionId: permId.get(k)! })), skipDuplicates: true });
  });
  const updated = await getRole(id);
  await audit({
    user: ctx.user,
    action: "update",
    module: "roles",
    recordType: "Role",
    recordId: id,
    description: `${ctx.user.name} updated role ${updated.name} (${updated.permissions.length} permissions)`,
    oldValue: { name: existing.name, description: existing.description, permissions: existing.permissions },
    newValue: { name: updated.name, description: updated.description, permissions: updated.permissions },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return updated;
}

export async function deleteRole(id: string, ctx: Ctx) {
  const existing = await db.role.findUnique({ where: { id }, include: { _count: { select: { staff: { where: { deletedAt: null } } } } } });
  if (!existing) throw Errors.notFound("Role");
  if (existing.isSystem) throw Errors.conflict("System roles cannot be deleted. You can edit their permissions instead.");
  if (existing._count.staff > 0) throw Errors.conflict(`${existing._count.staff} staff member(s) still use this role. Assign them a different role first.`);
  await db.role.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "roles", recordType: "Role", recordId: id, description: `${ctx.user.name} deleted role ${existing.name}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

/** Read-only permission catalog: every module/action with the roles that hold it and direct staff grants. */
export async function permissionCatalog() {
  const [roles, direct] = await Promise.all([
    db.role.findMany({ select: { id: true, name: true, isSystem: true, permissions: { select: { permission: { select: { key: true } } } } }, orderBy: { name: "asc" } }),
    db.staffPermission.findMany({ where: { staff: { deletedAt: null } }, select: { permission: { select: { key: true } } } }),
  ]);
  const roleMap = new Map<string, { id: string; name: string; isSystem: boolean }[]>();
  for (const r of roles) for (const p of r.permissions) roleMap.set(p.permission.key, [...(roleMap.get(p.permission.key) ?? []), { id: r.id, name: r.name, isSystem: r.isSystem }]);
  const directCount = new Map<string, number>();
  for (const d of direct) directCount.set(d.permission.key, (directCount.get(d.permission.key) ?? 0) + 1);
  return PERMISSION_MODULES.map((m) => ({
    key: m.key,
    label: m.label,
    permissions: m.actions.map((a) => {
      const key = `${m.key}.${a}`;
      return { key, action: a, label: ALL_PERMISSIONS.find((p) => p.key === key)?.label ?? key, roles: roleMap.get(key) ?? [], directStaffCount: directCount.get(key) ?? 0 };
    }),
  }));
}
