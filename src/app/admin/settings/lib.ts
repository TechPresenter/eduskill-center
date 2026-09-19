import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { SETTING_DEFAULTS, SETTING_GROUPS } from "@/lib/settings";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

// ───────────────────────────── Settings values ─────────────────────────────

export const settingsUpdateSchema = z.object({ values: z.record(z.string(), z.unknown()) });

/** Coerces a submitted value to the type declared in SETTING_DEFAULTS. Unknown keys are dropped. */
export function normalizeSettingValues(values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    const def = SETTING_DEFAULTS[key];
    if (!def) continue;
    const type = def.type ?? (typeof def.value === "boolean" ? "boolean" : typeof def.value === "number" ? "number" : "text");
    if (type === "boolean") out[key] = raw === true || raw === "true" || raw === "on" || raw === "1" || raw === 1;
    else if (type === "number") {
      if (raw === "" || raw === null || raw === undefined) out[key] = def.value;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) errors[key] = "Enter a valid number";
        else out[key] = n;
      }
    } else if (type === "select") {
      const v = String(raw ?? "");
      if (def.options && !def.options.some((o) => o.value === v)) errors[key] = "Choose one of the listed options";
      else out[key] = v;
    } else {
      const v = raw === null || raw === undefined ? "" : String(raw);
      if (v.length > 5000) errors[key] = "Value is too long";
      else out[key] = def.secret && v === "••••••••" ? "••••••••" : v.trim();
    }
  }
  if (Object.keys(errors).length) throw Errors.validation("Please correct the highlighted fields.", errors);
  return out;
}

export function settingGroup(key: string) {
  return SETTING_GROUPS.find((g) => g.key === key) ?? null;
}

/** Field definitions for one settings group (secrets masked by caller). */
export function settingsGroupFields(group: string) {
  return Object.entries(SETTING_DEFAULTS)
    .filter(([, def]) => def.group === group)
    .map(([key, def]) => ({ key, label: def.label, type: def.type ?? (typeof def.value === "boolean" ? "boolean" : typeof def.value === "number" ? "number" : "text"), options: def.options ?? null, help: def.help ?? null, secret: !!def.secret, isPublic: def.isPublic, defaultValue: def.value }));
}

// ───────────────────────────── Document types ─────────────────────────────

export const documentTypeSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{1,40}$/, "Use lowercase letters, digits and underscores (e.g. id_proof)"),
  name: z.string().trim().min(2, "Enter a name").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  appliesTo: z.enum(["STUDENT", "TRAINER"]),
  isRequired: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});
export type DocumentTypeInput = z.infer<typeof documentTypeSchema>;

export async function listDocumentTypes() {
  return db.documentType.findMany({ orderBy: [{ appliesTo: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
}

export async function createDocumentType(input: DocumentTypeInput, ctx: Ctx) {
  const dupe = await db.documentType.findUnique({ where: { key: input.key } });
  if (dupe) throw Errors.validation("Please correct the highlighted fields.", { key: "This key is already used" });
  const row = await db.documentType.create({ data: { ...input, description: input.description || null } });
  await audit({ user: ctx.user, action: "create", module: "settings", recordType: "DocumentType", recordId: row.id, description: `${ctx.user.name} added document type ${row.name} (${row.appliesTo})`, newValue: row, ip: ctx.ip, userAgent: ctx.userAgent });
  return row;
}

export async function updateDocumentType(id: string, input: DocumentTypeInput, ctx: Ctx) {
  const existing = await db.documentType.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Document type");
  if (input.key !== existing.key) {
    const dupe = await db.documentType.findUnique({ where: { key: input.key } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { key: "This key is already used" });
    const used = await db.course.count({ where: { requiredDocuments: { has: existing.key } } });
    if (used) throw Errors.conflict(`The key "${existing.key}" is referenced by ${used} course(s) and cannot be renamed.`);
  }
  const row = await db.documentType.update({ where: { id }, data: { ...input, description: input.description || null } });
  await audit({ user: ctx.user, action: "update", module: "settings", recordType: "DocumentType", recordId: id, description: `${ctx.user.name} updated document type ${row.name}`, oldValue: existing, newValue: row, ip: ctx.ip, userAgent: ctx.userAgent });
  return row;
}

export async function deleteDocumentType(id: string, ctx: Ctx) {
  const existing = await db.documentType.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Document type");
  const [courses, studentDocs, trainerDocs] = await Promise.all([
    db.course.count({ where: { requiredDocuments: { has: existing.key } } }),
    db.studentDocument.count({ where: { type: existing.key } }),
    db.trainerDocument.count({ where: { type: existing.key } }),
  ]);
  if (courses || studentDocs || trainerDocs) throw Errors.conflict("This document type is in use (courses or uploaded documents reference it). Deactivate it instead.");
  await db.documentType.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "settings", recordType: "DocumentType", recordId: id, description: `${ctx.user.name} deleted document type ${existing.name}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Impact stats ─────────────────────────────

export const impactStatSchema = z.object({
  label: z.string().trim().min(2, "Enter a label").max(80),
  source: z.enum(["AUTO", "MANUAL"]),
  manualValue: z.union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000_000)]).optional().nullable(),
  suffix: z.string().trim().max(5).default("+"),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.coerce.boolean().default(true),
});
export type ImpactStatInput = z.infer<typeof impactStatSchema>;

/** Live values behind each AUTO impact stat key. */
export async function computeAutoImpactValues(): Promise<Record<string, number | null>> {
  const [students, centers, trainers, states, completed, dropped] = await Promise.all([
    db.student.count({ where: { deletedAt: null, studentId: { not: null } } }),
    db.center.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.trainer.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.center.groupBy({ by: ["stateId"], where: { deletedAt: null, status: "ACTIVE" } }).then((r) => r.length),
    db.admission.count({ where: { status: "COMPLETED" } }),
    db.admission.count({ where: { status: "DROPPED" } }),
  ]);
  return { students, centers, trainers, states, completion: completed + dropped > 0 ? Math.round((completed / (completed + dropped)) * 100) : null };
}

export async function listImpactStats() {
  const [rows, auto] = await Promise.all([db.impactStat.findMany({ orderBy: { sortOrder: "asc" } }), computeAutoImpactValues()]);
  return rows.map((r) => {
    const autoValue = auto[r.key] ?? null;
    return { ...r, autoValue, effectiveValue: r.source === "MANUAL" ? r.manualValue : autoValue };
  });
}

export async function updateImpactStat(id: string, input: ImpactStatInput, ctx: Ctx) {
  const existing = await db.impactStat.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Impact stat");
  if (input.source === "MANUAL" && typeof input.manualValue !== "number") throw Errors.validation("Please correct the highlighted fields.", { manualValue: "Enter the value to display" });
  const row = await db.impactStat.update({ where: { id }, data: { label: input.label, source: input.source, manualValue: typeof input.manualValue === "number" ? input.manualValue : null, suffix: input.suffix, sortOrder: input.sortOrder, isActive: input.isActive } });
  await audit({ user: ctx.user, action: "update", module: "settings", recordType: "ImpactStat", recordId: id, description: `${ctx.user.name} updated impact stat ${row.label}`, oldValue: existing, newValue: row, ip: ctx.ip, userAgent: ctx.userAgent });
  return row;
}
