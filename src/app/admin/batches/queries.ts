import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { BatchStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { toNumber } from "@/lib/utils";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { countOccupiedSeats, getBatchSeatInfo, SEAT_RESERVING_APPLICATION_STATUSES } from "@/server/batches";
import { batchAttendanceReport } from "@/server/attendance";
import { dateString } from "@/lib/validation/common";

export const BATCH_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

export const batchInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a batch name").max(120),
    centerId: z.string().uuid("Select a training center"),
    courseId: z.string().uuid("Select a course"),
    trainerId: z.union([z.literal(""), z.string().uuid()]).optional().nullable(),
    startDate: dateString,
    endDate: dateString,
    startTime: timeField,
    endTime: timeField,
    days: z.array(z.enum(BATCH_DAYS)).min(1, "Select at least one day").max(7),
    capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(1000),
    room: z.string().trim().max(60).optional().nullable(),
    status: z.enum(["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date" });
    if (v.endTime <= v.startTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after the start time" });
  });
export type BatchFormInput = z.infer<typeof batchInputSchema>;

export const batchListSchema = paginationSchema.extend({
  centerId: optionalUuid,
  courseId: optionalUuid,
  trainerId: optionalUuid,
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  status: z.string().optional(),
  from: optionalDate,
  to: optionalDate,
});
export type BatchListQuery = z.infer<typeof batchListSchema>;

export async function listBatchesAdmin(q: BatchListQuery) {
  const where: Prisma.BatchWhereInput = { deletedAt: null };
  if (q.centerId) where.centerId = q.centerId;
  else if (q.stateId || q.districtId || q.blockId) where.center = { stateId: q.stateId, districtId: q.districtId, blockId: q.blockId };
  if (q.courseId) where.courseId = q.courseId;
  if (q.trainerId) where.trainerId = q.trainerId;
  if (q.status) where.status = { in: q.status.split(",").filter(Boolean) as BatchStatus[] };
  if (q.from || q.to) where.startDate = { gte: q.from, lt: q.to ? new Date(q.to.getTime() + 86400000) : undefined };
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }, { center: { name: { contains: q.q, mode: "insensitive" } } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["startDate", "createdAt", "name", "code", "status", "capacity"] as const, "startDate");
  const [rows, total] = await Promise.all([
    db.batch.findMany({
      where,
      orderBy,
      ...getPaging(q),
      include: {
        center: { select: { id: true, code: true, name: true, state: { select: { name: true } }, district: { select: { name: true } } } },
        course: { select: { id: true, name: true, code: true } },
        trainer: { include: { user: { select: { name: true } } } },
      },
    }),
    db.batch.count({ where }),
  ]);
  const items = [];
  for (const b of rows) {
    const occupied = await countOccupiedSeats(b.id);
    items.push({ ...b, occupied, available: Math.max(0, b.capacity - occupied), trainerName: b.trainer?.user.name ?? null });
  }
  return paged(items, total, q);
}

export async function getBatchAdmin(id: string) {
  const b = await db.batch.findFirst({
    where: { id, deletedAt: null },
    include: {
      center: { select: { id: true, code: true, name: true, state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } } } },
      course: { select: { id: true, name: true, code: true, minAttendancePct: true, totalClasses: true } },
      trainer: { include: { user: { select: { id: true, name: true, email: true, mobile: true } } } },
      admissions: {
        orderBy: { student: { name: "asc" } },
        include: { student: { select: { id: true, name: true, studentId: true, mobile: true, photoUrl: true } }, progress: { select: { attendancePct: true, completionPct: true, certificateEligible: true } }, certificate: { select: { id: true, certificateNo: true } } },
      },
      applications: {
        where: { status: { in: [...SEAT_RESERVING_APPLICATION_STATUSES] } },
        orderBy: { createdAt: "desc" },
        include: { student: { select: { id: true, name: true, studentId: true } } },
      },
      trainerAssignments: { orderBy: { assignedAt: "desc" }, include: { trainer: { include: { user: { select: { name: true } } } } } },
    },
  });
  if (!b) throw Errors.notFound("Batch");
  const [seats, attendance] = await Promise.all([getBatchSeatInfo(id), batchAttendanceReport(id)]);
  return {
    ...b,
    seats,
    attendance,
    roster: b.admissions.map((a) => ({ ...a, attendancePct: a.progress ? toNumber(a.progress.attendancePct) : null, completionPct: a.progress ? toNumber(a.progress.completionPct) : null })),
    reserving: b.applications.map((a) => ({ ...a, originalFee: toNumber(a.originalFee), scholarshipAmount: toNumber(a.scholarshipAmount), discountAmount: toNumber(a.discountAmount), payableAmount: toNumber(a.payableAmount), paidAmount: toNumber(a.paidAmount) })),
  };
}

/** Options for batch forms: centers with their courses, and active trainers. */
export async function batchFormOptions() {
  const [centers, trainers] = await Promise.all([
    db.center.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "PENDING"] } },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, state: { select: { name: true } }, courses: { where: { course: { deletedAt: null } }, select: { course: { select: { id: true, name: true, code: true, status: true } } } } },
    }),
    db.trainer.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { user: { name: "asc" } },
      select: { id: true, trainerId: true, level: true, user: { select: { name: true } }, assignments: { where: { isActive: true }, select: { centerId: true } } },
    }),
  ]);
  return {
    centers: centers.map((c) => ({ id: c.id, code: c.code, name: c.name, state: c.state.name, courses: c.courses.map((cc) => cc.course) })),
    trainers: trainers.map((t) => ({ id: t.id, trainerId: t.trainerId, name: t.user.name, level: t.level, centerIds: Array.from(new Set(t.assignments.map((a) => a.centerId))) })),
  };
}
