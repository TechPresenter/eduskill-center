import { db } from "@/lib/db";
import type { AdmissionStatus, Prisma } from "@/generated/prisma/client";
import { Errors } from "@/lib/api/errors";
import { revokeAllSessions } from "@/lib/auth/session";
import { isFileUrlUnder } from "@/lib/storage";
import { toNumber } from "@/lib/utils";
import { computeFeeLines, missingDocuments, requiredDocumentKeys } from "@/server/applications";
import { countOccupiedSeats } from "@/server/batches";
import { recomputeProgress } from "@/server/progress";

/**
 * Thin, student-scoped read helpers and small mutations for the student portal.
 * Workflow logic (applications, payments, documents) lives in the module services –
 * these only assemble data, and every query is scoped by `studentId` / `userId`.
 */

export const ACTIVE_ADMISSION_STATUSES: AdmissionStatus[] = ["ACTIVE", "ON_HOLD"];
export const PAYABLE_APPLICATION_STATUSES = ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED"] as const;

function moneyFields<T extends { originalFee: unknown; scholarshipAmount: unknown; discountAmount: unknown; payableAmount: unknown; paidAmount: unknown }>(a: T) {
  return {
    ...a,
    originalFee: toNumber(a.originalFee),
    scholarshipAmount: toNumber(a.scholarshipAmount),
    discountAmount: toNumber(a.discountAmount),
    payableAmount: toNumber(a.payableAmount),
    paidAmount: toNumber(a.paidAmount),
  };
}

// ───────────────────────────── Applications ─────────────────────────────

export async function listStudentApplications(studentId: string) {
  const apps = await db.application.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { id: true, name: true, requiredDocuments: true } },
      center: { select: { id: true, name: true, code: true } },
      batch: { select: { id: true, name: true, code: true, days: true, startTime: true, endTime: true } },
      admission: { select: { id: true, admissionNo: true, status: true } },
    },
  });
  const out = [];
  for (const a of apps) {
    const missing = a.status === "DRAFT" || a.status === "DOCUMENTS_REQUIRED" ? await missingDocuments(a) : [];
    out.push({ ...moneyFields(a), missingDocuments: missing.map((m) => m.name) });
  }
  return out;
}

// ───────────────────────────── Admissions / training ─────────────────────────────

export async function studentAdmissions(studentId: string, statuses?: AdmissionStatus[]) {
  const rows = await db.admission.findMany({
    where: { studentId, ...(statuses ? { status: { in: statuses } } : {}) },
    orderBy: { admittedAt: "desc" },
    include: {
      course: { select: { id: true, name: true, slug: true, totalClasses: true, minAttendancePct: true, passingMarksPct: true, durationText: true } },
      center: { select: { id: true, name: true, code: true, address: true, phone: true, villageTown: true } },
      batch: { include: { trainer: { include: { user: { select: { name: true } } } } } },
      trainer: { include: { user: { select: { name: true } } } },
      progress: true,
      certificate: { select: { id: true, certificateNo: true, status: true, issuedAt: true } },
      application: { select: { id: true, applicationNo: true } },
    },
  });
  return rows.map((a) => ({
    ...a,
    progress: a.progress
      ? {
          ...a.progress,
          attendancePct: toNumber(a.progress.attendancePct),
          assessmentAvgPct: toNumber(a.progress.assessmentAvgPct),
          finalMarksPct: a.progress.finalMarksPct === null ? null : toNumber(a.progress.finalMarksPct),
          completionPct: toNumber(a.progress.completionPct),
        }
      : null,
  }));
}

export type StudentAdmission = Awaited<ReturnType<typeof studentAdmissions>>[number];

async function studentBatchScope(studentId: string) {
  const adms = await db.admission.findMany({ where: { studentId }, select: { id: true, batchId: true, courseId: true, status: true } });
  return {
    admissions: adms,
    batchIds: [...new Set(adms.map((a) => a.batchId))],
    courseIds: [...new Set(adms.map((a) => a.courseId))],
  };
}

export async function listStudentMaterials(studentId: string) {
  const { batchIds, courseIds } = await studentBatchScope(studentId);
  if (batchIds.length === 0 && courseIds.length === 0) return [];
  return db.studyMaterial.findMany({
    where: { isPublished: true, OR: [{ batchId: { in: batchIds } }, { batchId: null, courseId: { in: courseIds } }] },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { id: true, name: true } }, batch: { select: { id: true, name: true, code: true } } },
  });
}

export type StudentAssignmentStatus = "NOT_SUBMITTED" | "SUBMITTED" | "LATE" | "GRADED" | "OVERDUE";

