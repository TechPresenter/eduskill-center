/**
 * Production data migration for the Admin Security + Send Email release (October 2026). Run it
 * once after `prisma migrate deploy` on a database that existed before this release; the seed
 * already does steps 1–2 for a fresh database.
 *
 *  1. Permissions — a Permission row for every key in ALL_PERMISSIONS (new: security.view,
 *     security.manage, email.view, email.send, email.templates). Labels/modules are refreshed.
 *  2. Staff tiers — the Admin / Manager / Staff presets from DEFAULT_STAFF_ROLES are created with
 *     their tier level and default permissions when their slug is missing. An existing preset only
 *     has its level set: its permissions are NEVER overwritten (the Super Admin may have edited them).
 *     Every other role keeps its level; one outside 1–3 is set to 3 (Staff).
 *  3. Leaked secrets in the notification log (readable by staff with notifications.view):
 *       PASSWORD_RESET:*   rows written before redaction carried the live reset link → "[hidden]".
 *       TRAINER_APPROVED:* rows carried the trainer's temporary password → removed.
 *  4. Leaked password hashes in the audit log: any passwordHash / password_hash key (and a raw
 *     password string under password / tempPassword / newPassword / currentPassword) inside
 *     old_value / new_value is set to "[redacted]".
 *  5. Secret settings saved before DATA_ENCRYPTION_KEY existed (SMTP password, SMS / WhatsApp keys,
 *     Razorpay secrets) are still plain text in the settings table: each is encrypted in place.
 *     Skipped, with a warning, when DATA_ENCRYPTION_KEY is not set.
 *
 * Every change is written to the audit log as a System action — without the secret itself.
 * Idempotent: a second run finds nothing to change.
 *
 *   npx tsx scripts/apply-admin-security.ts            # apply
 *   npx tsx scripts/apply-admin-security.ts --dry-run  # only report what would change
 *   npm run security:migrate [-- --dry-run]
 */
import "dotenv/config";
import path from "node:path";
import { db, type Prisma } from "../src/lib/db";
import { audit, AUDIT_REDACTED } from "../src/lib/audit";
import { ALL_PERMISSIONS, DEFAULT_STAFF_ROLES } from "../src/lib/rbac/permissions";
import { REDACTED } from "../src/lib/notifications";
import { encryptSecret, isEncrypted, isEncryptionConfigured } from "../src/lib/crypto";
import { invalidateSettingsCache, SETTING_DEFAULTS } from "../src/lib/settings";

export interface ApplyAdminSecurityResult {
  permissionsCreated: number;
  permissionsUpdated: number;
  rolesCreated: string[];
  roleLevelsSet: string[];
  rolesSkipped: string[];
  otherRolesFixed: number;
  resetLinksHidden: number;
  tempPasswordsRemoved: number;
  auditLogsRedacted: number;
  /** Keys of secret settings encrypted in place (never their values). */
  secretsEncrypted: string[];
  /** True when step 5 could not run because DATA_ENCRYPTION_KEY is not set. */
  secretsSkippedNoKey: boolean;
}

const BATCH = 500;

// ───────────────────────────── secret scrubbers (pure) ─────────────────────────────

/** Any URL or path carrying a `token=` query parameter (the reset link) becomes "[hidden]". */
const TOKEN_URL = /\S*[?&]token=[^\s"'<>]+/gi;

/** The credentials block TRAINER_APPROVED used to append: "\n\nLogin: …\nTemporary password: …\nPlease change it…". */
const CREDENTIALS_BLOCK = /\n*Login: [^\n]*\nTemporary password: [^\n]*(?:\nPlease change it after your first login\.)?/g;
/** Fallback for an admin-edited template that worded it differently. */
const TEMP_PASSWORD_LINE = /(temporary password\s*[:=-]\s*)(?!\[hidden\])\S+/gi;

function hideResetLinks(text: string): string {
  return text.replace(TOKEN_URL, REDACTED);
}

function removeTempPassword(text: string): string {
  return text.replace(CREDENTIALS_BLOCK, "").replace(TEMP_PASSWORD_LINE, `$1${REDACTED}`);
}

/** Applies `fn` to every string inside a JSON value; `keyRule` may replace a whole value by key. */
function mapJson(value: unknown, fn: (s: string) => string, keyRule?: (key: string, v: unknown) => unknown): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapJson(v, fn, keyRule));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const ruled = keyRule ? keyRule(k, v) : undefined;
      out[k] = ruled !== undefined ? ruled : mapJson(v, fn, keyRule);
    }
    return out;
  }
  return value;
}

