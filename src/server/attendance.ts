import { db, type Prisma } from "@/lib/db";
import type { AttendanceStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac/permissions";
import type { AuthUser } from "@/lib/auth/session";
import { recomputeProgress } from "@/server/progress";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

/** Trainers can act on batches they are assigned to; staff need the relevant permission. */
export async function canAccessBatch(user: AuthUser, batchId: string, permission: string): Promise<boolean> {
  if (user.role === "SUPER_ADMIN" || user.role === "STAFF") return hasPermission(user, permission);
  if (user.role === "TRAINER" && user.trainer) {
    const batch = await db.batch.findFirst({ where: { id: batchId, deletedAt: null }, select: { trainerId: true } });
    if (batch?.trainerId === user.trainer.id) return true;
    const assignment = await db.trainerAssignment.findFirst({ where: { trainerId: user.trainer.id, batchId, isActive: true } });
    return !!assignment;
  }
  return false;
}

export async function assertBatchAccess(user: AuthUser, batchId: string, permission: string) {
  if (!(await canAccessBatch(user, batchId, permission))) throw Errors.forbidden("You are not assigned to this batch.");
}

function toUtcDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00.000Z`) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (Number.isNaN(date.getTime())) throw Errors.validation("Please correct the highlighted fields.", { date: "Invalid date" });
  return date;
}

export async function batchRoster(batchId: string) {
  return db.admission.findMany({
    where: { batchId, status: { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] } },
    orderBy: { student: { name: "asc" } },
    include: { student: { select: { id: true, name: true, studentId: true, photoUrl: true, mobile: true } } },
  });
}

/** Roster for a date with any existing marks. */
export async function attendanceSheet(batchId: string, date: Date | string) {
  const day = toUtcDate(date);
  const batch = await db.batch.findFirst({ where: { id: batchId, deletedAt: null }, include: { course: { select: { name: true } }, center: { select: { name: true, code: true } } } });
  if (!batch) throw Errors.notFound("Batch");
  const [roster, marks] = await Promise.all([batchRoster(batchId), db.attendance.findMany({ where: { batchId, date: day } })]);
  const byStudent = new Map(marks.map((m) => [m.studentId, m]));
  return {
    batch: { id: batch.id, code: batch.code, name: batch.name, course: batch.course.name, center: batch.center, startDate: batch.startDate, endDate: batch.endDate, days: batch.days, status: batch.status },
    date: day,
    students: roster.map((r) => ({ admissionId: r.id, studentId: r.student.id, studentCode: r.student.studentId, name: r.student.name, photoUrl: r.student.photoUrl, admissionStatus: r.status, status: byStudent.get(r.student.id)?.status ?? null, remarks: byStudent.get(r.student.id)?.remarks ?? null })),
    marked: marks.length > 0,
  };
}

export async function markAttendance(
  input: { batchId: string; date: Date | string; records: { studentId: string; status: AttendanceStatus; remarks?: string | null }[] },
  actor: AuthUser,
  meta: { ip?: string | null; userAgent?: string | null } = {}
) {
  await assertBatchAccess(actor, input.batchId, "attendance.mark");
  const day = toUtcDate(input.date);
  const batch = await db.batch.findFirst({ where: { id: input.batchId, deletedAt: null } });
  if (!batch) throw Errors.notFound("Batch");
  const today = toUtcDate(new Date());
  if (day > today) throw Errors.badRequest("Attendance cannot be marked for a future date.");
  if (day < toUtcDate(batch.startDate)) throw Errors.badRequest("Date is before the batch start date.");
  if (batch.status === "CANCELLED") throw Errors.badRequest("This batch is cancelled.");
  if (batch.status === "COMPLETED" && actor.role === "TRAINER") throw Errors.badRequest("This batch is completed. Contact the Foundation for corrections.");

  const roster = await db.admission.findMany({ where: { batchId: input.batchId, status: { in: ["ACTIVE", "ON_HOLD"] } }, select: { id: true, studentId: true } });
  const allowed = new Map(roster.map((r) => [r.studentId, r.id]));
  const valid = input.records.filter((r) => allowed.has(r.studentId));
  if (valid.length === 0) throw Errors.badRequest("No valid students in the attendance list.");

  await db.$transaction(
    valid.map((r) =>
      db.attendance.upsert({
        where: { batchId_studentId_date: { batchId: input.batchId, studentId: r.studentId, date: day } },
        create: { batchId: input.batchId, studentId: r.studentId, date: day, status: r.status, remarks: r.remarks ?? null, markedById: actor.id },
        update: { status: r.status, remarks: r.remarks ?? null, markedById: actor.id },
      })
    )
  );
  // Recompute progress for the whole batch (classes held changes for everyone).
  for (const r of roster) await recomputeProgress(r.id).catch(() => undefined);

  await audit({ user: { id: actor.id, name: actor.name, role: actor.role }, action: "mark", module: "attendance", recordType: "Batch", recordId: input.batchId, description: `${actor.name} marked attendance for ${valid.length} students in batch ${batch.code} on ${day.toISOString().slice(0, 10)}`, ip: meta.ip, userAgent: meta.userAgent });
  return { marked: valid.length };
}

export interface AttendanceSummaryRow {
  studentId: string;
  studentCode: string | null;
  name: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  held: number;
  pct: number;
}

/** Per-student summary for a batch (optionally within a date range). */
export async function batchAttendanceReport(batchId: string, range: { from?: Date; to?: Date } = {}) {
  const where: Prisma.AttendanceWhereInput = { batchId };
  if (range.from || range.to) where.date = { gte: range.from, lt: range.to };
  const [roster, marks, dates] = await Promise.all([
    batchRoster(batchId),
    db.attendance.groupBy({ by: ["studentId", "status"], where, _count: { _all: true } }),
    db.attendance.groupBy({ by: ["date"], where, orderBy: { date: "asc" } }),
  ]);
  const held = dates.length;
  const rows: AttendanceSummaryRow[] = roster.map((r) => {
    const get = (s: AttendanceStatus) => marks.find((m) => m.studentId === r.student.id && m.status === s)?._count._all ?? 0;
    const present = get("PRESENT");
    const late = get("LATE");
    return { studentId: r.student.id, studentCode: r.student.studentId, name: r.student.name, present, absent: get("ABSENT"), late, leave: get("LEAVE"), held, pct: held ? Math.round(((present + late) / held) * 1000) / 10 : 0 };
  });
  const daily = await Promise.all(
    dates.map(async (d) => {
      const counts = await db.attendance.groupBy({ by: ["status"], where: { batchId, date: d.date }, _count: { _all: true } });
      const get = (s: AttendanceStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
      return { date: d.date, present: get("PRESENT"), absent: get("ABSENT"), late: get("LATE"), leave: get("LEAVE") };
    })
  );
  return { held, rows, daily };
}

export async function studentAttendance(studentId: string, batchId?: string) {
  const where: Prisma.AttendanceWhereInput = { studentId, ...(batchId ? { batchId } : {}) };
  const records = await db.attendance.findMany({ where, orderBy: { date: "desc" }, include: { batch: { select: { id: true, name: true, code: true, course: { select: { name: true } } } } } });
  const byBatch = new Map<string, { batch: (typeof records)[number]["batch"]; present: number; absent: number; late: number; leave: number }>();
  for (const r of records) {
    const b = byBatch.get(r.batchId) ?? { batch: r.batch, present: 0, absent: 0, late: 0, leave: 0 };
    if (r.status === "PRESENT") b.present++;
    else if (r.status === "ABSENT") b.absent++;
    else if (r.status === "LATE") b.late++;
    else b.leave++;
    byBatch.set(r.batchId, b);
  }
  const summary = [];
  for (const [id, b] of byBatch) {
    const held = (await db.attendance.groupBy({ by: ["date"], where: { batchId: id } })).length;
    summary.push({ batchId: id, ...b, held, pct: held ? Math.round(((b.present + b.late) / held) * 1000) / 10 : 0 });
  }
  return { records, summary };
}
