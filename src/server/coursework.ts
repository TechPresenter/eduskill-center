import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { AssessmentType } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { getPaging, paged } from "@/lib/api/query";
import { audit, type AuditActor } from "@/lib/audit";
import type { AuthUser } from "@/lib/auth/session";
import { notify } from "@/lib/notifications";
import { deleteStoredFile, isFileUrlUnder, keyFromUrl, type StoredFile } from "@/lib/storage";
import { toNumber } from "@/lib/utils";
import { assertBatchAccess } from "@/server/attendance";
import { recomputeProgress } from "@/server/progress";
import { uuid } from "@/lib/validation/common";
import { gradeFor } from "@/components/trainer/grades";

/**
 * Coursework services shared by the Trainer Portal (create/update/grade) and read-side consumers
 * (student portal / admin). Every trainer-facing mutation checks batch access via assertBatchAccess.
 */

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

function actor(user: AuthUser): AuditActor {
  return { id: user.id, name: user.name, role: user.role };
}

const optionalDateTime = z
  .union([z.literal(""), z.string().trim().min(10).max(40)])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

const optionalDay = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")])
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null));

// ───────────────────────────── Assignments ─────────────────────────────

export const assignmentSchema = z.object({
  batchId: uuid,
  title: z.string().trim().min(3, "Enter a title").max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  attachmentUrl: z.string().trim().max(500).optional().nullable(),
  dueDate: optionalDateTime,
  maxMarks: z.coerce.number().int().min(1, "Max marks must be at least 1").max(1000).default(100),
});
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export const assignmentUpdateSchema = assignmentSchema.omit({ batchId: true });

export async function listAssignments(batchId: string) {
  const rows = await db.assignment.findMany({
    where: { batchId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submissions: true } }, submissions: { select: { status: true } } },
  });
  return rows.map(({ submissions, ...a }) => ({ ...a, submissionCount: a._count.submissions, gradedCount: submissions.filter((s) => s.status === "GRADED").length }));
}

function assertAttachment(url: string | null | undefined, batchId: string) {
  if (url && !isFileUrlUnder(url, `private/materials/${batchId}/`)) throw Errors.badRequest("Invalid attachment");
}

export async function createAssignment(input: AssignmentInput, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  await assertBatchAccess(user, input.batchId, "progress.update");
  assertAttachment(input.attachmentUrl, input.batchId);
  const batch = await db.batch.findFirst({ where: { id: input.batchId, deletedAt: null }, select: { code: true, status: true } });
  if (!batch) throw Errors.notFound("Batch");
  if (batch.status === "CANCELLED") throw Errors.badRequest("This batch is cancelled.");
  const a = await db.assignment.create({
    data: {
      batchId: input.batchId,
      trainerId: user.trainer?.id ?? null,
      title: input.title,
      description: input.description || null,
      attachmentUrl: input.attachmentUrl || null,
      dueDate: input.dueDate,
      maxMarks: input.maxMarks,
      createdById: user.id,
    },
  });
  await syncBatchProgress(input.batchId);
  await audit({ user: actor(user), action: "create_assignment", module: "progress", recordType: "Assignment", recordId: a.id, description: `${user.name} created assignment "${a.title}" for batch ${batch.code}`, newValue: a, ip: meta.ip, userAgent: meta.userAgent });
  return a;
}

export async function updateAssignment(id: string, input: z.infer<typeof assignmentUpdateSchema>, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  const existing = await db.assignment.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Assignment");
  await assertBatchAccess(user, existing.batchId, "progress.update");
  assertAttachment(input.attachmentUrl, existing.batchId);
  const a = await db.assignment.update({
    where: { id },
    data: { title: input.title, description: input.description || null, attachmentUrl: input.attachmentUrl || null, dueDate: input.dueDate, maxMarks: input.maxMarks },
  });
  await audit({ user: actor(user), action: "update_assignment", module: "progress", recordType: "Assignment", recordId: id, description: `${user.name} updated assignment "${a.title}"`, oldValue: existing, newValue: a, ip: meta.ip, userAgent: meta.userAgent });
  return a;
}

