import { db, type Prisma } from "@/lib/db";
import type { ApplicationStatus, FeeType } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify, notifyStaff } from "@/lib/notifications";
import { generateAdmissionNo, generateApplicationNo, generateStudentId } from "@/lib/ids";
import { getSetting } from "@/lib/settings";
import { calcAge, formatINR, titleCase, toNumber } from "@/lib/utils";
import { assertBatchHasSeat, formatSchedule, getBatchSeatInfo } from "@/server/batches";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

type Tx = Prisma.TransactionClient;

export const OPEN_STATUSES: ApplicationStatus[] = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "WAITLISTED",
];

/** Allowed status transitions (admin + system). Student-side transitions are a subset enforced separately. */
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "WAITLISTED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["DOCUMENTS_REQUIRED", "APPROVED", "WAITLISTED", "REJECTED", "CANCELLED"],
  DOCUMENTS_REQUIRED: ["UNDER_REVIEW", "APPROVED", "WAITLISTED", "REJECTED", "CANCELLED"],
  APPROVED: ["PAYMENT_PENDING", "ADMISSION_CONFIRMED", "WAITLISTED", "CANCELLED"],
  PAYMENT_PENDING: ["PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "CANCELLED"],
  PAYMENT_COMPLETED: ["ADMISSION_CONFIRMED", "CANCELLED"],
  ADMISSION_CONFIRMED: ["COMPLETED", "CANCELLED"],
  WAITLISTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  REJECTED: ["UNDER_REVIEW"],
  CANCELLED: [],
  COMPLETED: [],
};

export function assertTransition(from: ApplicationStatus, to: ApplicationStatus) {
  if (!APPLICATION_TRANSITIONS[from].includes(to)) {
    throw Errors.badRequest(`Cannot move an application from "${titleCase(from)}" to "${titleCase(to)}".`);
  }
}

export function computeFeeLines(course: { courseFee: unknown; registrationFee: unknown; examFee: unknown; certificateFee: unknown }) {
  const lines: { type: FeeType; description: string; amount: number }[] = [];
  const push = (type: FeeType, description: string, amount: unknown) => {
    const n = toNumber(amount);
    if (n > 0) lines.push({ type, description, amount: n });
  };
  push("REGISTRATION", "Registration fee", course.registrationFee);
  push("COURSE", "Course fee", course.courseFee);
  push("EXAM", "Examination fee", course.examFee);
  push("CERTIFICATE", "Certificate fee", course.certificateFee);
  const originalFee = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, originalFee };
}

async function setStatus(tx: Tx, appId: string, from: ApplicationStatus, to: ApplicationStatus, note: string | null | undefined, actorId: string | null) {
  assertTransition(from, to);
  await tx.application.update({ where: { id: appId }, data: { status: to } });
  await tx.applicationStatusHistory.create({ data: { applicationId: appId, fromStatus: from, toStatus: to, note: note ?? null, changedById: actorId } });
}

const appInclude = {
  student: { include: { user: { select: { id: true, name: true, email: true, mobile: true } } } },
  course: true,
  center: { include: { state: true, district: true, block: true } },
  batch: true,
} satisfies Prisma.ApplicationInclude;

type AppWithRelations = Prisma.ApplicationGetPayload<{ include: typeof appInclude }>;

function studentContact(app: AppWithRelations) {
  return { userId: app.student.user.id, email: app.student.user.email ?? app.student.email, mobile: app.student.user.mobile ?? app.student.mobile, name: app.student.name };
}

// ───────────────────────────── Student side ─────────────────────────────

export interface StartApplicationInput {
  studentId: string;
  centerId: string;
  courseId: string;
  batchId?: string | null;
  scholarshipRequested?: boolean;
  scholarshipReason?: string | null;
}

