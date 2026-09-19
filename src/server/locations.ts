import { z } from "zod";
import Papa from "papaparse";
import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalBool } from "@/lib/api/query";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

// ───────────────────────────── Schemas ─────────────────────────────

const nameField = z.string().trim().min(2, "Enter a name").max(100);
const optionalInt = z.coerce.number().int().min(0).max(100000).optional();
const boolField = z.coerce.boolean().optional();

export const stateInputSchema = z.object({
  name: nameField,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,3}$/, "Use a 2–3 letter code (e.g. WB)"),
  isActive: boolField,
  sortOrder: optionalInt,
});
export type StateInput = z.infer<typeof stateInputSchema>;

export const districtInputSchema = z.object({
  stateId: z.string().uuid("Select a state"),
  name: nameField,
  code: z
    .union([z.literal(""), z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3}$/, "Use a 3-character code (letters/digits)")])
    .optional()
    .nullable(),
  isActive: boolField,
  sortOrder: optionalInt,
});
export type DistrictInput = z.infer<typeof districtInputSchema>;

export const blockInputSchema = z.object({
  districtId: z.string().uuid("Select a district"),
  name: nameField,
  code: z.union([z.literal(""), z.string().trim().toUpperCase().max(10)]).optional().nullable(),
  isActive: boolField,
  sortOrder: optionalInt,
});
export type BlockInput = z.infer<typeof blockInputSchema>;

export const bulkBlockSchema = z.object({
  districtId: z.string().uuid("Select a district"),
  names: z.array(z.string().trim().min(2).max(100)).min(1, "Add at least one block name").max(300),
});

export const locationListSchema = paginationSchema.extend({
  stateId: optionalUuid,
  districtId: optionalUuid,
  active: optionalBool,
});
export type LocationListQuery = z.infer<typeof locationListSchema>;

// ───────────────────────────── Helpers ─────────────────────────────

/** Derives a unique 3-letter district code (same approach as the seed). */
export function deriveDistrictCode(name: string, taken: Set<string>): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  const candidates: string[] = [];
  candidates.push(letters.slice(0, 3));
  const consonants = letters.replace(/[AEIOU]/g, "");
  candidates.push((letters[0] ?? "") + consonants.slice(1, 3));
  const words = name.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  if (words.length >= 2) candidates.push(words.map((w) => w[0]).join("").slice(0, 3).padEnd(3, letters[1] ?? "X"));
  for (const c of candidates) {
    if (c.length === 3 && !taken.has(c)) return c;
  }
  let i = 2;
  while (taken.has(`${letters.slice(0, 2)}${i}`)) i++;
  return `${letters.slice(0, 2)}${i}`;
}

async function takenDistrictCodes(stateId: string, client: Prisma.TransactionClient | typeof db = db) {
  const rows = await client.district.findMany({ where: { stateId }, select: { code: true } });
  return new Set(rows.map((r) => r.code));
}

function ci(value: string) {
  return { equals: value, mode: "insensitive" as const };
}

// ───────────────────────────── Overview ─────────────────────────────

export async function locationOverview() {
  const [states, activeStates, districts, activeDistricts, blocks, activeBlocks, statesWithCenters, districtsWithCenters, blocksWithCenters] = await Promise.all([
    db.state.count(),
    db.state.count({ where: { isActive: true } }),
    db.district.count(),
    db.district.count({ where: { isActive: true } }),
    db.block.count(),
    db.block.count({ where: { isActive: true } }),
    db.center.groupBy({ by: ["stateId"], where: { deletedAt: null, status: "ACTIVE" } }).then((r) => r.length),
    db.center.groupBy({ by: ["districtId"], where: { deletedAt: null, status: "ACTIVE" } }).then((r) => r.length),
    db.center.groupBy({ by: ["blockId"], where: { deletedAt: null, status: "ACTIVE" } }).then((r) => r.length),
  ]);
  return { states, activeStates, districts, activeDistricts, blocks, activeBlocks, statesWithCenters, districtsWithCenters, blocksWithCenters };
}

// ───────────────────────────── States ─────────────────────────────