export async function deleteAssignment(id: string, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  const existing = await db.assignment.findUnique({ where: { id }, include: { _count: { select: { submissions: true } } } });
  if (!existing) throw Errors.notFound("Assignment");
  await assertBatchAccess(user, existing.batchId, "progress.update");
  if (existing._count.submissions > 0) throw Errors.conflict("Students have already submitted work for this assignment. It cannot be deleted.");
  await db.assignment.delete({ where: { id } });
  await syncBatchProgress(existing.batchId);
  await audit({ user: actor(user), action: "delete_assignment", module: "progress", recordType: "Assignment", recordId: id, description: `${user.name} deleted assignment "${existing.title}"`, oldValue: existing, ip: meta.ip, userAgent: meta.userAgent });
}

/** Roster of the batch with each student's submission (if any) for the assignment. */
export async function assignmentSubmissions(assignmentId: string, user: AuthUser) {
  const assignment = await db.assignment.findUnique({ where: { id: assignmentId }, include: { batch: { select: { id: true, code: true, name: true } } } });
  if (!assignment) throw Errors.notFound("Assignment");
  await assertBatchAccess(user, assignment.batchId, "progress.view");
  const [roster, submissions] = await Promise.all([
    db.admission.findMany({ where: { batchId: assignment.batchId, status: { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] } }, orderBy: { student: { name: "asc" } }, include: { student: { select: { id: true, name: true, studentId: true, photoUrl: true } } } }),
    db.assignmentSubmission.findMany({ where: { assignmentId } }),
  ]);
  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));
  return {
    assignment,
    rows: roster.map((r) => {
      const s = byStudent.get(r.student.id);
      return {
        admissionId: r.id,
        student: r.student,
        admissionStatus: r.status,
        submission: s
          ? { id: s.id, status: s.status, text: s.text, fileUrl: s.fileUrl, submittedAt: s.submittedAt, marks: s.marks, feedback: s.feedback, gradedAt: s.gradedAt }
          : null,
      };
    }),
  };
}

export const gradeSchema = z.object({
  marks: z.coerce.number().min(0, "Marks cannot be negative").max(1000),
  feedback: z.string().trim().max(2000).optional().nullable(),
});

export async function gradeSubmission(submissionId: string, input: z.infer<typeof gradeSchema>, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  const sub = await db.assignmentSubmission.findUnique({ where: { id: submissionId }, include: { assignment: true, student: { select: { name: true } } } });
  if (!sub) throw Errors.notFound("Submission");
  await assertBatchAccess(user, sub.assignment.batchId, "progress.update");
  if (input.marks > sub.assignment.maxMarks) throw Errors.validation("Please correct the highlighted fields.", { marks: `Marks cannot exceed ${sub.assignment.maxMarks}` });
  const updated = await db.assignmentSubmission.update({
    where: { id: submissionId },
    data: { marks: Math.round(input.marks), feedback: input.feedback || null, status: "GRADED", gradedById: user.id, gradedAt: new Date() },
  });
  const admission = await db.admission.findFirst({ where: { batchId: sub.assignment.batchId, studentId: sub.studentId }, select: { id: true } });
  if (admission) await recomputeProgress(admission.id).catch(() => undefined);
  await audit({ user: actor(user), action: "grade", module: "progress", recordType: "AssignmentSubmission", recordId: submissionId, description: `${user.name} graded ${sub.student.name}'s submission for "${sub.assignment.title}" (${updated.marks}/${sub.assignment.maxMarks})`, oldValue: { marks: sub.marks, status: sub.status }, newValue: { marks: updated.marks, feedback: updated.feedback }, ip: meta.ip, userAgent: meta.userAgent });
  return updated;
}

// ───────────────────────────── Assessments & results ─────────────────────────────

const assessmentFields = {
  title: z.string().trim().min(3, "Enter a title").max(200),
  type: z.enum(["QUIZ", "PRACTICAL", "MID_TERM", "FINAL", "OTHER"]).default("QUIZ"),
  date: optionalDay,
  maxMarks: z.coerce.number().int().min(1, "Max marks must be at least 1").max(1000).default(100),
  passingMarks: z.coerce.number().int().min(0).max(1000).default(40),
  weightage: z.coerce.number().int().min(1, "Weightage must be at least 1").max(100).default(1),
};
function checkPassing(d: { passingMarks: number; maxMarks: number }, ctx: z.RefinementCtx) {
  if (d.passingMarks > d.maxMarks) ctx.addIssue({ code: "custom", path: ["passingMarks"], message: "Passing marks cannot exceed max marks" });
}
export const assessmentSchema = z.object({ batchId: uuid, ...assessmentFields }).superRefine(checkPassing);
export type AssessmentInput = z.infer<typeof assessmentSchema>;
export const assessmentUpdateSchema = z.object(assessmentFields).superRefine(checkPassing);