export async function startApplication(input: StartApplicationInput, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  if (!(await getSetting<boolean>("admissions.open"))) throw Errors.forbidden("Admissions are currently closed.");
  const student = await db.student.findUnique({ where: { id: input.studentId }, include: { user: { select: { id: true, name: true } } } });
  if (!student) throw Errors.notFound("Student");
  if (!student.profileCompleted) throw Errors.badRequest("Please complete your profile before applying.");

  const center = await db.center.findFirst({
    where: { id: input.centerId, deletedAt: null, status: "ACTIVE" },
    include: { courses: { where: { courseId: input.courseId, isActive: true } } },
  });
  if (!center) throw Errors.notFound("Training center");
  const course = await db.course.findFirst({ where: { id: input.courseId, deletedAt: null, status: "ACTIVE" } });
  if (!course) throw Errors.notFound("Course");
  if (center.courses.length === 0) throw Errors.badRequest("This course is not offered at the selected center.");

  const age = calcAge(student.dob);
  if (age !== null) {
    if (course.minAge && age < course.minAge) throw Errors.badRequest(`The minimum age for this course is ${course.minAge} years.`);
    if (course.maxAge && age > course.maxAge) throw Errors.badRequest(`The maximum age for this course is ${course.maxAge} years.`);
  }

  let batchId: string | null = null;
  if (input.batchId) {
    const batch = await db.batch.findFirst({ where: { id: input.batchId, centerId: center.id, courseId: course.id, deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } } });
    if (!batch) throw Errors.badRequest("The selected batch is not available for this course and center.");
    const seats = await getBatchSeatInfo(batch.id);
    if (seats.available <= 0) throw Errors.conflict("The selected batch is full. Choose another batch, or apply without a batch to be allocated later.");
    batchId = batch.id;
  }

  const existing = await db.application.findFirst({ where: { studentId: student.id, courseId: course.id, status: { in: OPEN_STATUSES } } });
  if (existing) throw Errors.conflict(`You already have an open application (${existing.applicationNo}) for this course.`);

  const { lines, originalFee } = computeFeeLines(course);
  const app = await db.$transaction(async (tx) => {
    const applicationNo = await generateApplicationNo(tx);
    return tx.application.create({
      data: {
        applicationNo,
        studentId: student.id,
        centerId: center.id,
        courseId: course.id,
        batchId,
        status: "DRAFT",
        originalFee,
        payableAmount: originalFee,
        scholarshipRequested: !!input.scholarshipRequested && course.scholarshipAvailable && originalFee > 0,
        scholarshipReason: input.scholarshipReason ?? null,
        fees: { create: lines },
        statusHistory: { create: [{ toStatus: "DRAFT", changedById: student.user.id }] },
      },
    });
  });
  await db.analyticsEvent.create({ data: { type: "APPLICATION_STARTED", refId: app.id, ipHash: meta.ip ?? null } }).catch(() => undefined);
  return app;
}

export interface UpdateDraftApplicationInput {
  centerId?: string;
  courseId?: string;
  batchId?: string | null;
  scholarshipRequested?: boolean;
  scholarshipReason?: string | null;
}

/**
 * Edits a student's own DRAFT application from the apply wizard (so resuming a draft never creates a
 * duplicate). Re-runs every check `startApplication` makes – center active, course active and offered at
 * that center, age limits, batch belongs to the center/course and has a free seat, no other open
 * application for the course – then recomputes the fee lines, `originalFee` and `payableAmount`.
 *
 * Everything runs sequentially inside one interactive transaction (the tx client is a single connection).
 */
