import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { generateStudentId } from "@/lib/ids";
import type { StoredFile } from "@/lib/storage";
import { toNumber } from "@/lib/utils";
import type { StudentProfileInput } from "@/lib/validation/students";
import { normalizeEmail, normalizeMobile } from "@/server/auth";
import { reconsiderAfterDocuments } from "@/server/applications";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

export async function getStudentProfile(studentId: string) {
  const s = await db.student.findUnique({ where: { id: studentId }, include: { user: { select: { id: true, name: true, email: true, mobile: true, avatarUrl: true } }, state: true, district: true, block: true, documents: { orderBy: { createdAt: "desc" } } } });
  if (!s) throw Errors.notFound("Student");
  return s;
}

export async function updateStudentProfile(studentId: string, input: StudentProfileInput, actor: AuditActor, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const student = await db.student.findUnique({ where: { id: studentId }, include: { user: true } });
  if (!student) throw Errors.notFound("Student");
  const block = await db.block.findFirst({ where: { id: input.blockId, districtId: input.districtId, district: { stateId: input.stateId } } });
  if (!block) throw Errors.validation("Please correct the highlighted fields.", { blockId: "Block must belong to the selected district and state" });
  const mobile = normalizeMobile(input.mobile);
  const email = input.email ? normalizeEmail(input.email) : null;
  const clash = await db.user.findFirst({ where: { id: { not: student.userId }, OR: [{ mobile }, ...(email ? [{ email }] : [])] }, select: { mobile: true, email: true } });
  if (clash) {
    const details: Record<string, string> = {};
    if (clash.mobile === mobile) details.mobile = "This mobile number is used by another account";
    if (email && clash.email === email) details.email = "This email is used by another account";
    throw Errors.validation("Please correct the highlighted fields.", details);
  }
  const updated = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: student.userId }, data: { name: input.name, mobile, email, avatarUrl: input.photoUrl ?? student.user.avatarUrl } });
    return tx.student.update({
      where: { id: studentId },
      data: {
        name: input.name,
        guardianName: input.guardianName,
        guardianRelation: input.guardianRelation,
        dob: input.dob,
        gender: input.gender,
        mobile,
        whatsapp: input.whatsapp ? normalizeMobile(input.whatsapp) : mobile,
        email,
        photoUrl: input.photoUrl ?? student.photoUrl,
        stateId: input.stateId,
        districtId: input.districtId,
        blockId: input.blockId,
        villageTown: input.villageTown,
        address: input.address,
        pincode: input.pincode,
        qualification: input.qualification,
        institution: input.institution ?? null,
        passingYear: input.passingYear ?? null,
        familyIncome: input.familyIncome ?? null,
        occupation: input.occupation ?? null,
        areaType: input.areaType ?? null,
        trainingRequirement: input.trainingRequirement ?? null,
        scholarshipRequired: !!input.scholarshipRequired,
        profileCompleted: true,
      },
    });
  });
  await audit({ user: actor, action: "update_profile", module: "students", recordType: "Student", recordId: studentId, description: `${actor.name} updated student profile of ${updated.name}`, ip: meta.ip, userAgent: meta.userAgent });
  return updated;
}

export async function uploadStudentDocument(studentId: string, type: string, file: StoredFile, applicationId?: string | null) {
  const docType = await db.documentType.findFirst({ where: { key: type, appliesTo: "STUDENT", isActive: true } });
  if (!docType) throw Errors.badRequest("Unknown document type");
  // Replace an earlier pending/rejected upload of the same type.
  await db.studentDocument.deleteMany({ where: { studentId, type, status: { in: ["PENDING", "REJECTED"] } } });
  const doc = await db.studentDocument.create({ data: { studentId, applicationId: applicationId ?? null, type, name: file.name, url: file.url, mimeType: file.mimeType, size: file.size } });
  if (type === "photo") await db.student.update({ where: { id: studentId }, data: { photoUrl: file.url } });
  await reconsiderAfterDocuments(studentId);
  return doc;
}

export async function deleteStudentDocument(studentId: string, docId: string) {
  const doc = await db.studentDocument.findFirst({ where: { id: docId, studentId } });
  if (!doc) throw Errors.notFound("Document");
  if (doc.status === "VERIFIED") throw Errors.badRequest("Verified documents cannot be removed.");
  await db.studentDocument.delete({ where: { id: docId } });
}