export async function listStudentAssignments(studentId: string) {
  const { batchIds } = await studentBatchScope(studentId);
  if (batchIds.length === 0) return [];
  const rows = await db.assignment.findMany({
    where: { batchId: { in: batchIds } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      batch: { select: { id: true, name: true, code: true, status: true, course: { select: { name: true } } } },
      trainer: { include: { user: { select: { name: true } } } },
      submissions: { where: { studentId } },
    },
  });
  const now = Date.now();
  return rows.map((a) => {
    const submission = a.submissions[0] ?? null;
    let status: StudentAssignmentStatus = "NOT_SUBMITTED";
    if (submission) status = submission.status === "GRADED" ? "GRADED" : submission.status === "LATE" ? "LATE" : "SUBMITTED";
    else if (a.dueDate && a.dueDate.getTime() < now) status = "OVERDUE";
    return { ...a, submissions: undefined, submission, studentStatus: status, canSubmit: status !== "GRADED" && a.batch.status !== "CANCELLED" };
  });
}

export async function submitAssignment(studentId: string, assignmentId: string, input: { text?: string | null; fileUrl?: string | null }) {
  const assignment = await db.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, batchId: true, dueDate: true } });
  if (!assignment) throw Errors.notFound("Assignment");
  const admission = await db.admission.findFirst({ where: { studentId, batchId: assignment.batchId, status: { in: ACTIVE_ADMISSION_STATUSES } }, select: { id: true } });
  if (!admission) throw Errors.forbidden("You are not enrolled in this batch.");
  const text = input.text?.trim() || null;
  const fileUrl = input.fileUrl || null;
  if (!text && !fileUrl) throw Errors.validation("Please correct the highlighted fields.", { text: "Write your answer or attach a file" });
  if (fileUrl && !isFileUrlUnder(fileUrl, `private/students/${studentId}/`)) throw Errors.badRequest("Invalid attachment");
  const existing = await db.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId } } });
  if (existing?.status === "GRADED") throw Errors.badRequest("This assignment has already been graded and cannot be resubmitted.");
  const status = assignment.dueDate && Date.now() > assignment.dueDate.getTime() ? "LATE" : "SUBMITTED";
  const submission = await db.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    create: { assignmentId, studentId, text, fileUrl, status },
    update: { text, fileUrl, status, submittedAt: new Date() },
  });
  await recomputeProgress(admission.id).catch(() => undefined);
  return submission;
}

export async function listStudentAssessments(studentId: string) {
  const { batchIds } = await studentBatchScope(studentId);
  if (batchIds.length === 0) return [];
  const rows = await db.assessment.findMany({
    where: { batchId: { in: batchIds } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { batch: { select: { id: true, name: true, code: true, course: { select: { name: true } } } }, results: { where: { studentId } } },
  });
  const now = Date.now();
  return rows.map((a) => {
    const r = a.results[0];
    return { ...a, results: undefined, result: r ? { ...r, marks: toNumber(r.marks) } : null, isUpcoming: !!a.date && a.date.getTime() > now };
  });
}

/** Weekly timetable inputs: active batches plus upcoming assessments / assignment due dates. */
export async function studentTimetable(studentId: string) {
  const admissions = await studentAdmissions(studentId, ACTIVE_ADMISSION_STATUSES);
  const batchIds = admissions.map((a) => a.batchId);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (batchIds.length === 0) return { admissions, assessments: [], assignments: [] };
  const [assessments, assignments] = await Promise.all([
    db.assessment.findMany({ where: { batchId: { in: batchIds }, date: { gte: today } }, orderBy: { date: "asc" }, take: 10, include: { batch: { select: { name: true, course: { select: { name: true } } } } } }),
    db.assignment.findMany({ where: { batchId: { in: batchIds }, dueDate: { gte: now } }, orderBy: { dueDate: "asc" }, take: 10, include: { batch: { select: { name: true, course: { select: { name: true } } } }, submissions: { where: { studentId }, select: { id: true, status: true } } } }),
  ]);
  return { admissions, assessments, assignments };
}

// ───────────────────────────── Payments ─────────────────────────────

export async function listStudentPayments(studentId: string) {
  const rows = await db.payment.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: { application: { select: { id: true, applicationNo: true, course: { select: { name: true } } } } },
  });
  return rows.map((p) => ({ ...p, amount: toNumber(p.amount) }));
}