export async function updateDraftApplication(
  id: string,
  studentId: string,
  patch: UpdateDraftApplicationInput,
  meta: { ip?: string | null; userAgent?: string | null } = {}
) {
  const current = await db.application.findFirst({ where: { id, studentId }, include: { student: { include: { user: { select: { id: true, name: true } } } } } });
  if (!current) throw Errors.notFound("Application");
  if (current.status !== "DRAFT") throw Errors.badRequest("Only a draft application can be edited. This application has already been submitted.");

  const centerId = patch.centerId ?? current.centerId;
  const courseId = patch.courseId ?? current.courseId;
  const batchWanted = patch.batchId === undefined ? current.batchId : patch.batchId || null;
  const courseChanged = courseId !== current.courseId;
  const centerChanged = centerId !== current.centerId;

  const result = await db.$transaction(async (tx) => {
    const center = await tx.center.findFirst({ where: { id: centerId, deletedAt: null, status: "ACTIVE" } });
    if (!center) throw Errors.notFound("Training center");
    const course = await tx.course.findFirst({ where: { id: courseId, deletedAt: null, status: "ACTIVE" } });
    if (!course) throw Errors.notFound("Course");
    const offered = await tx.centerCourse.findFirst({ where: { centerId, courseId, isActive: true } });
    if (!offered) throw Errors.badRequest("This course is not offered at the selected center.");

    const age = calcAge(current.student.dob);
    if (age !== null) {
      if (course.minAge && age < course.minAge) throw Errors.badRequest(`The minimum age for this course is ${course.minAge} years.`);
      if (course.maxAge && age > course.maxAge) throw Errors.badRequest(`The maximum age for this course is ${course.maxAge} years.`);
    }

    if (courseChanged) {
      const clash = await tx.application.findFirst({ where: { id: { not: id }, studentId, courseId, status: { in: OPEN_STATUSES } } });
      if (clash) throw Errors.conflict(`You already have an open application (${clash.applicationNo}) for this course.`);
    }

    // A batch from another center/course cannot survive a center or course change.
    let batchId: string | null = null;
    if (batchWanted) {
      const batch = await tx.batch.findFirst({ where: { id: batchWanted, centerId, courseId, deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } } });
      if (!batch) {
        if (patch.batchId) throw Errors.badRequest("The selected batch is not available for this course and center.");
      } else {
        const seats = await getBatchSeatInfo(batch.id, tx);
        if (seats.available <= 0 && patch.batchId) {
          throw Errors.conflict("The selected batch is full. Choose another batch, or apply without a batch to be allocated later.");
        }
        if (seats.available > 0) batchId = batch.id;
      }
    }

    const data: Prisma.ApplicationUncheckedUpdateInput = { centerId, courseId, batchId };

    if (courseChanged || centerChanged) {
      const { lines, originalFee } = computeFeeLines(course);
      const scholarship = toNumber(current.scholarshipAmount);
      const discount = toNumber(current.discountAmount);
      data.originalFee = originalFee;
      data.payableAmount = Math.max(0, originalFee - scholarship - discount);
      await tx.fee.deleteMany({ where: { applicationId: id } });
      if (lines.length) await tx.fee.createMany({ data: lines.map((l) => ({ ...l, applicationId: id })) });
    }

    if (patch.scholarshipRequested !== undefined || patch.scholarshipReason !== undefined || courseChanged) {
      const wanted = patch.scholarshipRequested ?? current.scholarshipRequested;
      const originalFee = data.originalFee === undefined ? toNumber(current.originalFee) : Number(data.originalFee);
      data.scholarshipRequested = !!wanted && course.scholarshipAvailable && originalFee > 0;
      if (patch.scholarshipReason !== undefined) data.scholarshipReason = patch.scholarshipReason || null;
      if (!data.scholarshipRequested) data.scholarshipReason = null;
    }

    return tx.application.update({ where: { id }, data });
  });

  await audit({
    user: { id: current.student.user.id, name: current.student.name, role: "STUDENT" },
    action: "update_draft",
    module: "applications",
    recordType: "Application",
    recordId: id,
    description: `Student ${current.student.name} updated draft application ${current.applicationNo}`,
    oldValue: { centerId: current.centerId, courseId: current.courseId, batchId: current.batchId, scholarshipRequested: current.scholarshipRequested },
    newValue: { centerId: result.centerId, courseId: result.courseId, batchId: result.batchId, scholarshipRequested: result.scholarshipRequested },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    id: result.id,
    applicationNo: result.applicationNo,
    status: result.status,
    centerId: result.centerId,
    courseId: result.courseId,
    batchId: result.batchId,
    scholarshipRequested: result.scholarshipRequested,
    scholarshipReason: result.scholarshipReason,
    originalFee: toNumber(result.originalFee),
    scholarshipAmount: toNumber(result.scholarshipAmount),
    discountAmount: toNumber(result.discountAmount),
    payableAmount: toNumber(result.payableAmount),
    paidAmount: toNumber(result.paidAmount),
  };
}

/** Document type keys required for an application (course-specific, falling back to all required student document types). */
export async function requiredDocumentKeys(course: { requiredDocuments: string[] }) {
  const types = await db.documentType.findMany({ where: { appliesTo: "STUDENT", isActive: true }, orderBy: { sortOrder: "asc" } });
  if (course.requiredDocuments.length > 0) return types.filter((t) => course.requiredDocuments.includes(t.key));
  return types.filter((t) => t.isRequired);
}

export async function missingDocuments(app: { studentId: string; course: { requiredDocuments: string[] } }) {
  const required = await requiredDocumentKeys(app.course);
  const uploaded = await db.studentDocument.findMany({ where: { studentId: app.studentId, status: { in: ["PENDING", "VERIFIED"] } }, select: { type: true } });
  const have = new Set(uploaded.map((d) => d.type));
  return required.filter((t) => !have.has(t.key));
}