export async function listAssessments(batchId: string) {
  const rows = await db.assessment.findMany({ where: { batchId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], include: { _count: { select: { results: true } } } });
  return rows.map((a) => ({ ...a, resultCount: a._count.results }));
}

export async function createAssessment(input: AssessmentInput, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  await assertBatchAccess(user, input.batchId, "progress.update");
  const batch = await db.batch.findFirst({ where: { id: input.batchId, deletedAt: null }, select: { code: true, status: true } });
  if (!batch) throw Errors.notFound("Batch");
  if (batch.status === "CANCELLED") throw Errors.badRequest("This batch is cancelled.");
  const a = await db.assessment.create({
    data: { batchId: input.batchId, title: input.title, type: input.type as AssessmentType, date: input.date, maxMarks: input.maxMarks, passingMarks: input.passingMarks, weightage: input.weightage, createdById: user.id },
  });
  await audit({ user: actor(user), action: "create_assessment", module: "progress", recordType: "Assessment", recordId: a.id, description: `${user.name} created assessment "${a.title}" for batch ${batch.code}`, newValue: a, ip: meta.ip, userAgent: meta.userAgent });
  return a;
}

export async function updateAssessment(id: string, input: z.infer<typeof assessmentUpdateSchema>, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  const existing = await db.assessment.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Assessment");
  await assertBatchAccess(user, existing.batchId, "progress.update");
  const a = await db.assessment.update({
    where: { id },
    data: { title: input.title, type: input.type as AssessmentType, date: input.date, maxMarks: input.maxMarks, passingMarks: input.passingMarks, weightage: input.weightage },
  });
  if (existing.maxMarks !== a.maxMarks || existing.passingMarks !== a.passingMarks) {
    // Grades depend on max/passing marks – refresh stored grades and progress.
    const results = await db.assessmentResult.findMany({ where: { assessmentId: id } });
    for (const r of results) {
      await db.assessmentResult.update({ where: { id: r.id }, data: { grade: gradeFor(toNumber(r.marks), a.maxMarks, a.passingMarks) } });
    }
    await syncBatchProgress(existing.batchId);
  } else if (existing.weightage !== a.weightage) {
    await syncBatchProgress(existing.batchId);
  }
  await audit({ user: actor(user), action: "update_assessment", module: "progress", recordType: "Assessment", recordId: id, description: `${user.name} updated assessment "${a.title}"`, oldValue: existing, newValue: a, ip: meta.ip, userAgent: meta.userAgent });
  return a;
}

export async function deleteAssessment(id: string, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  const existing = await db.assessment.findUnique({ where: { id }, include: { _count: { select: { results: true } } } });
  if (!existing) throw Errors.notFound("Assessment");
  await assertBatchAccess(user, existing.batchId, "progress.update");
  if (existing._count.results > 0) throw Errors.conflict("Results have been entered for this assessment. It cannot be deleted.");
  await db.assessment.delete({ where: { id } });
  await audit({ user: actor(user), action: "delete_assessment", module: "progress", recordType: "Assessment", recordId: id, description: `${user.name} deleted assessment "${existing.title}"`, oldValue: existing, ip: meta.ip, userAgent: meta.userAgent });
}

/** Grade scale lives in a client-safe module so the results grid can preview grades; re-exported for server callers. */
export { gradeFor };

/** Batch roster with existing results for an assessment. */
export async function assessmentResultsSheet(assessmentId: string, user: AuthUser) {
  const assessment = await db.assessment.findUnique({ where: { id: assessmentId }, include: { batch: { select: { id: true, code: true, name: true } } } });
  if (!assessment) throw Errors.notFound("Assessment");
  await assertBatchAccess(user, assessment.batchId, "progress.view");
  const [roster, results] = await Promise.all([
    db.admission.findMany({ where: { batchId: assessment.batchId, status: { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] } }, orderBy: { student: { name: "asc" } }, include: { student: { select: { id: true, name: true, studentId: true, photoUrl: true } } } }),
    db.assessmentResult.findMany({ where: { assessmentId } }),
  ]);
  const byStudent = new Map(results.map((r) => [r.studentId, r]));
  return {
    assessment,
    rows: roster.map((r) => {
      const res = byStudent.get(r.student.id);
      return { admissionId: r.id, student: r.student, admissionStatus: r.status, marks: res ? toNumber(res.marks) : null, grade: res?.grade ?? null, remarks: res?.remarks ?? null, evaluatedAt: res?.evaluatedAt ?? null };
    }),
  };
}