export async function listStates(q: LocationListQuery) {
  const where: Prisma.StateWhereInput = {};
  if (q.active !== undefined) where.isActive = q.active;
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.order === "desc" && !q.sort ? "asc" : q.order, ["name", "code", "sortOrder", "createdAt"] as const, "name");
  const [items, total] = await Promise.all([
    db.state.findMany({ where, orderBy: [{ sortOrder: "asc" }, orderBy], ...getPaging(q), include: { _count: { select: { districts: true, centers: { where: { deletedAt: null } }, students: true, trainers: true } } } }),
    db.state.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function allStates() {
  return db.state.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true, isActive: true } });
}

export async function createState(input: StateInput, ctx: Ctx) {
  const dupe = await db.state.findFirst({ where: { OR: [{ name: ci(input.name) }, { code: input.code }] } });
  if (dupe) throw Errors.validation("Please correct the highlighted fields.", { [dupe.code === input.code ? "code" : "name"]: dupe.code === input.code ? "This code is already used" : "A state with this name already exists" });
  const state = await db.state.create({ data: { name: input.name, code: input.code, slug: slugify(input.name), isActive: input.isActive ?? true, sortOrder: input.sortOrder ?? 0 } });
  await audit({ user: ctx.user, action: "create", module: "locations", recordType: "State", recordId: state.id, description: `${ctx.user.name} added state ${state.name} (${state.code})`, newValue: state, ip: ctx.ip, userAgent: ctx.userAgent });
  return state;
}