export async function submitApplication(applicationId: string, studentId: string, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const app = await db.application.findFirst({ where: { id: applicationId, studentId }, include: appInclude });
  if (!app) throw Errors.notFound("Application");
  if (app.status !== "DRAFT") throw Errors.badRequest("This application has already been submitted.");
  const missing = await missingDocuments(app);
  if (missing.length) {
    throw Errors.validation("Please upload all required documents before submitting.", { documents: `Missing: ${missing.map((m) => m.name).join(", ")}` });
  }
  const autoReview = await getSetting<boolean>("admissions.autoReview");
  await db.$transaction(async (tx) => {
    await setStatus(tx, app.id, "DRAFT", "SUBMITTED", null, app.student.user.id);
    await tx.application.update({ where: { id: app.id }, data: { submittedAt: new Date() } });
    if (autoReview) await setStatus(tx, app.id, "SUBMITTED", "UNDER_REVIEW", "Automatically moved to review", null);
  });
  const c = studentContact(app);
  await notify({ ...c, event: "APPLICATION_SUBMITTED", data: { name: c.name, applicationNo: app.applicationNo, course: app.course.name, center: app.center.name } });
  await notifyStaff({
    permission: "applications.view",
    title: `New application ${app.applicationNo}`,
    body: `${app.student.name} applied for ${app.course.name} at ${app.center.name}.`,
    path: `/admin/applications/${app.id}`,
  });
  await audit({ user: { id: app.student.user.id, name: app.student.name, role: "STUDENT" }, action: "submit", module: "applications", recordType: "Application", recordId: app.id, description: `Student ${app.student.name} submitted application ${app.applicationNo}`, ip: meta.ip, userAgent: meta.userAgent });
  return db.application.findUniqueOrThrow({ where: { id: app.id }, include: appInclude });
}

export async function studentCancelApplication(applicationId: string, studentId: string, reason?: string) {
  const app = await db.application.findFirst({ where: { id: applicationId, studentId }, include: appInclude });
  if (!app) throw Errors.notFound("Application");
  if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "WAITLISTED"].includes(app.status)) {
    throw Errors.badRequest("This application can no longer be cancelled online. Please contact the Foundation.");
  }
  await db.$transaction(async (tx) => {
    await setStatus(tx, app.id, app.status, "CANCELLED", reason ?? "Cancelled by student", app.student.user.id);
  });
  await audit({ user: { id: app.student.user.id, name: app.student.name, role: "STUDENT" }, action: "cancel", module: "applications", recordType: "Application", recordId: app.id, description: `Student cancelled application ${app.applicationNo}` });
}

/** After a document upload, an application waiting for documents returns to review automatically when nothing is missing. */
export async function reconsiderAfterDocuments(studentId: string) {
  const waiting = await db.application.findMany({ where: { studentId, status: "DOCUMENTS_REQUIRED" }, include: { course: true } });
  for (const app of waiting) {
    const missing = await missingDocuments(app);
    if (missing.length === 0) {
      await db.$transaction(async (tx) => setStatus(tx, app.id, "DOCUMENTS_REQUIRED", "UNDER_REVIEW", "Documents uploaded by student", null));
    }
  }
}

// ───────────────────────────── Admin side ─────────────────────────────

async function loadForAdmin(id: string, tx: Tx | typeof db = db) {
  const app = await tx.application.findUnique({ where: { id }, include: appInclude });
  if (!app) throw Errors.notFound("Application");
  return app;
}

export async function moveToReview(id: string, ctx: Ctx, note?: string) {
  const app = await loadForAdmin(id);
  await db.$transaction(async (tx) => {
    await setStatus(tx, id, app.status, "UNDER_REVIEW", note, ctx.user.id);
    await tx.application.update({ where: { id }, data: { reviewedById: ctx.user.id } });
  });
  await audit({ user: ctx.user, action: "review", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} moved application ${app.applicationNo} to Under Review`, ip: ctx.ip, userAgent: ctx.userAgent });
  const c = studentContact(app);
  await notify({ ...c, event: "APPLICATION_STATUS", data: { name: c.name, applicationNo: app.applicationNo, status: "Under Review", note: note ?? "" } });
}

export async function requestDocuments(id: string, note: string, ctx: Ctx) {
  const app = await loadForAdmin(id);
  await db.$transaction(async (tx) => {
    await setStatus(tx, id, app.status, "DOCUMENTS_REQUIRED", note, ctx.user.id);
    await tx.application.update({ where: { id }, data: { documentsRequestNote: note, reviewedById: ctx.user.id } });
  });
  await audit({ user: ctx.user, action: "request_documents", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} requested documents for application ${app.applicationNo}`, newValue: { note }, ip: ctx.ip, userAgent: ctx.userAgent });
  const c = studentContact(app);
  await notify({ ...c, event: "DOCUMENTS_REQUIRED", data: { name: c.name, applicationNo: app.applicationNo, note } });
}

