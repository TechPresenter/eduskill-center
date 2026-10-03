import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { generateStudentId } from "@/lib/ids";
import type { StoredFile } from "@/lib/storage";
import { toNumber } from "@/lib/utils";
import type { AdminStudentUpdateInput, StudentProfileInput } from "@/lib/validation/students";
import { normalizeEmail, normalizeMobile } from "@/server/auth";
import { mobileVariants, samePhone } from "@/lib/phone";
import { reconsiderAfterDocuments } from "@/server/applications";
import { resolveBlockId } from "@/server/locations";
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
  const district = await db.district.findFirst({ where: { id: input.districtId, stateId: input.stateId }, select: { id: true } });
  if (!district) throw Errors.validation("Please correct the highlighted fields.", { districtId: "District must belong to the selected state" });
  const mobile = normalizeMobile(input.mobile);
  const email = input.email ? normalizeEmail(input.email) : null;
  // Every stored spelling, or this check misses an older row and the save hits the DB unique instead.
  const clash = await db.user.findFirst({ where: { id: { not: student.userId }, OR: [{ mobile: { in: mobileVariants(mobile) } }, ...(email ? [{ email }] : [])] }, select: { mobile: true, email: true } });
  if (clash) {
    const details: Record<string, string> = {};
    if (samePhone(clash.mobile, mobile)) details.mobile = "This mobile number is used by another account";
    if (email && clash.email === email) details.email = "This email is used by another account";
    throw Errors.validation("Please correct the highlighted fields.", details);
  }
  // The block picked from the district's list, or typed — found in the district case-insensitively
  // or added to it. Last of the checks, so a refused save adds no block; before the transaction, as
  // resolveBlockId requires.
  const blockId = await resolveBlockId({ districtId: district.id, blockId: input.blockId, blockName: input.blockName }, { source: "the student profile form" });
  if (!blockId) throw Errors.validation("Please correct the highlighted fields.", { blockId: "Select or type your block" });
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
        districtId: district.id,
        blockId,
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

/**
 * Where a staff edit leaves the student, or null when it does not move them. The district must be
 * in the state. A block sent with the edit — picked (`blockId`, which must be in the district) or
 * typed (`blockName`, found in the district or added to it, see resolveBlockId) — wins; otherwise the
 * student keeps their block, which must still be in the (possibly changed) district. Runs before any
 * transaction, as resolveBlockId requires.
 */
async function editedLocation(
  existing: { stateId: string | null; districtId: string | null; blockId: string | null },
  input: { stateId?: string; districtId?: string; blockId?: string; blockName?: string }
) {
  const blockGiven = !!(input.blockId || input.blockName);
  const moved = (input.stateId && input.stateId !== existing.stateId) || (input.districtId && input.districtId !== existing.districtId);
  if (!moved && !blockGiven) return null;
  const invalid = (field: "stateId" | "districtId" | "blockId", message: string) => Errors.validation("Please correct the highlighted fields.", { [field]: message });
  const stateId = input.stateId || existing.stateId;
  const districtId = input.districtId || existing.districtId;
  if (!stateId) throw invalid("stateId", "Select a state");
  if (!districtId) {
    if (blockGiven) throw invalid("districtId", "Select a district");
    return { stateId, districtId: null, blockId: null };
  }
  const district = await db.district.findFirst({ where: { id: districtId, stateId }, select: { id: true } });
  if (!district) throw invalid("districtId", "District must belong to the selected state");
  if (blockGiven) {
    const blockId = await resolveBlockId({ districtId, blockId: input.blockId, blockName: input.blockName }, { source: "the admin student form" });
    return { stateId, districtId, blockId };
  }
  if (existing.blockId && !(await db.block.findFirst({ where: { id: existing.blockId, districtId }, select: { id: true } }))) {
    throw invalid("blockId", "Select or type the block in the chosen district");
  }
  return { stateId, districtId, blockId: existing.blockId };
}

export async function adminUpdateStudent(id: string, input: AdminStudentUpdateInput, ctx: Ctx) {
  const student = await db.student.findFirst({ where: { id, deletedAt: null }, include: { user: true } });
  if (!student) throw Errors.notFound("Student");
  const loc = await editedLocation(student, input);
  const data: Prisma.StudentUpdateInput = {};
  for (const k of ["name", "guardianName", "guardianRelation", "gender", "villageTown", "address", "pincode", "qualification", "institution", "passingYear", "familyIncome", "occupation", "areaType", "trainingRequirement", "scholarshipRequired", "photoUrl"] as const) {
    if (input[k] !== undefined) (data as Record<string, unknown>)[k] = input[k];
  }
  if (input.dob) data.dob = input.dob;
  if (loc) {
    data.state = { connect: { id: loc.stateId } };
    data.district = loc.districtId ? { connect: { id: loc.districtId } } : { disconnect: true };
    data.block = loc.blockId ? { connect: { id: loc.blockId } } : { disconnect: true };
  }
  if (input.mobile) data.mobile = normalizeMobile(input.mobile);
  if (input.whatsapp !== undefined) data.whatsapp = input.whatsapp ? normalizeMobile(input.whatsapp) : null;
  if (input.email !== undefined) data.email = input.email ? normalizeEmail(input.email) : null;
  const updated = await db.$transaction(async (tx) => {
    const st = await tx.student.update({ where: { id }, data });
    await tx.user.update({ where: { id: student.userId }, data: { name: input.name ?? undefined, mobile: input.mobile ? normalizeMobile(input.mobile) : undefined, email: input.email === undefined ? undefined : input.email ? normalizeEmail(input.email) : null, status: input.status } });
    return st;
  });
  await audit({ user: ctx.user, action: "update", module: "students", recordType: "Student", recordId: id, description: `${ctx.user.name} updated student ${student.name}`, oldValue: student, newValue: updated, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}
