/**
 * Course CMS services — curriculum, fee plan, offers, per-course FAQ and media.
 *
 * Everything the public course page shows is a row in one of these tables, so the Foundation can
 * add unlimited courses, modules, fees, offers, FAQs and images from the admin panel without a
 * code change. This module is purely additive: `Course.courseFee` / `registrationFee` / `examFee`
 * / `certificateFee` and every Application, Payment and Admission that reads them are untouched.
 *
 * Conventions (see CLAUDE.md): services own transactions, convert Decimals with `toNumber()` at
 * the boundary and call `audit()` on every mutation. Inside `$transaction` the client is one
 * connection, so nothing here runs `Promise.all` on a transaction client.
 */
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { CourseFeeType, CourseMediaKind, CourseNodeKind } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { toNumber } from "@/lib/utils";
import { money, optionalString, uuid } from "@/lib/validation/common";
import {
  feeDisplayFromCourse,
  formatCourseFee,
  pickEffectiveOffer,
  type FeeDisplay,
  type FeePlanLike,
} from "@/lib/course-pricing";
import type { Ctx } from "@/server/courses";

export type { Ctx };

const AUDIT_MODULE = "courses";

// ───────────────────────────── Shared schema pieces ─────────────────────────────

/** A stored path from `src/lib/storage` (`/api/files/...`) or an external URL. Never base64. */
const mediaPath = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => !v.toLowerCase().startsWith("data:"), "Upload the file instead of pasting inline data");
const optionalMediaPath = z.union([z.literal(""), mediaPath]).optional().nullable();

export const reorderSchema = z.object({ ids: z.array(uuid).min(1).max(1000) });
export type ReorderInput = z.infer<typeof reorderSchema>;

function blank(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v || null;
}

async function assertCourse(courseId: string) {
  const course = await db.course.findFirst({ where: { id: courseId, deletedAt: null }, select: { id: true, code: true, name: true } });
  if (!course) throw Errors.notFound("Course");
  return course;
}

/**
 * Renumbers an ordered collection to a dense 1..n in ONE transaction. `ids` must be the complete
 * set for that scope — a drag-and-drop UI always holds the whole list, and demanding it is what
 * guarantees the result has no gaps and no duplicate positions.
 */
function assertCompleteOrder(ids: string[], existing: { id: string }[]) {
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw Errors.badRequest("The new order repeats an item.");
  const known = new Set(existing.map((r) => r.id));
  const strangers = ids.filter((id) => !known.has(id));
  if (strangers.length) throw Errors.badRequest("The new order contains items that do not belong here.");
  if (ids.length !== known.size) throw Errors.badRequest(`Send all ${known.size} item(s) in the new order.`);
}

// ───────────────────────────── Curriculum (CourseNode) ─────────────────────────────

const NODE_KINDS = ["MODULE", "CHAPTER", "TOPIC", "LESSON"] as const;
/** Depth rank. A child must sit strictly deeper than its parent; a LESSON is a leaf. */
const NODE_RANK: Record<CourseNodeKind, number> = { MODULE: 0, CHAPTER: 1, TOPIC: 2, LESSON: 3 };

export const courseNodeInputSchema = z.object({
  parentId: z.union([z.literal(""), uuid]).optional().nullable(),
  kind: z.enum(NODE_KINDS).default("MODULE"),
  title: z.string().trim().min(1, "Enter a title").max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  videoUrl: optionalMediaPath,
  documentUrl: optionalMediaPath,
  studyMaterialUrl: optionalMediaPath,
  durationText: z.string().trim().max(60).optional().nullable(),
  durationMinutes: z.union([z.literal(""), z.coerce.number().int().min(0).max(100_000)]).optional().nullable(),
  isFreePreview: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});
export type CourseNodeInput = z.infer<typeof courseNodeInputSchema>;

export interface CourseNodeDto {
  id: string;
  courseId: string;
  parentId: string | null;
  kind: CourseNodeKind;
  title: string;
  description: string | null;
  sortOrder: number;
  videoUrl: string | null;
  documentUrl: string | null;
  studyMaterialUrl: string | null;
  durationText: string | null;
  durationMinutes: number | null;
  isFreePreview: boolean;
  isActive: boolean;
}

export interface CourseNodeTreeItem extends CourseNodeDto {
  children: CourseNodeTreeItem[];
}

type NodeRow = {
  id: string;
  courseId: string;
  parentId: string | null;
  kind: CourseNodeKind;
  title: string;
  description: string | null;
  sortOrder: number;
  videoUrl: string | null;
  documentUrl: string | null;
  studyMaterialUrl: string | null;
  durationText: string | null;
  durationMinutes: number | null;
  isFreePreview: boolean;
  isActive: boolean;
};

function toNodeDto(n: NodeRow): CourseNodeDto {
  return {
    id: n.id,
    courseId: n.courseId,
    parentId: n.parentId,
    kind: n.kind,
    title: n.title,
    description: n.description,
    sortOrder: n.sortOrder,
    videoUrl: n.videoUrl,
    documentUrl: n.documentUrl,
    studyMaterialUrl: n.studyMaterialUrl,
    durationText: n.durationText,
    durationMinutes: n.durationMinutes,
    isFreePreview: n.isFreePreview,
    isActive: n.isActive,
  };
}