export async function rejectApplication(id: string, reason: string, ctx: Ctx) {
  const app = await loadForAdmin(id);
  await db.$transaction(async (tx) => {
    await setStatus(tx, id, app.status, "REJECTED", reason, ctx.user.id);
    await tx.application.update({ where: { id }, data: { rejectionReason: reason, reviewedById: ctx.user.id } });
  });
  await audit({ user: ctx.user, action: "reject", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} rejected application ${app.applicationNo}`, newValue: { reason }, ip: ctx.ip, userAgent: ctx.userAgent });
  const c = studentContact(app);
  await notify({ ...c, event: "APPLICATION_STATUS", data: { name: c.name, applicationNo: app.applicationNo, status: "Rejected", note: reason } });
}

export async function waitlistApplication(id: string, note: string | undefined, ctx: Ctx) {
  const app = await loadForAdmin(id);
  const position = (await db.application.count({ where: { courseId: app.courseId, centerId: app.centerId, status: "WAITLISTED" } })) + 1;
  await db.$transaction(async (tx) => {
    await setStatus(tx, id, app.status, "WAITLISTED", note, ctx.user.id);
    await tx.application.update({ where: { id }, data: { waitlistPosition: position, reviewedById: ctx.user.id } });
  });
  await audit({ user: ctx.user, action: "waitlist", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} waitlisted application ${app.applicationNo} (position ${position})`, ip: ctx.ip, userAgent: ctx.userAgent });
  const c = studentContact(app);
  await notify({ ...c, event: "APPLICATION_STATUS", data: { name: c.name, applicationNo: app.applicationNo, status: "Waitlisted", note: note ?? `You are number ${position} on the waitlist.` } });
}

export async function cancelApplication(id: string, reason: string, ctx: Ctx) {
  const app = await loadForAdmin(id);
  await db.$transaction(async (tx) => {
    await setStatus(tx, id, app.status, "CANCELLED", reason, ctx.user.id);
  });
  await audit({ user: ctx.user, action: "cancel", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} cancelled application ${app.applicationNo}`, newValue: { reason }, ip: ctx.ip, userAgent: ctx.userAgent });
  const c = studentContact(app);
  await notify({ ...c, event: "APPLICATION_STATUS", data: { name: c.name, applicationNo: app.applicationNo, status: "Cancelled", note: reason } });
}

/** Assign or change the batch. Locks the seat when the application already reserves one. */
export async function assignBatch(id: string, batchId: string | null, ctx: Ctx) {
  const result = await db.$transaction(async (tx) => {
    const app = await loadForAdmin(id, tx);
    if (["ADMISSION_CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED"].includes(app.status)) {
      throw Errors.badRequest("Batch can only be changed before admission is confirmed. Use the admission record instead.");
    }
    if (batchId) {
      const batch = await tx.batch.findFirst({ where: { id: batchId, centerId: app.centerId, courseId: app.courseId, deletedAt: null } });
      if (!batch) throw Errors.badRequest("Batch must belong to the application's center and course.");
      if (["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"].includes(app.status) && app.batchId !== batchId) await assertBatchHasSeat(tx, batchId);
    }
    const updated = await tx.application.update({ where: { id }, data: { batchId }, include: { batch: true } });
    return { app, updated };
  });
  await audit({ user: ctx.user, action: "assign_batch", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} set batch ${result.updated.batch?.code ?? "none"} on application ${result.app.applicationNo}`, oldValue: { batchId: result.app.batchId }, newValue: { batchId }, ip: ctx.ip, userAgent: ctx.userAgent });
  if (result.updated.batch) {
    const c = studentContact(result.app);
    await notify({ ...c, event: "BATCH_ALLOCATED", data: { name: c.name, batch: result.updated.batch.name, course: result.app.course.name, center: result.app.center.name, schedule: formatSchedule(result.updated.batch) } });
  }
  return result.updated;
}

/**
 * Approve after review. Reserves a seat when a batch is set. Moves straight to PAYMENT_PENDING
 * when money is due, or confirms admission when nothing is payable and a batch is assigned.
 */