const HASH_KEY = /^password_?hash$/i;
const RAW_PASSWORD_KEY = /^(password|temp_?password|new_?password|current_?password)$/i;

/** Redacts password-hash keys (any non-null value) and raw-password keys (non-empty strings). */
function redactPasswordKeys(value: unknown): unknown {
  return mapJson(
    value,
    (s) => s,
    (k, v) => {
      if (v === null || v === undefined || v === AUDIT_REDACTED) return undefined;
      if (HASH_KEY.test(k)) return AUDIT_REDACTED;
      if (RAW_PASSWORD_KEY.test(k) && typeof v === "string" && v !== "") return AUDIT_REDACTED;
      return undefined;
    }
  );
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ───────────────────────────── steps ─────────────────────────────

async function ensurePermissions(dry: boolean, r: ApplyAdminSecurityResult) {
  const existing = new Map((await db.permission.findMany({ select: { id: true, key: true, module: true, label: true } })).map((p) => [p.key, p]));
  for (const p of ALL_PERMISSIONS) {
    const row = existing.get(p.key);
    if (!row) {
      r.permissionsCreated++;
      console.log(`  + permission ${p.key}`);
      if (dry) continue;
      const created = await db.permission.create({ data: { key: p.key, module: p.module, label: p.label } });
      await audit({ action: "create", module: "roles", recordType: "Permission", recordId: created.id, description: `System added the permission "${p.label}" (${p.key})`, newValue: { key: p.key, module: p.module, label: p.label } });
    } else if (row.module !== p.module || row.label !== p.label) {
      r.permissionsUpdated++;
      console.log(`  ~ permission ${p.key}: "${row.label}" → "${p.label}"`);
      if (dry) continue;
      await db.permission.update({ where: { id: row.id }, data: { module: p.module, label: p.label } });
      await audit({ action: "update", module: "roles", recordType: "Permission", recordId: row.id, description: `System refreshed the label of permission ${p.key}`, oldValue: { module: row.module, label: row.label }, newValue: { module: p.module, label: p.label } });
    }
  }
}

async function ensureTierRoles(dry: boolean, r: ApplyAdminSecurityResult) {
  const permId = new Map((await db.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]));
  const tierPresets = DEFAULT_STAFF_ROLES.filter((role) => role.level !== undefined);
  for (const preset of tierPresets) {
    const level = preset.level!;
    const bySlug = await db.role.findUnique({ where: { slug: preset.slug }, select: { id: true, name: true, level: true } });
    if (bySlug) {
      if (bySlug.level !== level) {
        r.roleLevelsSet.push(`${bySlug.name} → ${level}`);
        console.log(`  ~ role ${bySlug.name}: tier level ${bySlug.level} → ${level} (permissions untouched)`);
        if (!dry) {
          await db.role.update({ where: { id: bySlug.id }, data: { level } });
          await audit({ action: "update", module: "roles", recordType: "Role", recordId: bySlug.id, description: `System set the tier level of role ${bySlug.name} to ${level}`, oldValue: { level: bySlug.level }, newValue: { level } });
        }
      }
      continue;
    }
    const byName = await db.role.findUnique({ where: { name: preset.name }, select: { slug: true } });
    if (byName) {
      // A role the Foundation created by hand already uses this name: leave it alone and say so.
      r.rolesSkipped.push(`${preset.name} (name already used by role "${byName.slug}")`);
      console.log(`  ! role ${preset.name}: not created — a role with this name already exists (slug "${byName.slug}"). Rename it, or set its tier in Admin → Roles.`);
      continue;
    }
    const keys = preset.permissions.filter((k) => permId.has(k) || dry);
    r.rolesCreated.push(preset.name);
    console.log(`  + role ${preset.name} (tier ${level}, ${keys.length} permissions)`);
    if (dry) continue;
    const role = await db.$transaction(async (tx) => {
      const created = await tx.role.create({ data: { name: preset.name, slug: preset.slug, description: preset.description, isSystem: true, level } });
      await tx.rolePermission.createMany({ data: keys.map((k) => ({ roleId: created.id, permissionId: permId.get(k)! })), skipDuplicates: true });
      return created;
    });
    await audit({ action: "create", module: "roles", recordType: "Role", recordId: role.id, description: `System created the ${preset.name} tier role (level ${level}) with ${keys.length} default permissions`, newValue: { name: preset.name, slug: preset.slug, level, permissions: keys } });
  }

  const presetSlugs = tierPresets.map((p) => p.slug);
  const odd = await db.role.findMany({ where: { slug: { notIn: presetSlugs }, OR: [{ level: { lt: 1 } }, { level: { gt: 3 } }] }, select: { id: true, name: true, level: true } });
  for (const role of odd) {
    r.otherRolesFixed++;
    console.log(`  ~ role ${role.name}: tier level ${role.level} → 3`);
    if (dry) continue;
    await db.role.update({ where: { id: role.id }, data: { level: 3 } });
    await audit({ action: "update", module: "roles", recordType: "Role", recordId: role.id, description: `System set the tier level of role ${role.name} to 3 (Staff)`, oldValue: { level: role.level }, newValue: { level: 3 } });
  }
}

