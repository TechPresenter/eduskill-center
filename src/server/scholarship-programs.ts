import { db, type Prisma } from "@/lib/db";
import type { ApplicationStatus, ScholarshipAwardStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { slugify, toNumber } from "@/lib/utils";
import { optionalString } from "@/lib/validation/common";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

// ───────────────────────────── Validation ─────────────────────────────

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const nullableMoney = z.preprocess(blankToNull, z.coerce.number().min(0, "Cannot be negative").max(100_000_000).nullable());
const nullablePercent = z.preprocess(blankToNull, z.coerce.number().int("Whole number").min(0).max(100).nullable());
const nullableDate = z.preprocess(
  blankToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .transform((v) => new Date(`${v}T00:00:00.000Z`))
    .nullable()
);

export const scholarshipProgramSchema = z
  .object({
    name: z.string().trim().min(3, "Enter a program name").max(120),
    slug: z.preprocess(blankToNull, z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only").nullable()).optional(),
    type: z.enum(["FULL", "PARTIAL", "NEED_BASED", "SPECIAL"]),
    description: optionalString,
    eligibilityCriteria: optionalString,
    percentage: nullablePercent.optional(),
    fixedAmount: nullableMoney.optional(),
    maxAmount: nullableMoney.optional(),
    budget: nullableMoney.optional(),
    startDate: nullableDate.optional(),
    endDate: nullableDate.optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== "SPECIAL" && (v.percentage === null || v.percentage === undefined) && (v.fixedAmount === null || v.fixedAmount === undefined)) {
      ctx.addIssue({ code: "custom", path: ["percentage"], message: "Enter a percentage or a fixed amount" });
    }
    if (v.type === "FULL" && v.percentage !== null && v.percentage !== undefined && v.percentage !== 100) {
      ctx.addIssue({ code: "custom", path: ["percentage"], message: "A full scholarship must be 100%" });
    }
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date" });
    }
  });

export type ScholarshipProgramInput = z.infer<typeof scholarshipProgramSchema>;

// ───────────────────────────── Programs ─────────────────────────────

export const programListSchema = paginationSchema.extend({
  active: z.union([z.literal("true"), z.literal("false")]).optional(),
  type: z.string().optional(),
});

function programNumbers<T extends { fixedAmount: unknown; maxAmount: unknown; budget: unknown }>(p: T) {
  return {
    ...p,
    fixedAmount: p.fixedAmount === null ? null : toNumber(p.fixedAmount),
    maxAmount: p.maxAmount === null ? null : toNumber(p.maxAmount),
    budget: p.budget === null ? null : toNumber(p.budget),
  };
}

export async function listPrograms(q: z.infer<typeof programListSchema>) {
  const where: Prisma.ScholarshipProgramWhereInput = {};
  if (q.active) where.isActive = q.active === "true";
  if (q.type) where.type = { in: q.type.split(",") as ScholarshipProgramInput["type"][] };
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { slug: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "name", "type"] as const, "createdAt");
  const [items, total, sums] = await Promise.all([
    db.scholarshipProgram.findMany({ where, orderBy, ...getPaging(q), include: { _count: { select: { awards: true } } } }),
    db.scholarshipProgram.count({ where }),
    db.scholarshipAward.groupBy({ by: ["programId"], where: { status: "APPROVED" }, _sum: { scholarshipAmount: true }, _count: { _all: true } }),
  ]);
  const byProgram = new Map(sums.map((s) => [s.programId, { awarded: toNumber(s._sum.scholarshipAmount), approvedCount: s._count._all }]));
  return paged(
    items.map((p) => ({ ...programNumbers(p), awardsCount: p._count.awards, approvedCount: byProgram.get(p.id)?.approvedCount ?? 0, awardedTotal: byProgram.get(p.id)?.awarded ?? 0 })),
    total,
    q
  );
}

export type ScholarshipProgramItem = Awaited<ReturnType<typeof listPrograms>>["items"][number];

