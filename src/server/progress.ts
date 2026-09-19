import { db, type DbClient } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { toNumber } from "@/lib/utils";
import { markCompleted as markApplicationCompleted } from "@/server/applications";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

/** Recomputes attendance, assignment, assessment and completion metrics for one admission. */
export async function recomputeProgress(admissionId: string, client: DbClient = db) {
  const adm = await client.admission.findUnique({ where: { id: admissionId }, include: { batch: true, course: true, progress: true } });
  if (!adm) throw Errors.notFound("Admission");

  const [heldDates, attended, assignmentsTotal, assignmentsCompleted, assessments] = await Promise.all([
    client.attendance.groupBy({ by: ["date"], where: { batchId: adm.batchId } }),
    client.attendance.count({ where: { batchId: adm.batchId, studentId: adm.studentId, status: { in: ["PRESENT", "LATE"] } } }),
    client.assignment.count({ where: { batchId: adm.batchId } }),
    client.assignmentSubmission.count({ where: { studentId: adm.studentId, assignment: { batchId: adm.batchId } } }),
    client.assessment.findMany({ where: { batchId: adm.batchId }, include: { results: { where: { studentId: adm.studentId } } } }),
  ]);

  const classesHeld = heldDates.length;
  const attendancePct = classesHeld > 0 ? Math.round((attended / classesHeld) * 10000) / 100 : 0;

  let weighted = 0;
  let weightSum = 0;
  let finalMarksPct: number | null = null;
  for (const a of assessments) {
    const r = a.results[0];
    if (!r) continue;
    const pct = a.maxMarks > 0 ? (toNumber(r.marks) / a.maxMarks) * 100 : 0;
    weighted += pct * a.weightage;
    weightSum += a.weightage;
    if (a.type === "FINAL") finalMarksPct = Math.round(pct * 100) / 100;
  }
  const assessmentAvgPct = weightSum > 0 ? Math.round((weighted / weightSum) * 100) / 100 : 0;

  const totalClasses = adm.progress?.totalClasses || adm.course.totalClasses || 0;
  let completionPct: number;
  if (totalClasses > 0) completionPct = Math.min(100, Math.round((classesHeld / totalClasses) * 10000) / 100);
  else {
    const span = adm.batch.endDate.getTime() - adm.batch.startDate.getTime();
    const elapsed = Date.now() - adm.batch.startDate.getTime();
    completionPct = span > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / span) * 10000) / 100)) : 0;
  }
  const isCompleted = adm.progress?.isCompleted || adm.status === "COMPLETED";
  if (isCompleted) completionPct = 100;

  const passesAssessments = weightSum === 0 || assessmentAvgPct >= adm.course.passingMarksPct;
  const trainingOver = isCompleted || adm.batch.status === "COMPLETED";
  const certificateEligible = trainingOver && attendancePct >= adm.course.minAttendancePct && passesAssessments;

  return client.studentProgress.upsert({
    where: { admissionId },
    create: { admissionId, totalClasses, classesHeld, classesAttended: attended, attendancePct, assignmentsTotal, assignmentsCompleted, assessmentAvgPct, finalMarksPct, completionPct, isCompleted, completedAt: isCompleted ? (adm.completedAt ?? new Date()) : null, certificateEligible },
    update: { totalClasses, classesHeld, classesAttended: attended, attendancePct, assignmentsTotal, assignmentsCompleted, assessmentAvgPct, finalMarksPct, completionPct, isCompleted, certificateEligible },
  });
}

export async function recomputeBatchProgress(batchId: string, client: DbClient = db) {
  const admissions = await client.admission.findMany({ where: { batchId, status: { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] } }, select: { id: true } });
  for (const a of admissions) await recomputeProgress(a.id, client);
  return admissions.length;
}

/** Marks a single student's training as completed (course completion). */
export async function markAdmissionCompleted(admissionId: string, ctx: Ctx, note?: string | null) {
  const adm = await db.admission.findUnique({ where: { id: admissionId }, include: { student: { include: { user: true } }, course: true, application: true } });
  if (!adm) throw Errors.notFound("Admission");
  if (adm.status === "COMPLETED") throw Errors.badRequest("Already completed.");
  await db.$transaction(async (tx) => {
    await tx.admission.update({ where: { id: admissionId }, data: { status: "COMPLETED", completedAt: new Date(), notes: note ?? adm.notes } });
    await tx.studentProgress.upsert({ where: { admissionId }, create: { admissionId, isCompleted: true, completedAt: new Date(), completionPct: 100 }, update: { isCompleted: true, completedAt: new Date(), completionPct: 100 } });
  });
  await recomputeProgress(admissionId);
  if (adm.application.status === "ADMISSION_CONFIRMED") await markApplicationCompleted(adm.applicationId, ctx);
  await audit({ user: ctx.user, action: "complete", module: "progress", recordType: "Admission", recordId: admissionId, description: `${ctx.user.name} marked ${adm.student.name}'s ${adm.course.name} training as completed`, ip: ctx.ip, userAgent: ctx.userAgent });
  return recomputeProgress(admissionId);
}