const nodeSelect = {
  id: true,
  courseId: true,
  parentId: true,
  kind: true,
  title: true,
  description: true,
  sortOrder: true,
  videoUrl: true,
  documentUrl: true,
  studyMaterialUrl: true,
  durationText: true,
  durationMinutes: true,
  isFreePreview: true,
  isActive: true,
} as const;

/** Flat list, ordered. Feeds the admin curriculum editor. */
export async function listCourseNodes(courseId: string, opts: { activeOnly?: boolean } = {}): Promise<CourseNodeDto[]> {
  const rows = await db.courseNode.findMany({
    where: { courseId, deletedAt: null, ...(opts.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: nodeSelect,
  });
  return rows.map(toNodeDto);
}

/**
 * Builds the MODULE → CHAPTER → TOPIC → LESSON tree from one flat query. A node whose parent is not
 * in the list — on the public page, a hidden (inactive) module or chapter — is dropped together with
 * everything under it, never promoted to the top level: hiding a module hides its lessons.
 */
export function buildCourseNodeTree(nodes: CourseNodeDto[]): CourseNodeTreeItem[] {
  const byId = new Map<string, CourseNodeTreeItem>();
  for (const n of nodes) byId.set(n.id, { ...n, children: [] });
  const roots: CourseNodeTreeItem[] = [];
  for (const n of nodes) {
    const item = byId.get(n.id)!;
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent) parent.children.push(item);
    else if (!n.parentId) roots.push(item);
  }
  const sort = (list: CourseNodeTreeItem[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
    for (const child of list) sort(child.children);
  };
  sort(roots);
  return roots;
}

export async function getCourseCurriculum(courseId: string, opts: { activeOnly?: boolean } = {}): Promise<CourseNodeTreeItem[]> {
  return buildCourseNodeTree(await listCourseNodes(courseId, opts));
}

async function resolveParent(courseId: string, parentId: string | null, kind: CourseNodeKind, selfId?: string) {
  if (!parentId) return null;
  if (selfId && parentId === selfId) throw Errors.badRequest("An item cannot be its own parent.");
  const parent = await db.courseNode.findFirst({ where: { id: parentId, courseId, deletedAt: null }, select: { id: true, kind: true, parentId: true } });
  if (!parent) throw Errors.validation("Please correct the highlighted fields.", { parentId: "Select a parent from this course" });
  if (parent.kind === "LESSON") throw Errors.validation("Please correct the highlighted fields.", { parentId: "A lesson cannot contain other items" });
  if (NODE_RANK[kind] <= NODE_RANK[parent.kind]) {
    throw Errors.validation("Please correct the highlighted fields.", { kind: `A ${kind.toLowerCase()} cannot sit inside a ${parent.kind.toLowerCase()}` });
  }
  if (selfId) {
    // Walk up from the chosen parent: moving a node under its own descendant would orphan a cycle.
    let cursor: string | null = parent.parentId;
    while (cursor) {
      if (cursor === selfId) throw Errors.badRequest("An item cannot be moved inside one of its own children.");
      const up: { parentId: string | null } | null = await db.courseNode.findUnique({ where: { id: cursor }, select: { parentId: true } });
      cursor = up?.parentId ?? null;
    }
  }
  return parent.id;
}

function nodeData(input: CourseNodeInput, parentId: string | null) {
  const isLesson = input.kind === "LESSON";
  return {
    parentId,
    kind: input.kind,
    title: input.title,
    description: blank(input.description),
    // Lesson payload only ever lands on LESSON rows, so a kind change cannot leave a stale video behind.
    videoUrl: isLesson ? blank(input.videoUrl) : null,
    documentUrl: isLesson ? blank(input.documentUrl) : null,
    studyMaterialUrl: isLesson ? blank(input.studyMaterialUrl) : null,
    durationText: blank(input.durationText),
    durationMinutes: typeof input.durationMinutes === "number" ? input.durationMinutes : null,
    isFreePreview: isLesson ? input.isFreePreview : false,
    isActive: input.isActive,
  };
}

export async function createCourseNode(courseId: string, input: CourseNodeInput, ctx: Ctx): Promise<CourseNodeDto> {
  const course = await assertCourse(courseId);
  const parentId = await resolveParent(courseId, input.parentId || null, input.kind);
  const last = await db.courseNode.findFirst({ where: { courseId, parentId, deletedAt: null }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const node = await db.courseNode.create({
    data: { courseId, ...nodeData(input, parentId), sortOrder: (last?.sortOrder ?? 0) + 1 },
    select: nodeSelect,
  });
  await audit({ user: ctx.user, action: "create", module: AUDIT_MODULE, recordType: "CourseNode", recordId: node.id, description: `${ctx.user.name} added ${input.kind.toLowerCase()} "${node.title}" to course ${course.code}`, newValue: node, ip: ctx.ip, userAgent: ctx.userAgent });
  return toNodeDto(node);
}

export async function updateCourseNode(id: string, input: CourseNodeInput, ctx: Ctx): Promise<CourseNodeDto> {
  const existing = await db.courseNode.findFirst({ where: { id, deletedAt: null }, select: { ...nodeSelect, course: { select: { code: true } } } });
  if (!existing) throw Errors.notFound("Curriculum item");
  const parentId = await resolveParent(existing.courseId, input.parentId || null, input.kind, id);
  if (input.kind !== existing.kind) {
    const children = await db.courseNode.findMany({ where: { parentId: id, deletedAt: null }, select: { kind: true } });
    if (children.length) {
      if (input.kind === "LESSON") throw Errors.conflict("Move or remove the items inside this one before turning it into a lesson.");
      // A child must stay strictly deeper than its parent — the same rule resolveParent enforces on
      // insert — so a kind change cannot leave this item outranking what it already contains.
      let shallowest = children[0]!.kind;
      for (const c of children) if (NODE_RANK[c.kind] < NODE_RANK[shallowest]) shallowest = c.kind;
      if (NODE_RANK[input.kind] >= NODE_RANK[shallowest]) {
        throw Errors.conflict(`This item contains a ${shallowest.toLowerCase()}, so it cannot become a ${input.kind.toLowerCase()}.`);
      }
    }
  }
  // Moving to a different parent restarts the ordering at the end of the new level.
  const movedLevel = parentId !== existing.parentId;
  const last = movedLevel ? await db.courseNode.findFirst({ where: { courseId: existing.courseId, parentId, deletedAt: null, id: { not: id } }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }) : null;
  const node = await db.courseNode.update({
    where: { id },
    data: { ...nodeData(input, parentId), ...(movedLevel ? { sortOrder: (last?.sortOrder ?? 0) + 1 } : {}) },
    select: nodeSelect,
  });
  await audit({ user: ctx.user, action: "update", module: AUDIT_MODULE, recordType: "CourseNode", recordId: id, description: `${ctx.user.name} updated curriculum item "${node.title}" on course ${existing.course.code}`, oldValue: existing, newValue: node, ip: ctx.ip, userAgent: ctx.userAgent });
  return toNodeDto(node);
}

/** Soft-deletes a node and everything under it, in one transaction. */
export async function deleteCourseNode(id: string, ctx: Ctx): Promise<{ removed: number }> {
  const existing = await db.courseNode.findFirst({ where: { id, deletedAt: null }, select: { ...nodeSelect, course: { select: { code: true } } } });
  if (!existing) throw Errors.notFound("Curriculum item");
  const all = await db.courseNode.findMany({ where: { courseId: existing.courseId, deletedAt: null }, select: { id: true, parentId: true } });
  const childrenOf = new Map<string, string[]>();
  for (const n of all) {
    if (!n.parentId) continue;
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n.id);
    childrenOf.set(n.parentId, list);
  }
  const ids: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    ids.push(cur);
    for (const child of childrenOf.get(cur) ?? []) stack.push(child);
  }
  const deletedAt = new Date();
  await db.courseNode.updateMany({ where: { id: { in: ids } }, data: { deletedAt, isActive: false } });
  await audit({ user: ctx.user, action: "delete", module: AUDIT_MODULE, recordType: "CourseNode", recordId: id, description: `${ctx.user.name} removed curriculum item "${existing.title}" (${ids.length} item(s)) from course ${existing.course.code}`, oldValue: existing, newValue: { removedIds: ids }, ip: ctx.ip, userAgent: ctx.userAgent });
  return { removed: ids.length };
}

/** Renumbers one level of the tree (all children of `parentId`, or the roots when it is null). */
export async function reorderCourseNodes(courseId: string, parentId: string | null, ids: string[], ctx: Ctx) {
  const course = await assertCourse(courseId);
  const existing = await db.courseNode.findMany({ where: { courseId, parentId, deletedAt: null }, select: { id: true } });
  assertCompleteOrder(ids, existing);
  await db.$transaction(ids.map((id, i) => db.courseNode.update({ where: { id }, data: { sortOrder: i + 1 } })));
  await audit({ user: ctx.user, action: "reorder", module: AUDIT_MODULE, recordType: "CourseNode", recordId: parentId, description: `${ctx.user.name} reordered the curriculum of course ${course.code}`, newValue: { parentId, ids }, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Fee plan (CourseFeePlan) ─────────────────────────────

const FEE_TYPES = ["FREE", "ONE_TIME", "MONTHLY", "CUSTOM"] as const;
const optionalMoney = z.union([z.literal(""), money]).optional().nullable();

export const courseFeePlanInputSchema = z
  .object({
    feeType: z.enum(FEE_TYPES).default("ONE_TIME"),
    currency: z.string().trim().toUpperCase().length(3, "Use a 3-letter currency code").default("INR"),
    baseFee: money.default(0),
    discountedFee: optionalMoney,
    offerPrice: optionalMoney,
    enrolmentFee: money.default(0),
    paymentRequired: z.coerce.boolean().default(true),
    customLabel: z.string().trim().max(120).optional().nullable(),
    note: optionalString,
  })
  .superRefine((v, ctx) => {
    if (v.feeType === "CUSTOM" && !(v.customLabel ?? "").trim()) {
      ctx.addIssue({ code: "custom", path: ["customLabel"], message: "Custom pricing needs a label to show on the site" });
    }
    if ((v.feeType === "ONE_TIME" || v.feeType === "MONTHLY") && v.baseFee <= 0) {
      ctx.addIssue({ code: "custom", path: ["baseFee"], message: "Enter the amount, or switch the fee type to No fee" });
    }
    if (typeof v.discountedFee === "number" && v.discountedFee > v.baseFee) {
      ctx.addIssue({ code: "custom", path: ["discountedFee"], message: "The discounted fee must be lower than the base fee" });
    }
    if (typeof v.offerPrice === "number" && v.offerPrice > v.baseFee) {
      ctx.addIssue({ code: "custom", path: ["offerPrice"], message: "The offer price must be lower than the base fee" });
    }
  });
export type CourseFeePlanInput = z.infer<typeof courseFeePlanInputSchema>;

export interface CourseFeePlanDto extends FeePlanLike {
  id: string;
  courseId: string;
  feeType: CourseFeeType;
  currency: string;
  baseFee: number;
  discountedFee: number | null;
  offerPrice: number | null;
  enrolmentFee: number;
  paymentRequired: boolean;
  customLabel: string | null;
  note: string | null;
}

type FeePlanRow = {
  id: string;
  courseId: string;
  feeType: CourseFeeType;
  currency: string;
  baseFee: unknown;
  discountedFee: unknown;
  offerPrice: unknown;
  enrolmentFee: unknown;
  paymentRequired: boolean;
  customLabel: string | null;
  note: string | null;
};

function toFeePlanDto(p: FeePlanRow): CourseFeePlanDto {
  return {
    id: p.id,
    courseId: p.courseId,
    feeType: p.feeType,
    currency: p.currency,
    baseFee: toNumber(p.baseFee),
    discountedFee: p.discountedFee == null ? null : toNumber(p.discountedFee),
    offerPrice: p.offerPrice == null ? null : toNumber(p.offerPrice),
    enrolmentFee: toNumber(p.enrolmentFee),
    paymentRequired: p.paymentRequired,
    customLabel: p.customLabel,
    note: p.note,
  };
}

export async function getCourseFeePlan(courseId: string): Promise<CourseFeePlanDto | null> {
  const plan = await db.courseFeePlan.findFirst({ where: { courseId, deletedAt: null } });
  return plan ? toFeePlanDto(plan) : null;
}

/** One plan per course, so create and edit are the same call. */
export async function upsertCourseFeePlan(courseId: string, input: CourseFeePlanInput, ctx: Ctx): Promise<CourseFeePlanDto> {
  const course = await assertCourse(courseId);
  const existing = await db.courseFeePlan.findUnique({ where: { courseId } });
  const data = {
    feeType: input.feeType,
    currency: input.currency || "INR",
    baseFee: input.feeType === "FREE" ? 0 : input.baseFee,
    discountedFee: typeof input.discountedFee === "number" ? input.discountedFee : null,
    offerPrice: typeof input.offerPrice === "number" ? input.offerPrice : null,
    enrolmentFee: input.enrolmentFee,
    paymentRequired: input.feeType === "FREE" ? false : input.paymentRequired,
    customLabel: blank(input.customLabel),
    note: blank(input.note),
    deletedAt: null,
  };
  const plan = await db.courseFeePlan.upsert({ where: { courseId }, create: { courseId, ...data }, update: data });
  await audit({
    user: ctx.user,
    action: existing ? "update" : "create",
    module: AUDIT_MODULE,
    recordType: "CourseFeePlan",
    recordId: plan.id,
    description: `${ctx.user.name} ${existing ? "updated" : "set"} the fee plan for course ${course.code}`,
    oldValue: existing ? toFeePlanDto(existing) : undefined,
    newValue: toFeePlanDto(plan),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return toFeePlanDto(plan);
}

/** Soft-deletes the plan; the site falls back to the course's own `courseFee`. */
export async function deleteCourseFeePlan(courseId: string, ctx: Ctx) {
  const existing = await db.courseFeePlan.findFirst({ where: { courseId, deletedAt: null } });
  if (!existing) throw Errors.notFound("Fee plan");
  await db.courseFeePlan.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  await audit({ user: ctx.user, action: "delete", module: AUDIT_MODULE, recordType: "CourseFeePlan", recordId: existing.id, description: `${ctx.user.name} removed the fee plan for a course`, oldValue: toFeePlanDto(existing), ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Offers (CourseOffer) ─────────────────────────────

const optionalDateTime = z
  .union([z.literal(""), z.coerce.date()])
  .optional()
  .nullable()
  .transform((v) => (v instanceof Date ? v : null));

export const courseOfferInputSchema = z
  .object({
    title: z.string().trim().min(2, "Enter an offer title").max(160),
    description: z.string().trim().max(2000).optional().nullable(),
    discountPercent: z.union([z.literal(""), z.coerce.number().int().min(1).max(100)]).optional().nullable(),
    originalPrice: optionalMoney,
    offerPrice: optionalMoney,
    couponCode: z.string().trim().toUpperCase().max(40).optional().nullable(),
    bannerImage: optionalMediaPath,
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    isActive: z.coerce.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && v.endsAt.getTime() < v.startsAt.getTime()) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The offer cannot end before it starts" });
    }
    if (typeof v.offerPrice === "number" && typeof v.originalPrice === "number" && v.offerPrice > v.originalPrice) {
      ctx.addIssue({ code: "custom", path: ["offerPrice"], message: "The offer price must be lower than the original price" });
    }
    // The admin form sends "" for an empty field, so "" counts as not given.
    if ((v.offerPrice == null || v.offerPrice === "") && (v.discountPercent == null || v.discountPercent === "")) {
      ctx.addIssue({ code: "custom", path: ["offerPrice"], message: "Enter an offer price or a discount percentage" });
    }
  });
export type CourseOfferInput = z.infer<typeof courseOfferInputSchema>;

export interface CourseOfferDto {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  discountPercent: number | null;
  originalPrice: number | null;
  offerPrice: number | null;
  couponCode: string | null;
  bannerImage: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
}

type OfferRow = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  discountPercent: number | null;
  originalPrice: unknown;
  offerPrice: unknown;
  couponCode: string | null;
  bannerImage: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
};

function toOfferDto(o: OfferRow): CourseOfferDto {
  return {
    id: o.id,
    courseId: o.courseId,
    title: o.title,
    description: o.description,
    discountPercent: o.discountPercent,
    originalPrice: o.originalPrice == null ? null : toNumber(o.originalPrice),
    offerPrice: o.offerPrice == null ? null : toNumber(o.offerPrice),
    couponCode: o.couponCode,
    bannerImage: o.bannerImage,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    isActive: o.isActive,
    sortOrder: o.sortOrder,
    createdAt: o.createdAt,
  };
}

/**
 * The SQL half of "expired offers stop showing by themselves": a date window evaluated on every
 * read. There is no cron job and no nightly flag flip — an offer that ended a second ago is simply
 * not returned by the next query.
 */
export function activeOfferWhere(now: Date = new Date()): Prisma.CourseOfferWhereInput {
  return {
    deletedAt: null,
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

export async function listCourseOffers(courseId: string, opts: { activeOnly?: boolean; now?: Date } = {}): Promise<CourseOfferDto[]> {
  const rows = await db.courseOffer.findMany({
    where: opts.activeOnly ? { courseId, ...activeOfferWhere(opts.now ?? new Date()) } : { courseId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toOfferDto);
}

/** The offer a public page should show right now, or null. Dates are checked in SQL, not in memory. */
export async function getEffectiveOffer(courseId: string, now: Date = new Date()): Promise<CourseOfferDto | null> {
  const row = await db.courseOffer.findFirst({
    where: { courseId, ...activeOfferWhere(now) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return row ? toOfferDto(row) : null;
}

function offerData(input: CourseOfferInput) {
  return {
    title: input.title,
    description: blank(input.description),
    discountPercent: typeof input.discountPercent === "number" ? input.discountPercent : null,
    originalPrice: typeof input.originalPrice === "number" ? input.originalPrice : null,
    offerPrice: typeof input.offerPrice === "number" ? input.offerPrice : null,
    couponCode: blank(input.couponCode),
    bannerImage: blank(input.bannerImage),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    isActive: input.isActive,
  };
}

export async function createCourseOffer(courseId: string, input: CourseOfferInput, ctx: Ctx): Promise<CourseOfferDto> {
  const course = await assertCourse(courseId);
  const last = await db.courseOffer.findFirst({ where: { courseId, deletedAt: null }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const offer = await db.courseOffer.create({ data: { courseId, ...offerData(input), sortOrder: (last?.sortOrder ?? 0) + 1 } });
  await audit({ user: ctx.user, action: "create", module: AUDIT_MODULE, recordType: "CourseOffer", recordId: offer.id, description: `${ctx.user.name} added offer "${offer.title}" to course ${course.code}`, newValue: toOfferDto(offer), ip: ctx.ip, userAgent: ctx.userAgent });
  return toOfferDto(offer);
}

export async function updateCourseOffer(id: string, input: CourseOfferInput, ctx: Ctx): Promise<CourseOfferDto> {
  const existing = await db.courseOffer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw Errors.notFound("Offer");
  const offer = await db.courseOffer.update({ where: { id }, data: offerData(input) });
  await audit({ user: ctx.user, action: "update", module: AUDIT_MODULE, recordType: "CourseOffer", recordId: id, description: `${ctx.user.name} updated offer "${offer.title}"`, oldValue: toOfferDto(existing), newValue: toOfferDto(offer), ip: ctx.ip, userAgent: ctx.userAgent });
  return toOfferDto(offer);
}

export async function deleteCourseOffer(id: string, ctx: Ctx) {
  const existing = await db.courseOffer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw Errors.notFound("Offer");
  await db.courseOffer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await audit({ user: ctx.user, action: "delete", module: AUDIT_MODULE, recordType: "CourseOffer", recordId: id, description: `${ctx.user.name} removed offer "${existing.title}"`, oldValue: toOfferDto(existing), ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function reorderCourseOffers(courseId: string, ids: string[], ctx: Ctx) {
  const course = await assertCourse(courseId);
  const existing = await db.courseOffer.findMany({ where: { courseId, deletedAt: null }, select: { id: true } });
  assertCompleteOrder(ids, existing);
  await db.$transaction(ids.map((id, i) => db.courseOffer.update({ where: { id }, data: { sortOrder: i + 1 } })));
  await audit({ user: ctx.user, action: "reorder", module: AUDIT_MODULE, recordType: "CourseOffer", recordId: courseId, description: `${ctx.user.name} reordered the offers on course ${course.code}`, newValue: { ids }, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Per-course FAQ (CourseFaq) ─────────────────────────────

export const courseFaqInputSchema = z.object({
  question: z.string().trim().min(3, "Enter the question").max(300),
  answer: z.string().trim().min(2, "Enter the answer").max(5000),
  isActive: z.coerce.boolean().default(true),
});
export type CourseFaqInput = z.infer<typeof courseFaqInputSchema>;

export interface CourseFaqDto {
  id: string;
  courseId: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export async function listCourseFaqs(courseId: string, opts: { activeOnly?: boolean } = {}): Promise<CourseFaqDto[]> {
  return db.courseFaq.findMany({
    where: { courseId, deletedAt: null, ...(opts.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, courseId: true, question: true, answer: true, sortOrder: true, isActive: true },
  });
}

export async function createCourseFaq(courseId: string, input: CourseFaqInput, ctx: Ctx): Promise<CourseFaqDto> {
  const course = await assertCourse(courseId);
  const last = await db.courseFaq.findFirst({ where: { courseId, deletedAt: null }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const faq = await db.courseFaq.create({
    data: { courseId, question: input.question, answer: input.answer, isActive: input.isActive, sortOrder: (last?.sortOrder ?? 0) + 1 },
    select: { id: true, courseId: true, question: true, answer: true, sortOrder: true, isActive: true },
  });
  await audit({ user: ctx.user, action: "create", module: AUDIT_MODULE, recordType: "CourseFaq", recordId: faq.id, description: `${ctx.user.name} added FAQ "${faq.question}" to course ${course.code}`, newValue: faq, ip: ctx.ip, userAgent: ctx.userAgent });
  return faq;
}

export async function updateCourseFaq(id: string, input: CourseFaqInput, ctx: Ctx): Promise<CourseFaqDto> {
  const existing = await db.courseFaq.findFirst({ where: { id, deletedAt: null }, select: { id: true, courseId: true, question: true, answer: true, sortOrder: true, isActive: true } });
  if (!existing) throw Errors.notFound("FAQ");
  const faq = await db.courseFaq.update({
    where: { id },
    data: { question: input.question, answer: input.answer, isActive: input.isActive },
    select: { id: true, courseId: true, question: true, answer: true, sortOrder: true, isActive: true },
  });
  await audit({ user: ctx.user, action: "update", module: AUDIT_MODULE, recordType: "CourseFaq", recordId: id, description: `${ctx.user.name} updated course FAQ "${faq.question}"`, oldValue: existing, newValue: faq, ip: ctx.ip, userAgent: ctx.userAgent });
  return faq;
}

export async function deleteCourseFaq(id: string, ctx: Ctx) {
  const existing = await db.courseFaq.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw Errors.notFound("FAQ");
  await db.courseFaq.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await audit({ user: ctx.user, action: "delete", module: AUDIT_MODULE, recordType: "CourseFaq", recordId: id, description: `${ctx.user.name} removed course FAQ "${existing.question}"`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function reorderCourseFaqs(courseId: string, ids: string[], ctx: Ctx) {
  const course = await assertCourse(courseId);
  const existing = await db.courseFaq.findMany({ where: { courseId, deletedAt: null }, select: { id: true } });
  assertCompleteOrder(ids, existing);
  await db.$transaction(ids.map((id, i) => db.courseFaq.update({ where: { id }, data: { sortOrder: i + 1 } })));
  await audit({ user: ctx.user, action: "reorder", module: AUDIT_MODULE, recordType: "CourseFaq", recordId: courseId, description: `${ctx.user.name} reordered the FAQs on course ${course.code}`, newValue: { ids }, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Media (CourseMedia) ─────────────────────────────

const MEDIA_KINDS = ["GALLERY", "PROMOTIONAL"] as const;

export const courseMediaInputSchema = z.object({
  kind: z.enum(MEDIA_KINDS).default("GALLERY"),
  url: mediaPath.min(1, "Upload an image"),
  alt: z.string().trim().max(200).optional().nullable(),
  caption: z.string().trim().max(300).optional().nullable(),
  isActive: z.coerce.boolean().default(true),
});
export type CourseMediaInput = z.infer<typeof courseMediaInputSchema>;

export interface CourseMediaDto {
  id: string;
  courseId: string;
  kind: CourseMediaKind;
  url: string;
  alt: string | null;
  caption: string | null;
  sortOrder: number;
  isActive: boolean;
}

const mediaSelect = { id: true, courseId: true, kind: true, url: true, alt: true, caption: true, sortOrder: true, isActive: true } as const;

export async function listCourseMedia(courseId: string, opts: { kind?: CourseMediaKind; activeOnly?: boolean } = {}): Promise<CourseMediaDto[]> {
  return db.courseMedia.findMany({
    where: { courseId, deletedAt: null, ...(opts.kind ? { kind: opts.kind } : {}), ...(opts.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: mediaSelect,
  });
}

export async function createCourseMedia(courseId: string, input: CourseMediaInput, ctx: Ctx): Promise<CourseMediaDto> {
  const course = await assertCourse(courseId);
  const last = await db.courseMedia.findFirst({ where: { courseId, kind: input.kind, deletedAt: null }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const item = await db.courseMedia.create({
    data: { courseId, kind: input.kind, url: input.url, alt: blank(input.alt), caption: blank(input.caption), isActive: input.isActive, sortOrder: (last?.sortOrder ?? 0) + 1 },
    select: mediaSelect,
  });
  await audit({ user: ctx.user, action: "create", module: AUDIT_MODULE, recordType: "CourseMedia", recordId: item.id, description: `${ctx.user.name} added a ${input.kind.toLowerCase()} image to course ${course.code}`, newValue: item, ip: ctx.ip, userAgent: ctx.userAgent });
  return item;
}

export async function updateCourseMedia(id: string, input: CourseMediaInput, ctx: Ctx): Promise<CourseMediaDto> {
  const existing = await db.courseMedia.findFirst({ where: { id, deletedAt: null }, select: mediaSelect });
  if (!existing) throw Errors.notFound("Image");
  const movedKind = input.kind !== existing.kind;
  const last = movedKind ? await db.courseMedia.findFirst({ where: { courseId: existing.courseId, kind: input.kind, deletedAt: null, id: { not: id } }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }) : null;
  const item = await db.courseMedia.update({
    where: { id },
    data: { kind: input.kind, url: input.url, alt: blank(input.alt), caption: blank(input.caption), isActive: input.isActive, ...(movedKind ? { sortOrder: (last?.sortOrder ?? 0) + 1 } : {}) },
    select: mediaSelect,
  });
  await audit({ user: ctx.user, action: "update", module: AUDIT_MODULE, recordType: "CourseMedia", recordId: id, description: `${ctx.user.name} updated a course image`, oldValue: existing, newValue: item, ip: ctx.ip, userAgent: ctx.userAgent });
  return item;
}

export async function deleteCourseMedia(id: string, ctx: Ctx) {
  const existing = await db.courseMedia.findFirst({ where: { id, deletedAt: null }, select: mediaSelect });
  if (!existing) throw Errors.notFound("Image");
  await db.courseMedia.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await audit({ user: ctx.user, action: "delete", module: AUDIT_MODULE, recordType: "CourseMedia", recordId: id, description: `${ctx.user.name} removed a course image`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function reorderCourseMedia(courseId: string, kind: CourseMediaKind, ids: string[], ctx: Ctx) {
  const course = await assertCourse(courseId);
  const existing = await db.courseMedia.findMany({ where: { courseId, kind, deletedAt: null }, select: { id: true } });
  assertCompleteOrder(ids, existing);
  await db.$transaction(ids.map((id, i) => db.courseMedia.update({ where: { id }, data: { sortOrder: i + 1 } })));
  await audit({ user: ctx.user, action: "reorder", module: AUDIT_MODULE, recordType: "CourseMedia", recordId: courseId, description: `${ctx.user.name} reordered the ${kind.toLowerCase()} images on course ${course.code}`, newValue: { kind, ids }, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Aggregate reads ─────────────────────────────

const courseCmsCourseSelect = {
  id: true,
  code: true,
  slug: true,
  name: true,
  shortDescription: true,
  description: true,
  image: true,
  icon: true,
  bannerImage: true,
  instructorImage: true,
  promoVideoUrl: true,
  videoThumbnail: true,
  durationText: true,
  durationWeeks: true,
  level: true,
  mode: true,
  eligibility: true,
  minAge: true,
  maxAge: true,
  totalClasses: true,
  courseFee: true,
  registrationFee: true,
  examFee: true,
  certificateFee: true,
  scholarshipAvailable: true,
  scholarshipNote: true,
  certificateEligibility: true,
  minAttendancePct: true,
  passingMarksPct: true,
  requiredDocuments: true,
  syllabus: true,
  isFeatured: true,
  seoTitle: true,
  seoDescription: true,
  status: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
} as const;

export interface BilledFees {
  courseFee: number;
  registrationFee: number;
  examFee: number;
  certificateFee: number;
}

/**
 * The price the site shows: the fee plan the Foundation published, or — with no plan — exactly what
 * admission bills. A plan can never make a course that bills something read "No fee" (a FREE plan,
 * or a discount down to zero): that falls back to the billed fees, because the student will be
 * charged them. No offer is applied (see getCoursePageData).
 */
export function publicCourseFee(plan: CourseFeePlanDto | null, fees: BilledFees): { fee: FeeDisplay; fromPlan: boolean } {
  const billed = fees.courseFee + fees.registrationFee + fees.examFee + fees.certificateFee;
  if (plan) {
    const shown = formatCourseFee(plan);
    if (!(shown.isFree && billed > 0)) return { fee: shown, fromPlan: true };
  }
  return { fee: feeDisplayFromCourse(fees), fromPlan: false };
}

export interface CoursePageData {
  course: Omit<Prisma.CourseGetPayload<{ select: typeof courseCmsCourseSelect }>, "courseFee" | "registrationFee" | "examFee" | "certificateFee"> & {
    courseFee: number;
    registrationFee: number;
    examFee: number;
    certificateFee: number;
    totalFee: number;
  };
  curriculum: CourseNodeTreeItem[];
  feePlan: CourseFeePlanDto | null;
  /**
   * Ready-to-render price: the fee plan when there is one, otherwise exactly what admission bills
   * (`feeDisplayFromCourse`). Offers are NOT applied: billing does not honour them yet, so the site
   * must not show a price the student will not be charged.
   */
  fee: FeeDisplay;
  /** True when `fee` is the published plan; false when it is the billed fees (no plan, or a plan that would read "No fee"). */
  feeFromPlan: boolean;
  faqs: CourseFaqDto[];
  gallery: CourseMediaDto[];
  promotional: CourseMediaDto[];
}

/**
 * Everything the public course page needs, in one call: the course, its category, the curriculum
 * tree, the fee already formatted for display, the per-course FAQ and both media sets. Only
 * published/active rows come back. Offers stay admin-only until billing applies them.
 *
 * `Promise.all` is safe here — these run on the pooled `db` client, not on a transaction client.
 */
export async function getCoursePageData(slug: string, opts: { includeInactiveCourse?: boolean } = {}): Promise<CoursePageData | null> {
  const course = await db.course.findFirst({
    where: { slug, deletedAt: null, ...(opts.includeInactiveCourse ? {} : { status: "ACTIVE" }) },
    select: courseCmsCourseSelect,
  });
  if (!course) return null;

  const [nodes, feePlan, faqs, media] = await Promise.all([
    listCourseNodes(course.id, { activeOnly: true }),
    getCourseFeePlan(course.id),
    listCourseFaqs(course.id, { activeOnly: true }),
    listCourseMedia(course.id, { activeOnly: true }),
  ]);

  const courseFee = toNumber(course.courseFee);
  const registrationFee = toNumber(course.registrationFee);
  const examFee = toNumber(course.examFee);
  const certificateFee = toNumber(course.certificateFee);

  return {
    course: { ...course, courseFee, registrationFee, examFee, certificateFee, totalFee: courseFee + registrationFee + examFee + certificateFee },
    curriculum: buildCourseNodeTree(nodes),
    feePlan,
    ...(() => {
      const shown = publicCourseFee(feePlan, { courseFee, registrationFee, examFee, certificateFee });
      return { fee: shown.fee, feeFromPlan: shown.fromPlan };
    })(),
    faqs,
    gallery: media.filter((m) => m.kind === "GALLERY"),
    promotional: media.filter((m) => m.kind === "PROMOTIONAL"),
  };
}

export interface CourseCmsBundle {
  courseId: string;
  curriculum: CourseNodeTreeItem[];
  feePlan: CourseFeePlanDto | null;
  feePreview: FeeDisplay;
  /** True when `feePreview` is the plan; false when the site shows the billed fees instead. */
  feeFromPlan: boolean;
  offers: CourseOfferDto[];
  effectiveOfferId: string | null;
  faqs: CourseFaqDto[];
  gallery: CourseMediaDto[];
  promotional: CourseMediaDto[];
}

/**
 * The admin-editor counterpart: every row including the inactive ones, plus the same `FeeDisplay`
 * the public page will render, so the preview in the admin panel cannot disagree with the site.
 */
export async function getCourseCmsBundle(courseId: string, opts: { now?: Date } = {}): Promise<CourseCmsBundle> {
  const now = opts.now ?? new Date();
  await assertCourse(courseId);
  const [nodes, feePlan, offers, faqs, media, course] = await Promise.all([
    listCourseNodes(courseId),
    getCourseFeePlan(courseId),
    listCourseOffers(courseId),
    listCourseFaqs(courseId),
    listCourseMedia(courseId),
    db.course.findUniqueOrThrow({ where: { id: courseId }, select: { courseFee: true, registrationFee: true, examFee: true, certificateFee: true } }),
  ]);
  const effective = pickEffectiveOffer(offers, now);
  // Exactly what the public page shows — no offer applied (see getCoursePageData).
  const shown = publicCourseFee(feePlan, {
    courseFee: toNumber(course.courseFee),
    registrationFee: toNumber(course.registrationFee),
    examFee: toNumber(course.examFee),
    certificateFee: toNumber(course.certificateFee),
  });
  return {
    courseId,
    curriculum: buildCourseNodeTree(nodes),
    feePlan,
    feePreview: shown.fee,
    feeFromPlan: shown.fromPlan,
    offers,
    effectiveOfferId: effective?.id ?? null,
    faqs,
    gallery: media.filter((m) => m.kind === "GALLERY"),
    promotional: media.filter((m) => m.kind === "PROMOTIONAL"),
  };
}