export const resultsSchema = z.object({
  results: z
    .array(
      z.object({
        studentId: uuid,
        marks: z.union([z.literal(""), z.null(), z.coerce.number().min(0, "Marks cannot be negative").max(10000)]).optional(),
        remarks: z.string().trim().max(500).optional().nullable(),
      })
    )
    .min(1)
    .max(500),
});

/** Upserts results (unique assessmentId+studentId); empty marks clears a previously entered result. */
export async function enterAssessmentResults(assessmentId: string, input: z.infer<typeof resultsSchema>, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  const assessment = await db.assessment.findUnique({ where: { id: assessmentId }, include: { batch: { select: { code: true } } } });
  if (!assessment) throw Errors.notFound("Assessment");
  await assertBatchAccess(user, assessment.batchId, "progress.update");
  const roster = await db.admission.findMany({ where: { batchId: assessment.batchId, status: { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] } }, select: { id: true, studentId: true } });
  const admissionByStudent = new Map(roster.map((r) => [r.studentId, r.id]));

  const details: Record<string, string> = {};
  input.results.forEach((r, i) => {
    if (typeof r.marks === "number" && r.marks > assessment.maxMarks) details[`results.${i}.marks`] = `Max ${assessment.maxMarks}`;
  });
  if (Object.keys(details).length) throw Errors.validation("Some marks exceed the maximum.", details);

  let saved = 0;
  let cleared = 0;
  const touched: string[] = [];
  await db.$transaction(async (tx) => {
    for (const r of input.results) {
      const admissionId = admissionByStudent.get(r.studentId);
      if (!admissionId) continue;
      touched.push(admissionId);
      if (typeof r.marks !== "number") {
        const del = await tx.assessmentResult.deleteMany({ where: { assessmentId, studentId: r.studentId } });
        cleared += del.count;
        continue;
      }
      await tx.assessmentResult.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId: r.studentId } },
        create: { assessmentId, studentId: r.studentId, marks: r.marks, grade: gradeFor(r.marks, assessment.maxMarks, assessment.passingMarks), remarks: r.remarks || null, evaluatedById: user.id, evaluatedAt: new Date() },
        update: { marks: r.marks, grade: gradeFor(r.marks, assessment.maxMarks, assessment.passingMarks), remarks: r.remarks || null, evaluatedById: user.id, evaluatedAt: new Date() },
      });
      saved++;
    }
  });
  for (const admissionId of touched) await recomputeProgress(admissionId).catch(() => undefined);
  await audit({ user: actor(user), action: "enter_results", module: "progress", recordType: "Assessment", recordId: assessmentId, description: `${user.name} entered results for "${assessment.title}" (batch ${assessment.batch.code}): ${saved} saved${cleared ? `, ${cleared} cleared` : ""}`, ip: meta.ip, userAgent: meta.userAgent });
  return { saved, cleared };
}

// ───────────────────────────── Study materials ─────────────────────────────

export const materialSchema = z.object({
  batchId: uuid,
  title: z.string().trim().min(3, "Enter a title").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
});

/** Query string for GET /api/trainer/materials: paged (default 30 per page, "Load more" on phones) with an optional batch filter. */
export const materialsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  batchId: uuid.optional(),
});
export type MaterialsQuery = z.infer<typeof materialsQuery>;

const materialInclude = { batch: { select: { id: true, code: true, name: true } }, course: { select: { id: true, name: true } } } satisfies Prisma.StudyMaterialInclude;
export type MaterialListItem = Prisma.StudyMaterialGetPayload<{ include: typeof materialInclude }>;

/**
 * Study materials of the given batches (optionally only those uploaded by one user / one batch), newest first,
 * as a `{ items, meta }` page. A `batchId` outside `batchIds` yields an empty page rather than leaking data.
 */
export async function listMaterials(opts: { batchIds: string[]; uploadedById?: string; batchId?: string; page?: number; limit?: number }) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 30;
  const paging = { page, limit };
  const batchIds = opts.batchId ? opts.batchIds.filter((id) => id === opts.batchId) : opts.batchIds;
  if (batchIds.length === 0) return paged([] as MaterialListItem[], 0, paging);
  const where: Prisma.StudyMaterialWhereInput = { batchId: { in: batchIds }, ...(opts.uploadedById ? { uploadedById: opts.uploadedById } : {}) };
  const [items, total] = await Promise.all([
    db.studyMaterial.findMany({ where, orderBy: { createdAt: "desc" }, include: materialInclude, ...getPaging(paging) }),
    db.studyMaterial.count({ where }),
  ]);
  return paged(items, total, paging);
}