export async function approveApplication(id: string, input: { batchId?: string | null; note?: string | null }, ctx: Ctx) {
  const outcome = await db.$transaction(async (tx) => {
    const app = await loadForAdmin(id, tx);
    assertTransition(app.status, "APPROVED");
    const batchId = input.batchId === undefined ? app.batchId : input.batchId;
    if (batchId) {
      const batch = await tx.batch.findFirst({ where: { id: batchId, centerId: app.centerId, courseId: app.courseId, deletedAt: null } });
      if (!batch) throw Errors.badRequest("Batch must belong to the application's center and course.");
      await assertBatchHasSeat(tx, batchId);
    }
    await setStatus(tx, id, app.status, "APPROVED", input.note, ctx.user.id);
    await tx.application.update({ where: { id }, data: { batchId, reviewedById: ctx.user.id, reviewNotes: input.note ?? app.reviewNotes, waitlistPosition: null } });
    const due = toNumber(app.payableAmount) - toNumber(app.paidAmount);
    let final: ApplicationStatus = "APPROVED";
    if (due > 0.005) {
      await setStatus(tx, id, "APPROVED", "PAYMENT_PENDING", "Fee payment required", ctx.user.id);
      final = "PAYMENT_PENDING";
    }
    return { app, batchId, due, final };
  });

  await audit({ user: ctx.user, action: "approve", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} approved application ${outcome.app.applicationNo}`, newValue: { batchId: outcome.batchId, note: input.note }, ip: ctx.ip, userAgent: ctx.userAgent });
  const c = studentContact(outcome.app);
  if (outcome.final === "PAYMENT_PENDING") {
    await notify({ ...c, event: "PAYMENT_PENDING", data: { name: c.name, applicationNo: outcome.app.applicationNo, amount: formatINR(outcome.due) } });
    return { status: "PAYMENT_PENDING" as const };
  }
  if (outcome.batchId) {
    await confirmAdmission(id, ctx, "Approved with no fee due");
    return { status: "ADMISSION_CONFIRMED" as const };
  }
  await notify({ ...c, event: "APPLICATION_STATUS", data: { name: c.name, applicationNo: outcome.app.applicationNo, status: "Approved", note: "A batch will be allocated shortly." } });
  return { status: "APPROVED" as const };
}

/** Confirms admission: generates Student ID (once), admission number, progress record. */
export async function confirmAdmission(id: string, ctx: Ctx, note?: string | null, opts: { allowPartialPayment?: boolean } = {}) {
  const out = await db.$transaction(async (tx) => {
    const app = await loadForAdmin(id, tx);
    if (!["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"].includes(app.status)) assertTransition(app.status, "ADMISSION_CONFIRMED");
    if (!app.batchId || !app.batch) throw Errors.badRequest("Assign a batch before confirming admission.");
    const existing = await tx.admission.findUnique({ where: { applicationId: id } });
    if (existing) throw Errors.conflict("Admission already exists for this application.");
    const due = toNumber(app.payableAmount) - toNumber(app.paidAmount);
    if (due > 0.005) {
      const partialOk = (opts.allowPartialPayment || app.installmentsAllowed) && toNumber(app.paidAmount) > 0;
      if (!partialOk) throw Errors.badRequest(`Fee of ${formatINR(due)} is still due. Verify the payment first.`);
    }
    if (!["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"].includes(app.status)) await assertBatchHasSeat(tx, app.batchId);

    let studentCode = app.student.studentId;
    if (!studentCode) {
      studentCode = await generateStudentId(tx);
      await tx.student.update({ where: { id: app.studentId }, data: { studentId: studentCode } });
    }
    const admission = await tx.admission.create({
      data: {
        admissionNo: await generateAdmissionNo(tx),
        applicationId: id,
        studentId: app.studentId,
        centerId: app.centerId,
        courseId: app.courseId,
        batchId: app.batchId,
        trainerId: app.batch.trainerId,
        approvedById: ctx.user.id,
        notes: note ?? null,
        progress: { create: { totalClasses: app.course.totalClasses } },
      },
    });
    await setStatus(tx, id, app.status, "ADMISSION_CONFIRMED", note, ctx.user.id);
    await tx.application.update({ where: { id }, data: { reviewedById: ctx.user.id } });
    return { app, admission, studentCode };
  });

  await audit({ user: ctx.user, action: "confirm_admission", module: "admissions", recordType: "Admission", recordId: out.admission.id, description: `${ctx.user.name} confirmed admission ${out.admission.admissionNo} for ${out.app.student.name} (Student ID ${out.studentCode})`, ip: ctx.ip, userAgent: ctx.userAgent });
  const c = studentContact(out.app);
  await notify({ ...c, event: "ADMISSION_CONFIRMED", data: { name: c.name, course: out.app.course.name, center: out.app.center.name, studentId: out.studentCode, batch: `${out.app.batch!.name} (${formatSchedule(out.app.batch!)})` } });
  return out.admission;
}

/** Recomputes paidAmount from completed payments and advances the status when fully paid. Call inside the payment transaction. */
export async function syncPaymentStatus(tx: Tx, applicationId: string, actorId: string | null) {
  const app = await tx.application.findUnique({ where: { id: applicationId }, select: { id: true, status: true, payableAmount: true, installmentsAllowed: true } });
  if (!app) throw Errors.notFound("Application");
  const agg = await tx.payment.aggregate({ where: { applicationId, status: "COMPLETED" }, _sum: { amount: true } });
  const paid = toNumber(agg._sum.amount);
  await tx.application.update({ where: { id: applicationId }, data: { paidAmount: paid } });
  const fullyPaid = paid + 0.005 >= toNumber(app.payableAmount);
  if (fullyPaid && (app.status === "PAYMENT_PENDING" || app.status === "APPROVED")) {
    await setStatus(tx, applicationId, app.status, "PAYMENT_COMPLETED", "Fee fully paid", actorId);
  }
  return { paid, fullyPaid };
}

export async function markCompleted(applicationId: string, ctx: Ctx) {
  const app = await loadForAdmin(applicationId);
  await db.$transaction(async (tx) => setStatus(tx, applicationId, app.status, "COMPLETED", "Course completed", ctx.user.id));
}

/** Change center/course before approval; fees are recalculated. */
export async function changeCourseOrCenter(id: string, input: { centerId?: string; courseId?: string }, ctx: Ctx) {
  const app = await loadForAdmin(id);
  if (!["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "WAITLISTED", "DRAFT"].includes(app.status)) {
    throw Errors.badRequest("Center or course can only be changed before approval.");
  }
  const centerId = input.centerId ?? app.centerId;
  const courseId = input.courseId ?? app.courseId;
  const offered = await db.centerCourse.findUnique({ where: { centerId_courseId: { centerId, courseId } } });
  if (!offered) throw Errors.badRequest("This course is not offered at that center.");
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  const { lines, originalFee } = computeFeeLines(course);
  const scholarship = toNumber(app.scholarshipAmount);
  const discount = toNumber(app.discountAmount);
  const updated = await db.$transaction(async (tx) => {
    await tx.fee.deleteMany({ where: { applicationId: id } });
    return tx.application.update({
      where: { id },
      data: { centerId, courseId, batchId: null, originalFee, payableAmount: Math.max(0, originalFee - scholarship - discount), fees: { create: lines } },
    });
  });
  await audit({ user: ctx.user, action: "change_course", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} changed center/course on application ${app.applicationNo}`, oldValue: { centerId: app.centerId, courseId: app.courseId }, newValue: { centerId, courseId }, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}

export async function applyDiscount(id: string, discountAmount: number, note: string | undefined, ctx: Ctx) {
  const app = await loadForAdmin(id);
  if (["ADMISSION_CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED"].includes(app.status)) throw Errors.badRequest("Discount cannot be changed after admission.");
  const original = toNumber(app.originalFee);
  const scholarship = toNumber(app.scholarshipAmount);
  if (discountAmount < 0 || discountAmount + scholarship > original) throw Errors.validation("Please correct the highlighted fields.", { discountAmount: "Discount plus scholarship cannot exceed the original fee" });
  const updated = await db.application.update({ where: { id }, data: { discountAmount, payableAmount: original - scholarship - discountAmount, reviewNotes: note ?? app.reviewNotes } });
  await audit({ user: ctx.user, action: "discount", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} applied a discount of ${formatINR(discountAmount)} on ${app.applicationNo}`, oldValue: { discountAmount: app.discountAmount }, newValue: { discountAmount }, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}

export async function setInstallmentsAllowed(id: string, allowed: boolean, ctx: Ctx) {
  const app = await loadForAdmin(id);
  const updated = await db.application.update({ where: { id }, data: { installmentsAllowed: allowed } });
  await audit({ user: ctx.user, action: "installments", module: "applications", recordType: "Application", recordId: id, description: `${ctx.user.name} ${allowed ? "allowed" : "disallowed"} installments on ${app.applicationNo}`, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}

// ───────────────────────────── Queries ─────────────────────────────

export const applicationListSchema = paginationSchema.extend({
  status: z.string().optional(),
  centerId: optionalUuid,
  courseId: optionalUuid,
  batchId: optionalUuid,
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  studentId: optionalUuid,
  payment: z.enum(["paid", "unpaid", "partial"]).optional(),
  scholarship: z.enum(["requested", "awarded"]).optional(),
  from: optionalDate,
  to: optionalDate,
});

export type ApplicationListQuery = z.infer<typeof applicationListSchema>;

export async function listApplications(q: ApplicationListQuery) {
  const where: Prisma.ApplicationWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",").filter(Boolean) as ApplicationStatus[] };
  if (q.centerId) where.centerId = q.centerId;
  if (q.courseId) where.courseId = q.courseId;
  if (q.batchId) where.batchId = q.batchId;
  if (q.studentId) where.studentId = q.studentId;
  if (q.stateId || q.districtId || q.blockId) where.center = { stateId: q.stateId, districtId: q.districtId, blockId: q.blockId };
  if (q.payment === "paid") where.AND = [{ payableAmount: { gt: 0 } }, { paidAmount: { gte: db.application.fields.payableAmount } }];
  if (q.payment === "unpaid") where.paidAmount = { equals: 0 };
  if (q.payment === "partial") where.AND = [{ paidAmount: { gt: 0 } }, { paidAmount: { lt: db.application.fields.payableAmount } }];
  if (q.scholarship === "requested") where.scholarshipRequested = true;
  if (q.scholarship === "awarded") where.scholarshipAmount = { gt: 0 };
  if (q.from || q.to) where.createdAt = { gte: q.from, lt: q.to };
  if (q.q) {
    where.OR = [
      { applicationNo: { contains: q.q, mode: "insensitive" } },
      { student: { name: { contains: q.q, mode: "insensitive" } } },
      { student: { mobile: { contains: q.q } } },
      { student: { studentId: { contains: q.q, mode: "insensitive" } } },
    ];
  }
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "submittedAt", "status", "applicationNo", "payableAmount"] as const, "createdAt");
  const [items, total] = await Promise.all([
    db.application.findMany({
      where,
      orderBy,
      ...getPaging(q),
      include: {
        student: { select: { id: true, name: true, mobile: true, studentId: true, photoUrl: true } },
        course: { select: { id: true, name: true, code: true } },
        center: { select: { id: true, name: true, code: true, state: { select: { name: true } }, district: { select: { name: true } } } },
        batch: { select: { id: true, name: true, code: true } },
      },
    }),
    db.application.count({ where }),
  ]);
  return paged(
    items.map((a) => ({ ...a, originalFee: toNumber(a.originalFee), scholarshipAmount: toNumber(a.scholarshipAmount), discountAmount: toNumber(a.discountAmount), payableAmount: toNumber(a.payableAmount), paidAmount: toNumber(a.paidAmount) })),
    total,
    q
  );
}

export async function getApplicationDetail(id: string, scope?: { studentId?: string }) {
  const app = await db.application.findFirst({
    where: { id, ...(scope?.studentId ? { studentId: scope.studentId } : {}) },
    include: {
      ...appInclude,
      fees: true,
      installments: { orderBy: { installmentNo: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      scholarshipAward: { include: { program: true } },
      admission: { include: { progress: true, certificate: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!app) throw Errors.notFound("Application");
  const allDocs = await db.studentDocument.findMany({ where: { studentId: app.studentId }, orderBy: { createdAt: "desc" } });
  const required = await requiredDocumentKeys(app.course);
  const missing = await missingDocuments(app);
  return {
    ...app,
    originalFee: toNumber(app.originalFee),
    scholarshipAmount: toNumber(app.scholarshipAmount),
    discountAmount: toNumber(app.discountAmount),
    payableAmount: toNumber(app.payableAmount),
    paidAmount: toNumber(app.paidAmount),
    fees: app.fees.map((f) => ({ ...f, amount: toNumber(f.amount) })),
    installments: app.installments.map((i) => ({ ...i, amount: toNumber(i.amount) })),
    payments: app.payments.map((p) => ({ ...p, amount: toNumber(p.amount) })),
    scholarshipAward: app.scholarshipAward
      ? { ...app.scholarshipAward, originalFee: toNumber(app.scholarshipAward.originalFee), scholarshipAmount: toNumber(app.scholarshipAward.scholarshipAmount), payableFee: toNumber(app.scholarshipAward.payableFee) }
      : null,
    studentDocuments: allDocs,
    requiredDocuments: required,
    missingDocuments: missing,
    allowedTransitions: APPLICATION_TRANSITIONS[app.status],
  };
}

export type ApplicationDetail = Awaited<ReturnType<typeof getApplicationDetail>>;