export async function getProgram(id: string) {
  const p = await db.scholarshipProgram.findUnique({ where: { id }, include: { _count: { select: { awards: true } } } });
  if (!p) throw Errors.notFound("Scholarship program");
  return programNumbers(p);
}

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "program";
  let slug = root;
  for (let i = 2; i < 100; i++) {
    const clash = await db.scholarshipProgram.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${root}-${i}`;
  }
  throw Errors.conflict("Could not generate a unique slug. Please enter one manually.");
}

function programData(input: ScholarshipProgramInput): Omit<Prisma.ScholarshipProgramUncheckedCreateInput, "slug" | "name" | "type"> {
  return {
    description: input.description ?? null,
    eligibilityCriteria: input.eligibilityCriteria ?? null,
    percentage: input.percentage ?? null,
    fixedAmount: input.fixedAmount ?? null,
    maxAmount: input.maxAmount ?? null,
    budget: input.budget ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    isActive: input.isActive ?? true,
  };
}

export async function createProgram(input: ScholarshipProgramInput, ctx: Ctx) {
  if (input.slug) {
    const clash = await db.scholarshipProgram.findUnique({ where: { slug: input.slug } });
    if (clash) throw Errors.validation("Please correct the highlighted fields.", { slug: "This slug is already in use" });
  }
  const slug = input.slug ?? (await uniqueSlug(input.name));
  const program = await db.scholarshipProgram.create({ data: { name: input.name, slug, type: input.type, ...programData(input) } });
  await audit({ user: ctx.user, action: "create", module: "scholarships", recordType: "ScholarshipProgram", recordId: program.id, description: `${ctx.user.name} created scholarship program "${program.name}"`, newValue: program, ip: ctx.ip, userAgent: ctx.userAgent });
  return programNumbers(program);
}

export async function updateProgram(id: string, input: ScholarshipProgramInput, ctx: Ctx) {
  const existing = await db.scholarshipProgram.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Scholarship program");
  let slug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    const clash = await db.scholarshipProgram.findFirst({ where: { slug: input.slug, id: { not: id } } });
    if (clash) throw Errors.validation("Please correct the highlighted fields.", { slug: "This slug is already in use" });
    slug = input.slug;
  }
  const program = await db.scholarshipProgram.update({ where: { id }, data: { name: input.name, slug, type: input.type, ...programData(input) } });
  await audit({ user: ctx.user, action: "update", module: "scholarships", recordType: "ScholarshipProgram", recordId: id, description: `${ctx.user.name} updated scholarship program "${program.name}"`, oldValue: existing, newValue: program, ip: ctx.ip, userAgent: ctx.userAgent });
  return programNumbers(program);
}

export async function setProgramActive(id: string, isActive: boolean, ctx: Ctx) {
  const existing = await db.scholarshipProgram.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Scholarship program");
  const program = await db.scholarshipProgram.update({ where: { id }, data: { isActive } });
  await audit({ user: ctx.user, action: isActive ? "activate" : "deactivate", module: "scholarships", recordType: "ScholarshipProgram", recordId: id, description: `${ctx.user.name} ${isActive ? "activated" : "deactivated"} scholarship program "${program.name}"`, ip: ctx.ip, userAgent: ctx.userAgent });
  return programNumbers(program);
}

export async function deleteProgram(id: string, ctx: Ctx) {
  const existing = await db.scholarshipProgram.findUnique({ where: { id }, include: { _count: { select: { awards: true } } } });
  if (!existing) throw Errors.notFound("Scholarship program");
  if (existing._count.awards > 0) throw Errors.conflict(`This program has ${existing._count.awards} award(s) linked to it. Deactivate it instead of deleting.`);
  await db.scholarshipProgram.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "scholarships", recordType: "ScholarshipProgram", recordId: id, description: `${ctx.user.name} deleted scholarship program "${existing.name}"`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Awards ─────────────────────────────

export const awardListSchema = paginationSchema.extend({
  programId: optionalUuid,
  status: z.string().optional(),
  courseId: optionalUuid,
  centerId: optionalUuid,
  studentId: optionalUuid,
  from: optionalDate,
  to: optionalDate,
});

export type AwardListQuery = z.infer<typeof awardListSchema>;

export async function listAwards(q: AwardListQuery) {
  const where: Prisma.ScholarshipAwardWhereInput = {};
  if (q.programId) where.programId = q.programId;
  if (q.status) where.status = { in: q.status.split(",").filter(Boolean) as ScholarshipAwardStatus[] };
  if (q.courseId) where.courseId = q.courseId;
  if (q.studentId) where.studentId = q.studentId;
  if (q.centerId) where.application = { centerId: q.centerId };
  if (q.from || q.to) where.createdAt = { gte: q.from, lt: q.to };
  if (q.q) {
    where.OR = [
      { student: { name: { contains: q.q, mode: "insensitive" } } },
      { student: { studentId: { contains: q.q, mode: "insensitive" } } },
      { student: { mobile: { contains: q.q } } },
      { application: { applicationNo: { contains: q.q, mode: "insensitive" } } },
    ];
  }
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "approvedAt", "status", "scholarshipAmount"] as const, "createdAt");
  const [items, total, sum] = await Promise.all([
    db.scholarshipAward.findMany({
      where,
      orderBy,
      ...getPaging(q),
      include: {
        program: { select: { id: true, name: true, type: true } },
        student: { select: { id: true, name: true, studentId: true, mobile: true } },
        course: { select: { id: true, name: true, code: true } },
        application: { select: { id: true, applicationNo: true, status: true, center: { select: { id: true, name: true, code: true } } } },
      },
    }),
    db.scholarshipAward.count({ where }),
    db.scholarshipAward.aggregate({ where: { ...where, status: "APPROVED" }, _sum: { scholarshipAmount: true } }),
  ]);
  const approverIds = [...new Set(items.map((a) => a.approvedById).filter((x): x is string => !!x))];
  const approvers = approverIds.length ? await db.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(approvers.map((u) => [u.id, u.name]));
  return {
    ...paged(
      items.map((a) => ({
        ...a,
        originalFee: toNumber(a.originalFee),
        scholarshipAmount: toNumber(a.scholarshipAmount),
        payableFee: toNumber(a.payableFee),
        approvedByName: a.approvedById ? (names.get(a.approvedById) ?? null) : null,
      })),
      total,
      q
    ),
    approvedTotal: toNumber(sum._sum.scholarshipAmount),
  };
}

export type ScholarshipAwardItem = Awaited<ReturnType<typeof listAwards>>["items"][number];

// ───────────────────────────── Pending requests ─────────────────────────────

/** Statuses in which a scholarship decision can still be recorded (mirrors decideScholarship). */
export const DECIDABLE_STATUSES: ApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "PAYMENT_PENDING", "WAITLISTED"];

export const pendingRequestSchema = paginationSchema.extend({
  centerId: optionalUuid,
  courseId: optionalUuid,
  status: z.string().optional(),
});

/** Applications that asked for a scholarship and have no award recorded yet. */
export async function listPendingScholarshipRequests(q: z.infer<typeof pendingRequestSchema>) {
  const where: Prisma.ApplicationWhereInput = {
    scholarshipRequested: true,
    scholarshipAward: null,
    status: q.status ? { in: q.status.split(",").filter(Boolean) as ApplicationStatus[] } : { in: DECIDABLE_STATUSES },
    centerId: q.centerId,
    courseId: q.courseId,
  };
  if (q.q) {
    where.OR = [
      { applicationNo: { contains: q.q, mode: "insensitive" } },
      { student: { name: { contains: q.q, mode: "insensitive" } } },
      { student: { mobile: { contains: q.q } } },
    ];
  }
  const orderBy = buildOrderBy(q.sort, q.order, ["submittedAt", "createdAt", "originalFee"] as const, "submittedAt");
  const [items, total] = await Promise.all([
    db.application.findMany({
      where,
      orderBy,
      ...getPaging(q),
      include: {
        student: { select: { id: true, name: true, studentId: true, mobile: true, familyIncome: true, areaType: true, gender: true, qualification: true } },
        course: { select: { id: true, name: true, code: true, scholarshipAvailable: true } },
        center: { select: { id: true, name: true, code: true } },
      },
    }),
    db.application.count({ where }),
  ]);
  return paged(
    items.map((a) => ({
      ...a,
      originalFee: toNumber(a.originalFee),
      scholarshipAmount: toNumber(a.scholarshipAmount),
      discountAmount: toNumber(a.discountAmount),
      payableAmount: toNumber(a.payableAmount),
      paidAmount: toNumber(a.paidAmount),
    })),
    total,
    q
  );
}

export type PendingScholarshipRequest = Awaited<ReturnType<typeof listPendingScholarshipRequests>>["items"][number];

export async function scholarshipCounts() {
  const [programs, awards, pending] = await Promise.all([
    db.scholarshipProgram.count(),
    db.scholarshipAward.count(),
    db.application.count({ where: { scholarshipRequested: true, scholarshipAward: null, status: { in: DECIDABLE_STATUSES } } }),
  ]);
  return { programs, awards, pending };
}