export async function createMaterial(input: z.infer<typeof materialSchema>, file: StoredFile, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  await assertBatchAccess(user, input.batchId, "progress.update");
  const batch = await db.batch.findFirst({ where: { id: input.batchId, deletedAt: null }, select: { code: true, courseId: true } });
  if (!batch) throw Errors.notFound("Batch");
  const m = await db.studyMaterial.create({
    data: { batchId: input.batchId, courseId: batch.courseId, title: input.title, description: input.description || null, fileUrl: file.url, fileType: file.name.split(".").pop()?.toLowerCase() ?? null, uploadedById: user.id },
  });
  await audit({ user: actor(user), action: "upload_material", module: "progress", recordType: "StudyMaterial", recordId: m.id, description: `${user.name} uploaded study material "${m.title}" for batch ${batch.code}`, newValue: m, ip: meta.ip, userAgent: meta.userAgent });
  return m;
}

/** Trainers may only delete their own uploads. */
export async function deleteMaterial(id: string, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  const m = await db.studyMaterial.findUnique({ where: { id } });
  if (!m) throw Errors.notFound("Study material");
  if (user.role === "TRAINER") {
    if (m.uploadedById !== user.id) throw Errors.forbidden("You can only delete materials you uploaded.");
    if (m.batchId) await assertBatchAccess(user, m.batchId, "progress.update");
  }
  await db.studyMaterial.delete({ where: { id } });
  const key = keyFromUrl(m.fileUrl);
  if (key && key.startsWith("private/materials/")) await deleteStoredFile(key).catch(() => undefined);
  await audit({ user: actor(user), action: "delete_material", module: "progress", recordType: "StudyMaterial", recordId: id, description: `${user.name} deleted study material "${m.title}"`, oldValue: m, ip: meta.ip, userAgent: meta.userAgent });
}

// ───────────────────────────── Announcements (batch-level, by trainers) ─────────────────────────────

export const batchAnnouncementSchema = z.object({
  batchId: uuid,
  title: z.string().trim().min(3, "Enter a title").max(200),
  body: z.string().trim().min(5, "Write the announcement").max(5000),
});

export async function createBatchAnnouncement(input: z.infer<typeof batchAnnouncementSchema>, user: AuthUser, meta: Omit<Ctx, "user"> = {}) {
  await assertBatchAccess(user, input.batchId, "attendance.view");
  const batch = await db.batch.findFirst({ where: { id: input.batchId, deletedAt: null }, select: { id: true, code: true, name: true, centerId: true } });
  if (!batch) throw Errors.notFound("Batch");
  const a = await db.announcement.create({ data: { title: input.title, body: input.body, audience: "BATCH", batchId: batch.id, centerId: batch.centerId, isPublished: true, createdById: user.id } });
  const admissions = await db.admission.findMany({ where: { batchId: batch.id, status: { in: ["ACTIVE", "ON_HOLD"] } }, include: { student: { select: { userId: true, email: true, mobile: true, user: { select: { email: true, mobile: true } } } } } });
  for (const adm of admissions) {
    await notify({ userId: adm.student.userId, email: adm.student.user.email ?? adm.student.email, mobile: adm.student.user.mobile ?? adm.student.mobile, event: "ANNOUNCEMENT", data: { title: a.title, body: a.body, batch: batch.name } });
  }
  await audit({ user: actor(user), action: "announce", module: "attendance", recordType: "Announcement", recordId: a.id, description: `${user.name} announced "${a.title}" to batch ${batch.code} (${admissions.length} students notified)`, newValue: a, ip: meta.ip, userAgent: meta.userAgent });
  return { ...a, notified: admissions.length };
}

// ───────────────────────────── helpers ─────────────────────────────

async function syncBatchProgress(batchId: string) {
  const admissions = await db.admission.findMany({ where: { batchId, status: { in: ["ACTIVE", "ON_HOLD", "COMPLETED"] } }, select: { id: true } });
  for (const a of admissions) await recomputeProgress(a.id).catch(() => undefined);
}