export async function verifyStudentDocument(docId: string, status: "VERIFIED" | "REJECTED", remarks: string | null | undefined, ctx: Ctx) {
  const doc = await db.studentDocument.findUnique({ where: { id: docId }, include: { student: { select: { name: true } } } });
  if (!doc) throw Errors.notFound("Document");
  const updated = await db.studentDocument.update({ where: { id: docId }, data: { status, remarks: remarks ?? null, verifiedById: ctx.user.id, verifiedAt: new Date() } });
  await audit({ user: ctx.user, action: status === "VERIFIED" ? "verify_document" : "reject_document", module: "students", recordType: "StudentDocument", recordId: docId, description: `${ctx.user.name} ${status.toLowerCase()} document "${doc.name}" of ${doc.student.name}`, newValue: { status, remarks }, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}

export async function ensureStudentId(studentId: string, ctx: Ctx) {
  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) throw Errors.notFound("Student");
  if (student.studentId) return student.studentId;
  const code = await db.$transaction(async (tx) => {
    const c = await generateStudentId(tx);
    await tx.student.update({ where: { id: studentId }, data: { studentId: c } });
    return c;
  });
  await audit({ user: ctx.user, action: "generate_id", module: "students", recordType: "Student", recordId: studentId, description: `${ctx.user.name} generated Student ID ${code} for ${student.name}`, ip: ctx.ip, userAgent: ctx.userAgent });
  return code;
}

/** Everything the student dashboard needs in one call. */
export async function getStudentDashboard(studentId: string) {
  const student = await getStudentProfile(studentId);
  const [applications, admissions, payments, certificates, notifications] = await Promise.all([
    db.application.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, include: { course: { select: { name: true, slug: true } }, center: { select: { name: true, code: true } }, batch: { select: { name: true, code: true } } } }),
    db.admission.findMany({
      where: { studentId },
      orderBy: { admittedAt: "desc" },
      include: {
        course: { select: { id: true, name: true, slug: true, totalClasses: true, minAttendancePct: true } },
        center: { select: { id: true, name: true, code: true, address: true, phone: true } },
        batch: { include: { trainer: { include: { user: { select: { name: true, mobile: true } } } } } },
        progress: true,
        certificate: { select: { id: true, certificateNo: true, status: true, issuedAt: true } },
      },
    }),
    db.payment.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 10, include: { application: { select: { applicationNo: true, course: { select: { name: true } } } } } }),
    db.certificate.findMany({ where: { studentId }, orderBy: { issuedAt: "desc" } }),
    db.notification.findMany({ where: { userId: student.userId, channel: "IN_APP" }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const unread = await db.notification.count({ where: { userId: student.userId, channel: "IN_APP", readAt: null } });
  return {
    student,
    applications: applications.map((a) => ({ ...a, originalFee: toNumber(a.originalFee), scholarshipAmount: toNumber(a.scholarshipAmount), discountAmount: toNumber(a.discountAmount), payableAmount: toNumber(a.payableAmount), paidAmount: toNumber(a.paidAmount) })),
    admissions: admissions.map((a) => ({ ...a, progress: a.progress ? { ...a.progress, attendancePct: toNumber(a.progress.attendancePct), assessmentAvgPct: toNumber(a.progress.assessmentAvgPct), finalMarksPct: a.progress.finalMarksPct === null ? null : toNumber(a.progress.finalMarksPct), completionPct: toNumber(a.progress.completionPct) } : null })),
    payments: payments.map((p) => ({ ...p, amount: toNumber(p.amount) })),
    certificates,
    notifications,
    unread,
  };
}

// ───────────────────────────── Admin ─────────────────────────────

export const studentListSchema = paginationSchema.extend({
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  centerId: optionalUuid,
  courseId: optionalUuid,
  batchId: optionalUuid,
  status: z.enum(["registered", "applied", "admitted", "completed", "incomplete_profile"]).optional(),
  from: optionalDate,
  to: optionalDate,
});

export async function listStudents(q: z.infer<typeof studentListSchema>) {
  const where: Prisma.StudentWhereInput = { deletedAt: null };
  if (q.stateId) where.stateId = q.stateId;
  if (q.districtId) where.districtId = q.districtId;
  if (q.blockId) where.blockId = q.blockId;
  if (q.centerId || q.courseId || q.batchId) where.admissions = { some: { centerId: q.centerId, courseId: q.courseId, batchId: q.batchId } };
  if (q.status === "admitted") where.admissions = { some: { status: { in: ["ACTIVE", "ON_HOLD"] } } };
  if (q.status === "completed") where.admissions = { some: { status: "COMPLETED" } };
  if (q.status === "applied") where.applications = { some: {} };
  if (q.status === "registered") where.applications = { none: {} };
  if (q.status === "incomplete_profile") where.profileCompleted = false;
  if (q.from || q.to) where.createdAt = { gte: q.from, lt: q.to };
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { studentId: { contains: q.q, mode: "insensitive" } }, { mobile: { contains: q.q } }, { email: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "name", "studentId"] as const, "createdAt");
  const [items, total] = await Promise.all([
    db.student.findMany({ where, orderBy, ...getPaging(q), include: { state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } }, user: { select: { status: true, lastLoginAt: true } }, _count: { select: { applications: true, admissions: true, certificates: true } } } }),
    db.student.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getStudentAdmin(id: string) {
  const s = await db.student.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, mobile: true, status: true, lastLoginAt: true, createdAt: true } },
      state: true,
      district: true,
      block: true,
      documents: { orderBy: { createdAt: "desc" } },
      applications: { orderBy: { createdAt: "desc" }, include: { course: { select: { name: true } }, center: { select: { name: true, code: true } }, batch: { select: { name: true, code: true } } } },
      admissions: { orderBy: { admittedAt: "desc" }, include: { course: { select: { name: true } }, center: { select: { name: true, code: true } }, batch: { select: { id: true, name: true, code: true, status: true } }, trainer: { include: { user: { select: { name: true } } } }, progress: true, certificate: true } },
      payments: { orderBy: { createdAt: "desc" }, include: { application: { select: { applicationNo: true } } } },
      certificates: { orderBy: { issuedAt: "desc" } },
    },
  });
  if (!s) throw Errors.notFound("Student");
  return {
    ...s,
    applications: s.applications.map((a) => ({ ...a, originalFee: toNumber(a.originalFee), scholarshipAmount: toNumber(a.scholarshipAmount), payableAmount: toNumber(a.payableAmount), paidAmount: toNumber(a.paidAmount) })),
    payments: s.payments.map((p) => ({ ...p, amount: toNumber(p.amount) })),
    admissions: s.admissions.map((a) => ({ ...a, progress: a.progress ? { ...a.progress, attendancePct: toNumber(a.progress.attendancePct), assessmentAvgPct: toNumber(a.progress.assessmentAvgPct), completionPct: toNumber(a.progress.completionPct) } : null })),
  };
}

