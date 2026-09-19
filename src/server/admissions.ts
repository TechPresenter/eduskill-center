import { db, type Prisma } from "@/lib/db";
import type { AdmissionStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { formatDate, toNumber } from "@/lib/utils";
import { assertBatchHasSeat, formatSchedule } from "@/server/batches";
import { recomputeProgress } from "@/server/progress";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate, optionalBool } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

// ───────────────────────────── Helpers ─────────────────────────────

type ProgressRow = Prisma.StudentProgressGetPayload<Record<string, never>>;

/** Converts Decimal columns of a progress row to plain numbers (safe for client components). */
export function progressNumbers(p: ProgressRow | null | undefined) {
  if (!p) return null;
  return {
    ...p,
    attendancePct: toNumber(p.attendancePct),
    assessmentAvgPct: toNumber(p.assessmentAvgPct),
    finalMarksPct: p.finalMarksPct === null ? null : toNumber(p.finalMarksPct),
    completionPct: toNumber(p.completionPct),
  };
}

export type ProgressNumbers = NonNullable<ReturnType<typeof progressNumbers>>;

// ───────────────────────────── Queries ─────────────────────────────

export const admissionListSchema = paginationSchema.extend({
  status: z.string().optional(),
  centerId: optionalUuid,
  courseId: optionalUuid,
  batchId: optionalUuid,
  trainerId: optionalUuid,
  studentId: optionalUuid,
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  eligible: optionalBool,
  completed: optionalBool,
  from: optionalDate,
  to: optionalDate,
});

export type AdmissionListQuery = z.infer<typeof admissionListSchema>;

export async function listAdmissions(q: AdmissionListQuery) {
  const where: Prisma.AdmissionWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",").filter(Boolean) as AdmissionStatus[] };
  else if (q.completed !== undefined) where.status = q.completed ? "COMPLETED" : { in: ["ACTIVE", "ON_HOLD"] };
  if (q.centerId) where.centerId = q.centerId;
  if (q.courseId) where.courseId = q.courseId;
  if (q.batchId) where.batchId = q.batchId;
  if (q.trainerId) where.trainerId = q.trainerId;
  if (q.studentId) where.studentId = q.studentId;
  if (q.stateId || q.districtId || q.blockId) where.center = { stateId: q.stateId, districtId: q.districtId, blockId: q.blockId };
  if (q.eligible !== undefined) where.progress = { certificateEligible: q.eligible };
  if (q.from || q.to) where.admittedAt = { gte: q.from, lt: q.to };
  if (q.q) {
    where.OR = [
      { admissionNo: { contains: q.q, mode: "insensitive" } },
      { student: { name: { contains: q.q, mode: "insensitive" } } },
      { student: { studentId: { contains: q.q, mode: "insensitive" } } },
      { student: { mobile: { contains: q.q } } },
      { application: { applicationNo: { contains: q.q, mode: "insensitive" } } },
    ];
  }
  const orderBy = buildOrderBy(q.sort, q.order, ["admittedAt", "admissionNo", "status", "completedAt"] as const, "admittedAt");
  const [items, total] = await Promise.all([
    db.admission.findMany({
      where,
      orderBy,
      ...getPaging(q),
      include: {
        student: { select: { id: true, name: true, studentId: true, mobile: true, photoUrl: true } },
        course: { select: { id: true, name: true, code: true, minAttendancePct: true, passingMarksPct: true, totalClasses: true } },
        center: { select: { id: true, name: true, code: true, state: { select: { name: true } }, district: { select: { name: true } } } },
        batch: { select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true } },
        trainer: { select: { id: true, trainerId: true, user: { select: { name: true } } } },
        progress: true,
        certificate: { select: { id: true, certificateNo: true, status: true } },
        application: { select: { id: true, applicationNo: true, status: true, payableAmount: true, paidAmount: true } },
      },
    }),
    db.admission.count({ where }),
  ]);
  return paged(
    items.map((a) => ({
      ...a,
      progress: progressNumbers(a.progress),
      application: { ...a.application, payableAmount: toNumber(a.application.payableAmount), paidAmount: toNumber(a.application.paidAmount) },
    })),
    total,
    q
  );
}

export type AdmissionListItem = Awaited<ReturnType<typeof listAdmissions>>["items"][number];