export async function setAdmissionStatus(admissionId: string, status: "ACTIVE" | "ON_HOLD" | "DROPPED", note: string | null | undefined, ctx: Ctx) {
  const adm = await db.admission.findUnique({
    where: { id: admissionId },
    include: { student: { include: { user: { select: { id: true, email: true, mobile: true } } } }, course: { select: { name: true } }, center: { select: { name: true } } },
  });
  if (!adm) throw Errors.notFound("Admission");
  if (adm.status === "COMPLETED") throw Errors.badRequest("Completed admissions cannot be changed.");
  await db.admission.update({ where: { id: admissionId }, data: { status, notes: note ?? adm.notes } });
  if (status === "DROPPED") {
    await db.$transaction([
      db.application.update({ where: { id: adm.applicationId }, data: { status: "CANCELLED" } }),
      db.applicationStatusHistory.create({ data: { applicationId: adm.applicationId, fromStatus: "ADMISSION_CONFIRMED", toStatus: "CANCELLED", note: note ?? "Student dropped out", changedById: ctx.user.id } }),
    ]);
  }
  await audit({ user: ctx.user, action: status.toLowerCase(), module: "admissions", recordType: "Admission", recordId: admissionId, description: `${ctx.user.name} set admission ${adm.admissionNo} (${adm.student.name}) to ${status}`, newValue: { status, note }, ip: ctx.ip, userAgent: ctx.userAgent });
  if (status === "DROPPED") {
    await notify({
      userId: adm.student.user.id,
      email: adm.student.user.email ?? adm.student.email,
      mobile: adm.student.user.mobile ?? adm.student.mobile,
      event: "ADMISSION_CANCELLED",
      data: { name: adm.student.name, course: adm.course.name, center: adm.center.name, note: note ?? "" },
    });
  }
}

/** Completes a batch: marks it COMPLETED, completes all active admissions and recomputes eligibility. */
export async function completeBatch(batchId: string, ctx: Ctx) {
  const batch = await db.batch.findFirst({ where: { id: batchId, deletedAt: null }, include: { course: true } });
  if (!batch) throw Errors.notFound("Batch");
  if (batch.status === "COMPLETED") throw Errors.badRequest("Batch is already completed.");
  const admissions = await db.admission.findMany({ where: { batchId, status: { in: ["ACTIVE", "ON_HOLD"] } }, include: { student: { include: { user: true } }, application: true } });
  await db.$transaction(async (tx) => {
    await tx.batch.update({ where: { id: batchId }, data: { status: "COMPLETED" } });
    for (const a of admissions) {
      await tx.admission.update({ where: { id: a.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await tx.studentProgress.upsert({ where: { admissionId: a.id }, create: { admissionId: a.id, isCompleted: true, completedAt: new Date(), completionPct: 100 }, update: { isCompleted: true, completedAt: new Date(), completionPct: 100 } });
      if (a.application.status === "ADMISSION_CONFIRMED") {
        await tx.application.update({ where: { id: a.applicationId }, data: { status: "COMPLETED" } });
        await tx.applicationStatusHistory.create({ data: { applicationId: a.applicationId, fromStatus: "ADMISSION_CONFIRMED", toStatus: "COMPLETED", note: "Batch completed", changedById: ctx.user.id } });
      }
    }
    await tx.trainerAssignment.updateMany({ where: { batchId, isActive: true }, data: { isActive: false, endedAt: new Date() } });
  });
  for (const a of admissions) await recomputeProgress(a.id);
  await audit({ user: ctx.user, action: "complete_batch", module: "batches", recordType: "Batch", recordId: batchId, description: `${ctx.user.name} completed batch ${batch.code} (${admissions.length} students)`, ip: ctx.ip, userAgent: ctx.userAgent });
  return { completed: admissions.length };
}

export async function sendAttendanceAlerts(batchId: string) {
  const admissions = await db.admission.findMany({ where: { batchId, status: "ACTIVE" }, include: { progress: true, course: true, student: { include: { user: true } } } });
  let sent = 0;
  for (const a of admissions) {
    const p = a.progress;
    if (!p || p.classesHeld < 5) continue;
    const pct = toNumber(p.attendancePct);
    if (pct < a.course.minAttendancePct) {
      await notify({ userId: a.student.user.id, email: a.student.user.email ?? a.student.email, mobile: a.student.user.mobile ?? a.student.mobile, event: "ATTENDANCE_ALERT", data: { name: a.student.name, course: a.course.name, attendancePct: pct, requiredPct: a.course.minAttendancePct } });
      sent++;
    }
  }
  return sent;
}