/** Applications that carry fees, with the amount still due. */
export async function listStudentFeeSummaries(studentId: string) {
  const apps = await db.application.findMany({
    where: { studentId, status: { notIn: ["DRAFT", "CANCELLED", "REJECTED"] } },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { name: true } }, center: { select: { name: true, code: true } }, installments: { orderBy: { installmentNo: "asc" } } },
  });
  return apps.map((a) => {
    const m = moneyFields(a);
    const due = Math.max(0, m.payableAmount - m.paidAmount);
    return { ...m, installments: a.installments.map((i) => ({ ...i, amount: toNumber(i.amount) })), due, canPay: due > 0 && (PAYABLE_APPLICATION_STATUSES as readonly string[]).includes(a.status) };
  });
}

/** Stores an uploaded proof file reference on a payment the student owns (offline payments only). */
export async function attachPaymentProof(paymentId: string, studentId: string, proof: { url: string; name: string }) {
  const payment = await db.payment.findFirst({ where: { id: paymentId, studentId } });
  if (!payment) throw Errors.notFound("Payment");
  if (!["PENDING", "PROCESSING"].includes(payment.status)) throw Errors.badRequest("Proof can only be attached to a payment awaiting verification.");
  const metadata = (payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata) ? payment.metadata : {}) as Record<string, unknown>;
  return db.payment.update({ where: { id: paymentId }, data: { metadata: { ...metadata, proofUrl: proof.url, proofName: proof.name, proofUploadedAt: new Date().toISOString() } as Prisma.InputJsonValue } });
}

// ───────────────────────────── Apply wizard lookups ─────────────────────────────

const applyCenterSelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  address: true,
  landmark: true,
  villageTown: true,
  pincode: true,
  phone: true,
  whatsapp: true,
  isVerified: true,
  facilities: true,
  coverImage: true,
  state: { select: { id: true, name: true, slug: true } },
  district: { select: { id: true, name: true, slug: true } },
  block: { select: { id: true, name: true } },
  courses: { where: { isActive: true, course: { status: "ACTIVE" as const, deletedAt: null } }, select: { course: { select: { id: true, name: true, slug: true, code: true, durationText: true, level: true, mode: true, courseFee: true, scholarshipAvailable: true, icon: true } } } },
} satisfies Prisma.CenterSelect;

/** A single active center by id (used to prefill the apply wizard from a public center page). */
export async function getCenterForApply(centerId: string) {
  const c = await db.center.findFirst({ where: { id: centerId, deletedAt: null, status: "ACTIVE" }, select: applyCenterSelect });
  if (!c) throw Errors.notFound("Training center");
  const batches = await db.batch.findMany({ where: { centerId: c.id, deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } }, select: { id: true, capacity: true } });
  let availableSeats = 0;
  for (const b of batches) availableSeats += Math.max(0, b.capacity - (await countOccupiedSeats(b.id)));
  return { ...c, courses: c.courses.map((cc) => ({ ...cc, course: { ...cc.course, courseFee: toNumber(cc.course.courseFee) } })), availableSeats, openBatches: batches.length };
}

/** Course details for the apply wizard: fee breakdown and required document names. */
export async function getCourseForApply(courseId: string) {
  const course = await db.course.findFirst({
    where: { id: courseId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, code: true, name: true, slug: true, shortDescription: true, durationText: true, durationWeeks: true, level: true, mode: true, eligibility: true, minAge: true, maxAge: true, totalClasses: true, courseFee: true, registrationFee: true, examFee: true, certificateFee: true, scholarshipAvailable: true, scholarshipNote: true, minAttendancePct: true, requiredDocuments: true, category: { select: { name: true } } },
  });
  if (!course) throw Errors.notFound("Course");
  const { lines, originalFee } = computeFeeLines(course);
  const required = await requiredDocumentKeys(course);
  return {
    ...course,
    courseFee: toNumber(course.courseFee),
    registrationFee: toNumber(course.registrationFee),
    examFee: toNumber(course.examFee),
    certificateFee: toNumber(course.certificateFee),
    feeLines: lines,
    originalFee,
    requiredDocumentTypes: required.map((r) => ({ key: r.key, name: r.name })),
  };
}

export async function listStudentDocumentTypes() {
  return db.documentType.findMany({ where: { appliesTo: "STUDENT", isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

// ───────────────────────────── Account ─────────────────────────────

export async function getLoginHistory(userId: string, take = 10) {
  return db.loginHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, select: { id: true, success: true, reason: true, ip: true, userAgent: true, createdAt: true } });
}

export async function getActiveSessions(userId: string) {
  return db.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true } });
}

export async function revokeOtherSessions(userId: string, keepSessionId: string) {
  const before = await db.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() }, id: { not: keepSessionId } } });
  await revokeAllSessions(userId, keepSessionId);
  return { revoked: before };
}