export async function getAdmissionDetail(id: string) {
  const a = await db.admission.findUnique({
    where: { id },
    include: {
      student: { include: { user: { select: { id: true, name: true, email: true, mobile: true, status: true } }, state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } } } },
      course: true,
      center: { include: { state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } } } },
      batch: { include: { trainer: { include: { user: { select: { name: true } } } } } },
      trainer: { include: { user: { select: { id: true, name: true, email: true, mobile: true } } } },
      progress: true,
      certificate: true,
      application: {
        include: {
          payments: { orderBy: { createdAt: "desc" } },
          statusHistory: { orderBy: { createdAt: "asc" } },
          scholarshipAward: { include: { program: { select: { name: true } } } },
          installments: { orderBy: { installmentNo: "asc" } },
        },
      },
    },
  });
  if (!a) throw Errors.notFound("Admission");
  const [heldDates, marks, approvedBy] = await Promise.all([
    db.attendance.groupBy({ by: ["date"], where: { batchId: a.batchId } }),
    db.attendance.groupBy({ by: ["status"], where: { batchId: a.batchId, studentId: a.studentId }, _count: { _all: true } }),
    a.approvedById ? db.user.findUnique({ where: { id: a.approvedById }, select: { name: true } }) : Promise.resolve(null),
  ]);
  const count = (s: "PRESENT" | "ABSENT" | "LATE" | "LEAVE") => marks.find((m) => m.status === s)?._count._all ?? 0;
  const present = count("PRESENT");
  const late = count("LATE");
  const held = heldDates.length;
  const actorIds = [...new Set(a.application.statusHistory.map((h) => h.changedById).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const app = a.application;
  return {
    ...a,
    progress: progressNumbers(a.progress),
    approvedByName: approvedBy?.name ?? null,
    attendance: { held, present, absent: count("ABSENT"), late, leave: count("LEAVE"), pct: held ? Math.round(((present + late) / held) * 1000) / 10 : 0 },
    actors: Object.fromEntries(actors.map((u) => [u.id, u.name])),
    application: {
      ...app,
      originalFee: toNumber(app.originalFee),
      scholarshipAmount: toNumber(app.scholarshipAmount),
      discountAmount: toNumber(app.discountAmount),
      payableAmount: toNumber(app.payableAmount),
      paidAmount: toNumber(app.paidAmount),
      payments: app.payments.map((p) => ({ ...p, amount: toNumber(p.amount) })),
      installments: app.installments.map((i) => ({ ...i, amount: toNumber(i.amount) })),
      scholarshipAward: app.scholarshipAward
        ? { ...app.scholarshipAward, originalFee: toNumber(app.scholarshipAward.originalFee), scholarshipAmount: toNumber(app.scholarshipAward.scholarshipAmount), payableFee: toNumber(app.scholarshipAward.payableFee) }
        : null,
    },
  };
}

export type AdmissionDetail = Awaited<ReturnType<typeof getAdmissionDetail>>;

// ───────────────────────────── Mutations ─────────────────────────────

/** Moves an admitted student to another batch of the same center and course (seat-checked, row-locked). */
export async function changeAdmissionBatch(id: string, input: { batchId: string; note?: string | null }, ctx: Ctx) {
  const out = await db.$transaction(async (tx) => {
    const adm = await tx.admission.findUnique({
      where: { id },
      include: { batch: true, student: { include: { user: { select: { id: true, name: true, email: true, mobile: true } } } }, course: { select: { name: true } }, center: { select: { name: true } } },
    });
    if (!adm) throw Errors.notFound("Admission");
    if (adm.status === "COMPLETED" || adm.status === "DROPPED") throw Errors.badRequest("Batch cannot be changed for a completed or dropped admission.");
    if (adm.batchId === input.batchId) throw Errors.badRequest("The student is already in this batch.");
    const batch = await tx.batch.findFirst({ where: { id: input.batchId, deletedAt: null, centerId: adm.centerId, courseId: adm.courseId } });
    if (!batch) throw Errors.badRequest("Batch must belong to the same center and course as the admission.");
    await assertBatchHasSeat(tx, batch.id);
    const notes = input.note ? `${adm.notes ? `${adm.notes}\n` : ""}Batch changed to ${batch.code}: ${input.note}` : adm.notes;
    const updated = await tx.admission.update({ where: { id }, data: { batchId: batch.id, trainerId: batch.trainerId, notes } });
    await tx.application.update({ where: { id: adm.applicationId }, data: { batchId: batch.id } });
    return { adm, batch, updated };
  });
  await recomputeProgress(id).catch((err) => console.error("[admissions] recompute after batch change failed:", err));
  await audit({
    user: ctx.user,
    action: "change_batch",
    module: "admissions",
    recordType: "Admission",
    recordId: id,
    description: `${ctx.user.name} moved ${out.adm.student.name} (${out.adm.admissionNo}) from batch ${out.adm.batch.code} to ${out.batch.code}`,
    oldValue: { batchId: out.adm.batchId, trainerId: out.adm.trainerId },
    newValue: { batchId: out.batch.id, trainerId: out.batch.trainerId, note: input.note ?? null },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  const s = out.adm.student;
  await notify({
    userId: s.user.id,
    email: s.user.email ?? s.email,
    mobile: s.user.mobile ?? s.mobile,
    event: "BATCH_CHANGED",
    data: {
      name: s.name,
      batch: out.batch.name,
      course: out.adm.course.name,
      center: out.adm.center.name,
      schedule: formatSchedule(out.batch),
      note: input.note ?? "",
    },
  });
  return out.updated;
}

export async function assignAdmissionTrainer(id: string, trainerId: string | null, ctx: Ctx) {
  const adm = await db.admission.findUnique({ where: { id }, include: { student: { select: { name: true } }, trainer: { include: { user: { select: { name: true } } } } } });
  if (!adm) throw Errors.notFound("Admission");
  if (adm.status === "COMPLETED" || adm.status === "DROPPED") throw Errors.badRequest("Trainer cannot be changed for a completed or dropped admission.");
  let trainerName: string | null = null;
  if (trainerId) {
    const trainer = await db.trainer.findFirst({ where: { id: trainerId, deletedAt: null, status: "ACTIVE" }, include: { user: { select: { name: true } } } });
    if (!trainer) throw Errors.badRequest("Trainer not found or inactive.");
    trainerName = trainer.user.name;
  }
  const updated = await db.admission.update({ where: { id }, data: { trainerId } });
  await audit({
    user: ctx.user,
    action: "assign_trainer",
    module: "admissions",
    recordType: "Admission",
    recordId: id,
    description: `${ctx.user.name} ${trainerId ? `assigned trainer ${trainerName} to` : "removed the trainer from"} ${adm.student.name} (${adm.admissionNo})`,
    oldValue: { trainerId: adm.trainerId, trainerName: adm.trainer?.user.name ?? null },
    newValue: { trainerId, trainerName },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return updated;
}

// ───────────────────────────── Lookups for admin pickers ─────────────────────────────

export async function getAdminLookups(filter: { centerId?: string; courseId?: string } = {}) {
  const [centers, courses, batches, trainers, programs] = await Promise.all([
    db.center.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, status: true, stateId: true, districtId: true, blockId: true } }),
    db.course.findMany({ where: { deletedAt: null, status: { in: ["ACTIVE", "INACTIVE"] } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true, status: true, scholarshipAvailable: true } }),
    db.batch.findMany({
      where: { deletedAt: null, centerId: filter.centerId, courseId: filter.courseId },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 400,
      select: { id: true, name: true, code: true, status: true, centerId: true, courseId: true, trainerId: true, capacity: true, startDate: true, endDate: true },
    }),
    db.trainer.findMany({ where: { deletedAt: null, status: "ACTIVE" }, orderBy: { user: { name: "asc" } }, select: { id: true, trainerId: true, level: true, user: { select: { name: true } } } }),
    db.scholarshipProgram.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, percentage: true, fixedAmount: true, maxAmount: true } }),
  ]);
  return {
    centers,
    courses,
    batches,
    trainers: trainers.map((t) => ({ id: t.id, trainerId: t.trainerId, level: t.level, name: t.user.name })),
    programs: programs.map((p) => ({ ...p, fixedAmount: p.fixedAmount === null ? null : toNumber(p.fixedAmount), maxAmount: p.maxAmount === null ? null : toNumber(p.maxAmount) })),
  };
}

export type AdminLookups = Awaited<ReturnType<typeof getAdminLookups>>;

// ───────────────────────────── CSV export helper ─────────────────────────────

export type CsvCell = string | number | boolean | Date | null | undefined;

function csvCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatDate(v, "yyyy-MM-dd");
  const s = typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Builds a downloadable CSV response (UTF-8 with BOM so Excel opens it correctly). */
export function csvResponse(filename: string, headers: string[], rows: CsvCell[][]): Response {
  const body = `﻿${toCsv(headers, rows)}`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Iterates a paged list function until every matching row (up to `max`) is collected – used by CSV exports. */
export async function collectAll<Q extends { page: number; limit: number }, T>(
  fn: (q: Q) => Promise<{ items: T[]; meta: { totalPages: number } }>,
  q: Q,
  max = 5000
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  const limit = 100;
  for (;;) {
    const res = await fn({ ...q, page, limit });
    out.push(...res.items);
    if (page >= res.meta.totalPages || out.length >= max) break;
    page++;
  }
  return out.slice(0, max);
}