async function scrubNotifications(dry: boolean, r: ApplyAdminSecurityResult) {
  let cursor: string | undefined;
  for (;;) {
    const rows = await db.notification.findMany({
      where: { OR: [{ templateKey: { startsWith: "PASSWORD_RESET:" } }, { templateKey: { startsWith: "TRAINER_APPROVED:" } }], ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true, templateKey: true, title: true, body: true, data: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    for (const n of rows) {
      const reset = n.templateKey!.startsWith("PASSWORD_RESET:");
      const fn = reset ? hideResetLinks : removeTempPassword;
      const title = fn(n.title);
      const body = fn(n.body);
      const data =
        n.data === null
          ? null
          : mapJson(n.data, fn, (k, v) => {
              if (typeof v !== "string" || v === "" || v === REDACTED) return undefined;
              if (reset && k === "link") return REDACTED;
              if (!reset && k === "credentials") return REDACTED;
              return undefined;
            });
      if (title === n.title && body === n.body && same(data, n.data)) continue;
      if (reset) r.resetLinksHidden++;
      else r.tempPasswordsRemoved++;
      if (dry) continue;
      await db.notification.update({
        where: { id: n.id },
        data: { title, body, ...(data !== null && !same(data, n.data) ? { data: data as Prisma.InputJsonValue } : {}) },
      });
      await audit({
        action: "redact",
        module: "notifications",
        recordType: "Notification",
        recordId: n.id,
        description: reset ? `System hid a password-reset link stored in notification log entry ${n.id}` : `System removed a temporary password stored in notification log entry ${n.id}`,
      });
    }
  }
}

async function scrubAuditLogs(dry: boolean, r: ApplyAdminSecurityResult) {
  // Narrow the scan in SQL (a text match is far cheaper than loading every audit row); the exact
  // key-by-key decision is made below in JavaScript.
  const candidates = await db.$queryRaw<{ id: string }[]>`
    SELECT "id"::text AS "id" FROM "audit_logs"
    WHERE "old_value"::text ILIKE '%password%' OR "new_value"::text ILIKE '%password%'
    ORDER BY "id"`;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const ids = candidates.slice(i, i + BATCH).map((c) => c.id);
    const rows = await db.auditLog.findMany({ where: { id: { in: ids } }, select: { id: true, oldValue: true, newValue: true } });
    for (const row of rows) {
      const oldValue = row.oldValue === null ? null : redactPasswordKeys(row.oldValue);
      const newValue = row.newValue === null ? null : redactPasswordKeys(row.newValue);
      const oldChanged = oldValue !== null && !same(oldValue, row.oldValue);
      const newChanged = newValue !== null && !same(newValue, row.newValue);
      if (!oldChanged && !newChanged) continue;
      r.auditLogsRedacted++;
      if (dry) continue;
      await db.auditLog.update({
        where: { id: row.id },
        data: { ...(oldChanged ? { oldValue: oldValue as Prisma.InputJsonValue } : {}), ...(newChanged ? { newValue: newValue as Prisma.InputJsonValue } : {}) },
      });
      await audit({ action: "redact", module: "audit_logs", recordType: "AuditLog", recordId: row.id, description: `System redacted password fields stored in audit log entry ${row.id}` });
    }
  }
}

export async function encryptPlaintextSecrets(dry: boolean, r: ApplyAdminSecurityResult) {
  const secretKeys = Object.entries(SETTING_DEFAULTS).filter(([, d]) => d.secret).map(([k]) => k);
  const rows = await db.setting.findMany({ where: { key: { in: secretKeys } }, select: { id: true, key: true, value: true } });
  const plain = rows.filter((row) => typeof row.value === "string" && row.value !== "" && !isEncrypted(row.value));
  if (plain.length === 0) return;
  if (!isEncryptionConfigured()) {
    r.secretsSkippedNoKey = true;
    console.log(`  ! ${plain.length} secret setting(s) are plain text (${plain.map((p) => p.key).join(", ")}) but DATA_ENCRYPTION_KEY is not set — not encrypted.`);
    return;
  }
  for (const row of plain) {
    r.secretsEncrypted.push(row.key);
    console.log(`  ~ setting ${row.key}: encrypted`);
    if (dry) continue;
    // Conditional on the value read, so a value saved meanwhile (already encrypted) is never touched.
    const done = await db.setting.updateMany({ where: { id: row.id, value: { equals: row.value as Prisma.InputJsonValue } }, data: { value: encryptSecret(row.value as string) } });
    if (done.count === 1) {
      await audit({ action: "secret_encrypted", module: "settings", recordType: "Setting", recordId: row.key, description: `System encrypted the stored value of setting ${row.key}` });
    }
  }
  if (!dry) invalidateSettingsCache();
}

export async function applyAdminSecurity(opts: { dryRun?: boolean } = {}): Promise<ApplyAdminSecurityResult> {
  const dry = !!opts.dryRun;
  const r: ApplyAdminSecurityResult = {
    permissionsCreated: 0,
    permissionsUpdated: 0,
    rolesCreated: [],
    roleLevelsSet: [],
    rolesSkipped: [],
    otherRolesFixed: 0,
    resetLinksHidden: 0,
    tempPasswordsRemoved: 0,
    auditLogsRedacted: 0,
    secretsEncrypted: [],
    secretsSkippedNoKey: false,
  };
  console.log("1. Permissions");
  await ensurePermissions(dry, r);
  console.log("2. Staff tier roles");
  await ensureTierRoles(dry, r);
  console.log("3. Notification log");
  await scrubNotifications(dry, r);
  console.log("4. Audit log");
  await scrubAuditLogs(dry, r);
  console.log("5. Secret settings stored as plain text");
  await encryptPlaintextSecrets(dry, r);
  return r;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-admin-security.ts"))) {
  const dryRun = process.argv.includes("--dry-run");
  applyAdminSecurity({ dryRun })
    .then(async (r) => {
      console.log(
        `\n${dryRun ? "DRY RUN — nothing written. Would change" : "Done. Changed"}:` +
          `\n  permissions   ${r.permissionsCreated} added, ${r.permissionsUpdated} relabelled` +
          `\n  tier roles    ${r.rolesCreated.length ? `created ${r.rolesCreated.join(", ")}` : "none created"}; ${r.roleLevelsSet.length ? `level set on ${r.roleLevelsSet.join(", ")}` : "levels already right"}` +
          (r.rolesSkipped.length ? `\n  SKIPPED       ${r.rolesSkipped.join("; ")}` : "") +
          `\n  other roles   ${r.otherRolesFixed} given tier 3` +
          `\n  notifications ${r.resetLinksHidden} reset link(s) hidden, ${r.tempPasswordsRemoved} temporary password(s) removed` +
          `\n  audit log     ${r.auditLogsRedacted} entr${r.auditLogsRedacted === 1 ? "y" : "ies"} redacted` +
          `\n  secrets       ${r.secretsEncrypted.length ? `encrypted ${r.secretsEncrypted.join(", ")}` : r.secretsSkippedNoKey ? "NOT encrypted (set DATA_ENCRYPTION_KEY and run again)" : "none stored as plain text"}`
      );
      await db.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await db.$disconnect();
      process.exit(1);
    });
}