export async function adminUpdateStudent(id: string, input: Partial<StudentProfileInput> & { status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" }, ctx: Ctx) {
  const student = await db.student.findFirst({ where: { id, deletedAt: null }, include: { user: true } });
  if (!student) throw Errors.notFound("Student");
  const data: Prisma.StudentUpdateInput = {};
  for (const k of ["name", "guardianName", "guardianRelation", "gender", "villageTown", "address", "pincode", "qualification", "institution", "passingYear", "familyIncome", "occupation", "areaType", "trainingRequirement", "scholarshipRequired", "photoUrl"] as const) {
    if (input[k] !== undefined) (data as Record<string, unknown>)[k] = input[k];
  }
  if (input.dob) data.dob = input.dob;
  if (input.stateId) data.state = { connect: { id: input.stateId } };
  if (input.districtId) data.district = { connect: { id: input.districtId } };
  if (input.blockId) data.block = { connect: { id: input.blockId } };
  if (input.mobile) data.mobile = normalizeMobile(input.mobile);
  if (input.email !== undefined) data.email = input.email ? normalizeEmail(input.email) : null;
  const updated = await db.$transaction(async (tx) => {
    const st = await tx.student.update({ where: { id }, data });
    await tx.user.update({ where: { id: student.userId }, data: { name: input.name ?? undefined, mobile: input.mobile ? normalizeMobile(input.mobile) : undefined, email: input.email === undefined ? undefined : input.email ? normalizeEmail(input.email) : null, status: input.status } });
    return st;
  });
  await audit({ user: ctx.user, action: "update", module: "students", recordType: "Student", recordId: id, description: `${ctx.user.name} updated student ${student.name}`, oldValue: student, newValue: updated, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}
