import { db, type DbClient, type Prisma } from "@/lib/db";
import type { BatchStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { generateBatchCode } from "@/lib/ids";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

/** Applications in these statuses hold a seat until an admission record replaces them. */
export const SEAT_RESERVING_APPLICATION_STATUSES = ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"] as const;

export async function countOccupiedSeats(batchId: string, client: DbClient = db): Promise<number> {
  // Sequential on purpose: this runs inside transactions where the client is a single connection.
  const admitted = await client.admission.count({ where: { batchId, status: { in: ["ACTIVE", "ON_HOLD"] } } });
  const reserved = await client.application.count({ where: { batchId, status: { in: [...SEAT_RESERVING_APPLICATION_STATUSES] } } });
  return admitted + reserved;
}

export async function getBatchSeatInfo(batchId: string, client: DbClient = db) {
  const batch = await client.batch.findUnique({ where: { id: batchId }, select: { capacity: true, status: true } });
  if (!batch) throw Errors.notFound("Batch");
  const occupied = await countOccupiedSeats(batchId, client);
  return { capacity: batch.capacity, occupied, available: Math.max(0, batch.capacity - occupied), status: batch.status };
}

/**
 * Locks the batch row (SELECT ... FOR UPDATE) and throws when no seat is available.
 * Must be called inside an interactive transaction so concurrent approvals serialise.
 */
export async function assertBatchHasSeat(tx: Prisma.TransactionClient, batchId: string) {
  const rows = await tx.$queryRaw<{ id: string; capacity: number; status: BatchStatus }[]>`
    SELECT "id", "capacity", "status" FROM "batches" WHERE "id" = ${batchId}::uuid AND "deleted_at" IS NULL FOR UPDATE`;
  const batch = rows[0];
  if (!batch) throw Errors.notFound("Batch");
  if (batch.status === "COMPLETED" || batch.status === "CANCELLED") {
    throw Errors.badRequest("This batch is no longer accepting students.");
  }
  const occupied = await countOccupiedSeats(batchId, tx);
  if (occupied >= batch.capacity) {
    throw Errors.conflict("This batch is full. Please choose another batch or waitlist the application.");
  }
  return { capacity: batch.capacity, occupied, available: batch.capacity - occupied };
}

export interface BatchInput {
  name: string;
  centerId: string;
  courseId: string;
  trainerId?: string | null;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  days: string[];
  capacity: number;
  room?: string | null;
  status?: BatchStatus;
  notes?: string | null;
}

async function validateBatchRelations(input: Pick<BatchInput, "centerId" | "courseId" | "trainerId" | "startDate" | "endDate">) {
  const center = await db.center.findFirst({ where: { id: input.centerId, deletedAt: null }, select: { id: true, code: true } });
  if (!center) throw Errors.notFound("Training center");
  const offered = await db.centerCourse.findUnique({ where: { centerId_courseId: { centerId: input.centerId, courseId: input.courseId } } });
  if (!offered) throw Errors.badRequest("This course is not offered at the selected center. Add it to the center first.");
  if (input.trainerId) {
    const trainer = await db.trainer.findFirst({ where: { id: input.trainerId, deletedAt: null, status: "ACTIVE" } });
    if (!trainer) throw Errors.badRequest("Trainer not found or inactive.");
  }
  if (input.endDate < input.startDate) throw Errors.validation("Please correct the highlighted fields.", { endDate: "End date must be after start date" });
  return center;
}

export async function createBatch(input: BatchInput, ctx: Ctx) {
  const center = await validateBatchRelations(input);
  const batch = await db.$transaction(async (tx) => {
    const code = await generateBatchCode(center.code, tx);
    return tx.batch.create({
      data: {
        code,
        name: input.name,
        centerId: input.centerId,
        courseId: input.courseId,
        trainerId: input.trainerId ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        startTime: input.startTime,
        endTime: input.endTime,
        days: input.days,
        capacity: input.capacity,
        room: input.room ?? null,
        status: input.status ?? "UPCOMING",
        notes: input.notes ?? null,
        createdById: ctx.user.id,
      },
    });
  });
  if (input.trainerId) {
    await db.trainerAssignment.create({ data: { trainerId: input.trainerId, centerId: input.centerId, courseId: input.courseId, batchId: batch.id, assignedById: ctx.user.id } });
  }
  await audit({ user: ctx.user, action: "create", module: "batches", recordType: "Batch", recordId: batch.id, description: `${ctx.user.name} created batch ${batch.code} (${batch.name})`, newValue: batch, ip: ctx.ip, userAgent: ctx.userAgent });
  return batch;
}

export async function updateBatch(id: string, input: Partial<BatchInput>, ctx: Ctx) {
  const existing = await db.batch.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw Errors.notFound("Batch");
  const merged = { ...existing, ...input };
  await validateBatchRelations({ centerId: merged.centerId, courseId: merged.courseId, trainerId: merged.trainerId, startDate: merged.startDate, endDate: merged.endDate });
  if (input.capacity !== undefined) {
    const occupied = await countOccupiedSeats(id);
    if (input.capacity < occupied) throw Errors.validation("Please correct the highlighted fields.", { capacity: `Capacity cannot be below the ${occupied} seats already occupied` });
  }
  const batch = await db.batch.update({
    where: { id },
    data: {
      name: input.name,
      centerId: input.centerId,
      courseId: input.courseId,
      trainerId: input.trainerId,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
      days: input.days,
      capacity: input.capacity,
      room: input.room,
      status: input.status,
      notes: input.notes,
    },
  });
  if (input.trainerId && input.trainerId !== existing.trainerId) {
    await db.trainerAssignment.updateMany({ where: { batchId: id, isActive: true, trainerId: { not: input.trainerId } }, data: { isActive: false, endedAt: new Date() } });
    await db.trainerAssignment.create({ data: { trainerId: input.trainerId, centerId: batch.centerId, courseId: batch.courseId, batchId: id, assignedById: ctx.user.id } });
    await db.admission.updateMany({ where: { batchId: id, status: { in: ["ACTIVE", "ON_HOLD"] } }, data: { trainerId: input.trainerId } });
  }
  await audit({ user: ctx.user, action: "update", module: "batches", recordType: "Batch", recordId: id, description: `${ctx.user.name} updated batch ${batch.code}`, oldValue: existing, newValue: batch, ip: ctx.ip, userAgent: ctx.userAgent });
  return batch;
}

export async function deleteBatch(id: string, ctx: Ctx) {
  const batch = await db.batch.findFirst({ where: { id, deletedAt: null } });
  if (!batch) throw Errors.notFound("Batch");
  const occupied = await countOccupiedSeats(id);
  if (occupied > 0) throw Errors.conflict("This batch has students or approved applications. Cancel it instead of deleting.");
  await db.batch.update({ where: { id }, data: { deletedAt: new Date(), status: "CANCELLED" } });
  await audit({ user: ctx.user, action: "delete", module: "batches", recordType: "Batch", recordId: id, description: `${ctx.user.name} deleted batch ${batch.code}`, oldValue: batch, ip: ctx.ip, userAgent: ctx.userAgent });
}

/** Batches open for new admissions at a center for a course, with live seat availability. */
export async function availableBatches(centerId: string, courseId: string) {
  const batches = await db.batch.findMany({
    where: { centerId, courseId, deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } },
    orderBy: { startDate: "asc" },
    include: { trainer: { include: { user: { select: { name: true } } } } },
  });
  const out = [];
  for (const b of batches) {
    const occupied = await countOccupiedSeats(b.id);
    out.push({
      id: b.id,
      code: b.code,
      name: b.name,
      startDate: b.startDate,
      endDate: b.endDate,
      startTime: b.startTime,
      endTime: b.endTime,
      days: b.days,
      room: b.room,
      status: b.status,
      capacity: b.capacity,
      occupied,
      available: Math.max(0, b.capacity - occupied),
      trainerName: b.trainer?.user.name ?? null,
    });
  }
  return out;
}

export function formatSchedule(b: { days: string[]; startTime: string; endTime: string }) {
  return `${b.days.join(", ")} · ${b.startTime}–${b.endTime}`;
}