export async function updateState(id: string, input: Partial<StateInput>, ctx: Ctx) {
  const existing = await db.state.findUnique({ where: { id }, include: { _count: { select: { centers: { where: { deletedAt: null } } } } } });
  if (!existing) throw Errors.notFound("State");
  if (input.code && input.code !== existing.code) {
    if (existing._count.centers > 0) throw Errors.conflict("The state code is part of existing center codes and cannot be changed while centers exist in this state.");
    const dupe = await db.state.findFirst({ where: { code: input.code, id: { not: id } } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { code: "This code is already used" });
  }
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const dupe = await db.state.findFirst({ where: { name: ci(input.name), id: { not: id } } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A state with this name already exists" });
  }
  const state = await db.state.update({
    where: { id },
    data: { name: input.name, code: input.code, slug: input.name ? slugify(input.name) : undefined, isActive: input.isActive, sortOrder: input.sortOrder },
  });
  const action = input.isActive !== undefined && input.isActive !== existing.isActive ? (input.isActive ? "activate" : "deactivate") : "update";
  await audit({ user: ctx.user, action, module: "locations", recordType: "State", recordId: id, description: `${ctx.user.name} ${action}d state ${state.name}`, oldValue: existing, newValue: state, ip: ctx.ip, userAgent: ctx.userAgent });
  return { ...state, affectedCenters: existing._count.centers };
}

export async function deleteState(id: string, ctx: Ctx) {
  const existing = await db.state.findUnique({ where: { id }, include: { _count: { select: { districts: true, centers: true, students: true, trainers: true, trainerApplications: true } } } });
  if (!existing) throw Errors.notFound("State");
  const c = existing._count;
  if (c.districts || c.centers || c.students || c.trainers || c.trainerApplications) {
    throw Errors.conflict("This state has districts or records linked to it. Deactivate it instead of deleting.");
  }
  await db.state.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "locations", recordType: "State", recordId: id, description: `${ctx.user.name} deleted state ${existing.name}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Districts ─────────────────────────────

export async function listDistricts(q: LocationListQuery) {
  const where: Prisma.DistrictWhereInput = {};
  if (q.stateId) where.stateId = q.stateId;
  if (q.active !== undefined) where.isActive = q.active;
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.sort ? q.order : "asc", ["name", "code", "sortOrder", "createdAt"] as const, "name");
  const [items, total] = await Promise.all([
    db.district.findMany({ where, orderBy: [{ state: { name: "asc" } }, orderBy], ...getPaging(q), include: { state: { select: { id: true, name: true, code: true } }, _count: { select: { blocks: true, centers: { where: { deletedAt: null } }, students: true } } } }),
    db.district.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function createDistrict(input: DistrictInput, ctx: Ctx) {
  const state = await db.state.findUnique({ where: { id: input.stateId } });
  if (!state) throw Errors.validation("Please correct the highlighted fields.", { stateId: "Select a valid state" });
  const dupe = await db.district.findFirst({ where: { stateId: state.id, name: ci(input.name) } });
  if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: `${input.name} already exists in ${state.name}` });
  const taken = await takenDistrictCodes(state.id);
  let code = input.code ? input.code.toUpperCase() : "";
  if (code) {
    if (taken.has(code)) throw Errors.validation("Please correct the highlighted fields.", { code: `Code ${code} is already used in ${state.name}` });
  } else code = deriveDistrictCode(input.name, taken);
  const district = await db.district.create({ data: { stateId: state.id, name: input.name, code, slug: slugify(input.name), isActive: input.isActive ?? true, sortOrder: input.sortOrder ?? 0 } });
  await audit({ user: ctx.user, action: "create", module: "locations", recordType: "District", recordId: district.id, description: `${ctx.user.name} added district ${district.name} (${state.code}-${district.code})`, newValue: district, ip: ctx.ip, userAgent: ctx.userAgent });
  return district;
}

export async function updateDistrict(id: string, input: Partial<DistrictInput>, ctx: Ctx) {
  const existing = await db.district.findUnique({ where: { id }, include: { state: true, _count: { select: { centers: { where: { deletedAt: null } } } } } });
  if (!existing) throw Errors.notFound("District");
  if (input.stateId && input.stateId !== existing.stateId) {
    if (existing._count.centers > 0) throw Errors.conflict("A district with training centers cannot be moved to another state.");
  }
  const stateId = input.stateId ?? existing.stateId;
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const dupe = await db.district.findFirst({ where: { stateId, name: ci(input.name), id: { not: id } } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A district with this name already exists in this state" });
  }
  let code: string | undefined;
  if (input.code !== undefined && input.code !== null && input.code !== "" && input.code.toUpperCase() !== existing.code) {
    if (existing._count.centers > 0) throw Errors.conflict("The district code is embedded in permanent center codes and cannot be changed once a center uses it.");
    code = input.code.toUpperCase();
    const dupe = await db.district.findFirst({ where: { stateId, code, id: { not: id } } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { code: "This code is already used in this state" });
  }
  const district = await db.district.update({
    where: { id },
    data: { stateId: input.stateId, name: input.name, code, slug: input.name ? slugify(input.name) : undefined, isActive: input.isActive, sortOrder: input.sortOrder },
  });
  const action = input.isActive !== undefined && input.isActive !== existing.isActive ? (input.isActive ? "activate" : "deactivate") : "update";
  await audit({ user: ctx.user, action, module: "locations", recordType: "District", recordId: id, description: `${ctx.user.name} ${action}d district ${district.name}`, oldValue: existing, newValue: district, ip: ctx.ip, userAgent: ctx.userAgent });
  return district;
}

export async function deleteDistrict(id: string, ctx: Ctx) {
  const existing = await db.district.findUnique({ where: { id }, include: { _count: { select: { blocks: true, centers: true, students: true, trainers: true, trainerApplications: true } } } });
  if (!existing) throw Errors.notFound("District");
  const c = existing._count;
  if (c.blocks || c.centers || c.students || c.trainers || c.trainerApplications) throw Errors.conflict("This district has blocks or records linked to it. Deactivate it instead of deleting.");
  await db.district.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "locations", recordType: "District", recordId: id, description: `${ctx.user.name} deleted district ${existing.name}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Blocks ─────────────────────────────

export async function listBlocks(q: LocationListQuery) {
  const where: Prisma.BlockWhereInput = {};
  if (q.districtId) where.districtId = q.districtId;
  else if (q.stateId) where.district = { stateId: q.stateId };
  if (q.active !== undefined) where.isActive = q.active;
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.sort ? q.order : "asc", ["name", "code", "sortOrder", "createdAt"] as const, "name");
  const [items, total] = await Promise.all([
    db.block.findMany({ where, orderBy: [{ district: { state: { name: "asc" } } }, { district: { name: "asc" } }, orderBy], ...getPaging(q), include: { district: { select: { id: true, name: true, code: true, state: { select: { id: true, name: true, code: true } } } }, _count: { select: { centers: { where: { deletedAt: null } }, students: true } } } }),
    db.block.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function createBlocks(input: z.infer<typeof bulkBlockSchema>, ctx: Ctx) {
  const district = await db.district.findUnique({ where: { id: input.districtId }, include: { state: { select: { code: true, name: true } } } });
  if (!district) throw Errors.validation("Please correct the highlighted fields.", { districtId: "Select a valid district" });
  const existing = await db.block.findMany({ where: { districtId: district.id }, select: { name: true, slug: true } });
  const existingNames = new Set(existing.map((b) => b.name.toLowerCase()));
  const existingSlugs = new Set(existing.map((b) => b.slug));
  // Case-insensitive de-duplication that keeps the first spelling the user typed.
  const seen = new Map<string, string>();
  for (const n of input.names) if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  const unique = Array.from(seen.values());
  const created: { id: string; name: string }[] = [];
  const skipped: string[] = [];
  for (const name of unique) {
    let slug = slugify(name) || "block";
    if (existingNames.has(name.toLowerCase())) {
      skipped.push(name);
      continue;
    }
    let i = 1;
    while (existingSlugs.has(slug)) slug = `${slugify(name)}-${++i}`;
    const b = await db.block.create({ data: { districtId: district.id, name, slug, isActive: true } });
    existingNames.add(name.toLowerCase());
    existingSlugs.add(slug);
    created.push({ id: b.id, name: b.name });
  }
  if (created.length) {
    await audit({ user: ctx.user, action: "create", module: "locations", recordType: "Block", recordId: district.id, description: `${ctx.user.name} added ${created.length} block(s) to ${district.name}, ${district.state.name}`, newValue: { districtId: district.id, blocks: created.map((c) => c.name) }, ip: ctx.ip, userAgent: ctx.userAgent });
  }
  return { created, skipped };
}

export async function updateBlock(id: string, input: Partial<BlockInput>, ctx: Ctx) {
  const existing = await db.block.findUnique({ where: { id }, include: { _count: { select: { centers: { where: { deletedAt: null } } } } } });
  if (!existing) throw Errors.notFound("Block");
  if (input.districtId && input.districtId !== existing.districtId && existing._count.centers > 0) throw Errors.conflict("A block with training centers cannot be moved to another district.");
  const districtId = input.districtId ?? existing.districtId;
  let slug: string | undefined;
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const dupe = await db.block.findFirst({ where: { districtId, name: ci(input.name), id: { not: id } } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A block with this name already exists in this district" });
    slug = slugify(input.name);
    let i = 1;
    while (await db.block.findFirst({ where: { districtId, slug, id: { not: id } }, select: { id: true } })) slug = `${slugify(input.name)}-${++i}`;
  }
  const block = await db.block.update({
    where: { id },
    data: { districtId: input.districtId, name: input.name, slug, code: input.code === undefined ? undefined : input.code || null, isActive: input.isActive, sortOrder: input.sortOrder },
  });
  const action = input.isActive !== undefined && input.isActive !== existing.isActive ? (input.isActive ? "activate" : "deactivate") : "update";
  await audit({ user: ctx.user, action, module: "locations", recordType: "Block", recordId: id, description: `${ctx.user.name} ${action}d block ${block.name}`, oldValue: existing, newValue: block, ip: ctx.ip, userAgent: ctx.userAgent });
  return block;
}

export async function deleteBlock(id: string, ctx: Ctx) {
  const existing = await db.block.findUnique({ where: { id }, include: { _count: { select: { centers: true, students: true, trainers: true, trainerApplications: true } } } });
  if (!existing) throw Errors.notFound("Block");
  const c = existing._count;
  if (c.centers || c.students || c.trainers || c.trainerApplications) throw Errors.conflict("This block has training centers or records linked to it. Deactivate it instead of deleting.");
  await db.block.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "locations", recordType: "Block", recordId: id, description: `${ctx.user.name} deleted block ${existing.name}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── CSV import / export ─────────────────────────────

export interface ImportRowResult {
  row: number;
  state: string;
  district: string;
  block: string;
  stateAction: "created" | "exists" | "error" | "skipped";
  districtAction: "created" | "exists" | "error" | "skipped";
  blockAction: "created" | "exists" | "error" | "skipped" | "none";
  error?: string;
}

export interface ImportReport {
  commit: boolean;
  totalRows: number;
  created: { states: number; districts: number; blocks: number };
  existing: { states: number; districts: number; blocks: number };
  errors: number;
  rows: ImportRowResult[];
}

const HEADER_ALIASES: Record<string, string> = {
  state: "state_name",
  statename: "state_name",
  state_name: "state_name",
  statecode: "state_code",
  state_code: "state_code",
  district: "district_name",
  districtname: "district_name",
  district_name: "district_name",
  districtcode: "district_code",
  district_code: "district_code",
  block: "block_name",
  blockname: "block_name",
  block_name: "block_name",
  blockcode: "block_code",
  block_code: "block_code",
};

function normalizeHeader(h: string) {
  const key = h.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return HEADER_ALIASES[key] ?? HEADER_ALIASES[key.replace(/_/g, "")] ?? key;
}

/**
 * Parses a CSV (state_name or state_code, district_name, district_code?, block_name?, block_code?)
 * and upserts the hierarchy. With `commit=false` the plan is computed without writing.
 */
export async function importLocationsCsv(csvText: string, opts: { commit: boolean }, ctx: Ctx): Promise<ImportReport> {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: "greedy", transformHeader: normalizeHeader });
  if (parsed.errors.length && parsed.data.length === 0) throw Errors.badRequest(`Could not parse CSV: ${parsed.errors[0]?.message ?? "unknown error"}`);
  const rows = parsed.data.slice(0, 5000);
  if (rows.length === 0) throw Errors.badRequest("The CSV file has no data rows.");
  const headers = parsed.meta.fields ?? [];
  if (!headers.includes("state_name") && !headers.includes("state_code")) throw Errors.badRequest("CSV must include a state_name or state_code column.");

  const states = await db.state.findMany({ include: { districts: { include: { blocks: { select: { id: true, name: true, slug: true } } } } } });
  type DistrictNode = { id: string | null; name: string; code: string; blocks: Map<string, { id: string | null; name: string }>; codes: Set<string>; slugs: Set<string> };
  type StateNode = { id: string | null; name: string; code: string; districts: Map<string, DistrictNode>; codes: Set<string> };
  const byName = new Map<string, StateNode>();
  const byCode = new Map<string, StateNode>();
  for (const s of states) {
    const node: StateNode = { id: s.id, name: s.name, code: s.code, districts: new Map(), codes: new Set(s.districts.map((d) => d.code)) };
    for (const d of s.districts) {
      node.districts.set(d.name.toLowerCase(), { id: d.id, name: d.name, code: d.code, blocks: new Map(d.blocks.map((b) => [b.name.toLowerCase(), { id: b.id, name: b.name }])), codes: new Set(), slugs: new Set(d.blocks.map((b) => b.slug)) });
    }
    byName.set(s.name.toLowerCase(), node);
    byCode.set(s.code.toUpperCase(), node);
  }

  const report: ImportReport = { commit: opts.commit, totalRows: rows.length, created: { states: 0, districts: 0, blocks: 0 }, existing: { states: 0, districts: 0, blocks: 0 }, errors: 0, rows: [] };
  const plan: (() => Promise<void>)[] = [];

  rows.forEach((raw, idx) => {
    const rowNo = idx + 2;
    const stateName = (raw.state_name ?? "").trim();
    const stateCode = (raw.state_code ?? "").trim().toUpperCase();
    const districtName = (raw.district_name ?? "").trim();
    const districtCode = (raw.district_code ?? "").trim().toUpperCase();
    const blockName = (raw.block_name ?? "").trim();
    const blockCode = (raw.block_code ?? "").trim().toUpperCase();
    const result: ImportRowResult = { row: rowNo, state: stateName || stateCode, district: districtName, block: blockName, stateAction: "skipped", districtAction: "skipped", blockAction: blockName ? "skipped" : "none" };
    const fail = (msg: string) => {
      result.error = msg;
      if (result.stateAction === "skipped") result.stateAction = "error";
      if (result.districtAction === "skipped") result.districtAction = "error";
      if (result.blockAction === "skipped") result.blockAction = "error";
      report.errors++;
      report.rows.push(result);
    };

    // State
    let state = (stateCode && byCode.get(stateCode)) || (stateName && byName.get(stateName.toLowerCase())) || null;
    if (!state) {
      if (!stateName || !stateCode) return fail(stateName || stateCode ? "Unknown state. Provide both state_name and state_code to create it." : "Missing state.");
      if (!/^[A-Z]{2,3}$/.test(stateCode)) return fail(`Invalid state code "${stateCode}" (2–3 letters).`);
      state = { id: null, name: stateName, code: stateCode, districts: new Map(), codes: new Set() };
      byName.set(stateName.toLowerCase(), state);
      byCode.set(stateCode, state);
      result.stateAction = "created";
      report.created.states++;
      const node = state;
      plan.push(async () => {
        const s = await db.state.create({ data: { name: node.name, code: node.code, slug: slugify(node.name) } });
        node.id = s.id;
      });
    } else {
      result.stateAction = "exists";
      report.existing.states++;
    }

    if (!districtName) {
      result.districtAction = "skipped";
      result.blockAction = blockName ? "error" : "none";
      if (blockName) return fail("block_name requires a district_name.");
      report.rows.push(result);
      return;
    }

    // District
    let district = state.districts.get(districtName.toLowerCase()) ?? null;
    if (!district) {
      let code = districtCode;
      if (code) {
        if (!/^[A-Z0-9]{3}$/.test(code)) return fail(`Invalid district code "${code}" (3 characters).`);
        if (state.codes.has(code)) return fail(`District code ${code} already used in ${state.name}.`);
      } else code = deriveDistrictCode(districtName, state.codes);
      state.codes.add(code);
      district = { id: null, name: districtName, code, blocks: new Map(), codes: new Set(), slugs: new Set() };
      state.districts.set(districtName.toLowerCase(), district);
      result.districtAction = "created";
      report.created.districts++;
      const sNode = state;
      const dNode = district;
      plan.push(async () => {
        const d = await db.district.create({ data: { stateId: sNode.id!, name: dNode.name, code: dNode.code, slug: slugify(dNode.name) } });
        dNode.id = d.id;
      });
    } else {
      result.districtAction = "exists";
      report.existing.districts++;
      if (districtCode && districtCode !== district.code) result.error = `district_code ignored (existing code ${district.code} is permanent).`;
    }

    // Block
    if (blockName) {
      const block = district.blocks.get(blockName.toLowerCase());
      if (block) {
        result.blockAction = "exists";
        report.existing.blocks++;
      } else {
        let slug = slugify(blockName) || "block";
        let i = 1;
        while (district.slugs.has(slug)) slug = `${slugify(blockName)}-${++i}`;
        district.slugs.add(slug);
        district.blocks.set(blockName.toLowerCase(), { id: null, name: blockName });
        result.blockAction = "created";
        report.created.blocks++;
        const dNode = district;
        const bSlug = slug;
        plan.push(async () => {
          await db.block.create({ data: { districtId: dNode.id!, name: blockName, slug: bSlug, code: blockCode || null } });
        });
      }
    } else result.blockAction = "none";
    report.rows.push(result);
  });

  if (opts.commit && plan.length) {
    for (const step of plan) await step();
    await audit({ user: ctx.user, action: "import", module: "locations", recordType: "Import", description: `${ctx.user.name} imported locations from CSV: ${report.created.states} states, ${report.created.districts} districts, ${report.created.blocks} blocks created (${report.errors} row errors)`, newValue: { created: report.created, existing: report.existing, errors: report.errors, totalRows: report.totalRows }, ip: ctx.ip, userAgent: ctx.userAgent });
  }
  return report;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Full hierarchy export (one row per block, or per district when it has no blocks). */
export async function exportLocationsCsv(filter: { stateId?: string } = {}): Promise<string> {
  const states = await db.state.findMany({
    where: filter.stateId ? { id: filter.stateId } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { districts: { orderBy: { name: "asc" }, include: { blocks: { orderBy: { name: "asc" } }, _count: { select: { centers: { where: { deletedAt: null } } } } } } },
  });
  const lines = ["state_name,state_code,state_active,district_name,district_code,district_active,block_name,block_code,block_active,centers_in_district"];
  for (const s of states) {
    if (s.districts.length === 0) lines.push([s.name, s.code, s.isActive, "", "", "", "", "", "", 0].map(csvCell).join(","));
    for (const d of s.districts) {
      if (d.blocks.length === 0) lines.push([s.name, s.code, s.isActive, d.name, d.code, d.isActive, "", "", "", d._count.centers].map(csvCell).join(","));
      for (const b of d.blocks) lines.push([s.name, s.code, s.isActive, d.name, d.code, d.isActive, b.name, b.code ?? "", b.isActive, d._count.centers].map(csvCell).join(","));
    }
  }
  return lines.join("\r\n") + "\r\n";
}
