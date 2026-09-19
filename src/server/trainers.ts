import { randomBytes } from "node:crypto";
import { db, type Prisma } from "@/lib/db";
import type { TrainerApplicationStatus, TrainerLevel, TrainerStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify, notifyStaff } from "@/lib/notifications";
import { generateTrainerApplicationNo, generateTrainerId } from "@/lib/ids";
import { getSetting } from "@/lib/settings";
import { hashPassword } from "@/lib/auth/password";
import { titleCase } from "@/lib/utils";
import { normalizeEmail, normalizeMobile } from "@/server/auth";
import type { StoredFile } from "@/lib/storage";
import type { TrainerApplicationInput } from "@/lib/validation/trainers";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

export const TRAINER_TRANSITIONS: Record<TrainerApplicationStatus, TrainerApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["DOCUMENTS_REQUIRED", "SHORTLISTED", "VERIFIED", "REJECTED"],
  DOCUMENTS_REQUIRED: ["UNDER_REVIEW", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "VERIFIED", "REJECTED"],
  INTERVIEW: ["VERIFIED", "SHORTLISTED", "REJECTED"],
  VERIFIED: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: ["UNDER_REVIEW"],
};

/** Location requirement per volunteer level. Returns normalised ids (extra ids are dropped). */
export async function resolveTrainerLocation(level: TrainerLevel, ids: { stateId: string; districtId?: string | null; blockId?: string | null }) {
  const state = await db.state.findFirst({ where: { id: ids.stateId, isActive: true } });
  if (!state) throw Errors.validation("Please correct the highlighted fields.", { stateId: "Select a valid state" });
  let districtId: string | null = null;
  let blockId: string | null = null;
  if (level === "DISTRICT" || level === "BLOCK") {
    if (!ids.districtId) throw Errors.validation("Please correct the highlighted fields.", { districtId: "District is required" });
    const district = await db.district.findFirst({ where: { id: ids.districtId, stateId: state.id, isActive: true } });
    if (!district) throw Errors.validation("Please correct the highlighted fields.", { districtId: "Select a district within the chosen state" });
    districtId = district.id;
  }
  if (level === "BLOCK") {
    if (!ids.blockId) throw Errors.validation("Please correct the highlighted fields.", { blockId: "Block is required" });
    const block = await db.block.findFirst({ where: { id: ids.blockId, districtId: districtId!, isActive: true } });
    if (!block) throw Errors.validation("Please correct the highlighted fields.", { blockId: "Select a block within the chosen district" });
    blockId = block.id;
  }
  return { stateId: state.id, districtId, blockId };
}

// ───────────────────────────── Public: apply & track ─────────────────────────────

export async function submitTrainerApplication(input: TrainerApplicationInput, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  if (!(await getSetting<boolean>("admissions.trainerApplicationsOpen"))) throw Errors.forbidden("Volunteer trainer applications are currently closed.");
  const loc = await resolveTrainerLocation(input.level, input);
  const email = normalizeEmail(input.email);
  const mobile = normalizeMobile(input.mobile);

  const existingTrainer = await db.trainer.findFirst({ where: { user: { OR: [{ email }, { mobile }] }, deletedAt: null } });
  if (existingTrainer) throw Errors.conflict("You are already a registered EduSkill trainer. Please log in.");
  const open = await db.trainerApplication.findFirst({ where: { OR: [{ email }, { mobile }], status: { notIn: ["REJECTED"] } }, select: { applicationNo: true, status: true } });
  if (open) throw Errors.conflict(`An application (${open.applicationNo}) already exists for this email/mobile and is ${titleCase(open.status)}. Track it from the application status page.`);

  const app = await db.$transaction(async (tx) => {
    const applicationNo = await generateTrainerApplicationNo(tx);
    return tx.trainerApplication.create({
      data: {
        applicationNo,
        name: input.name,
        photoUrl: input.photoUrl ?? null,
        mobile,
        whatsapp: input.whatsapp ? normalizeMobile(input.whatsapp) : mobile,
        email,
        dob: input.dob,
        gender: input.gender,
        level: input.level,
        stateId: loc.stateId,
        districtId: loc.districtId,
        blockId: loc.blockId,
        address: input.address,
        pincode: input.pincode,
        qualification: input.qualification,
        skills: input.skills,
        experienceYears: input.experienceYears,
        teachingExperienceYears: input.teachingExperienceYears,
        preferredCourseIds: input.preferredCourseIds,
        languages: input.languages,
        availability: input.availability ?? null,
        trainingMode: input.trainingMode,
        motivation: input.motivation,
        status: "SUBMITTED",
        statusHistory: { create: [{ toStatus: "SUBMITTED" }] },
      },
    });
  });
  await db.analyticsEvent.create({ data: { type: "TRAINER_APPLICATION_STARTED", refId: app.id, ipHash: meta.ip ?? null } }).catch(() => undefined);
  await audit({ user: null, action: "submit", module: "trainers", recordType: "TrainerApplication", recordId: app.id, description: `Volunteer trainer application ${app.applicationNo} submitted by ${app.name} (${titleCase(app.level)} level)`, ip: meta.ip, userAgent: meta.userAgent });
  await notify({ email, mobile, event: "TRAINER_APPLICATION_SUBMITTED", data: { name: app.name, applicationNo: app.applicationNo, level: `${titleCase(app.level)}` }, channels: undefined });
  await notifyStaff({
    permission: "trainers.view",
    title: `New volunteer trainer application ${app.applicationNo}`,
    body: `${app.name} applied as a ${titleCase(app.level)} level volunteer trainer.\nMobile: ${mobile}\nEmail: ${email}`,
    path: `/admin/trainer-applications/${app.id}`,
  });
  return { id: app.id, applicationNo: app.applicationNo };
}

export async function attachTrainerDocument(applicationId: string, type: string, file: StoredFile) {
  const app = await db.trainerApplication.findUnique({ where: { id: applicationId }, select: { id: true, status: true } });
  if (!app) throw Errors.notFound("Application");
  const docType = await db.documentType.findFirst({ where: { key: type, appliesTo: "TRAINER", isActive: true } });
  if (!docType) throw Errors.badRequest("Unknown document type");
  const doc = await db.trainerDocument.create({ data: { applicationId, type, name: file.name, url: file.url, mimeType: file.mimeType, size: file.size } });
  if (app.status === "DOCUMENTS_REQUIRED") {
    await db.$transaction([
      db.trainerApplication.update({ where: { id: applicationId }, data: { status: "UNDER_REVIEW" } }),
      db.trainerApplicationStatusHistory.create({ data: { applicationId, fromStatus: "DOCUMENTS_REQUIRED", toStatus: "UNDER_REVIEW", note: "Documents uploaded by applicant" } }),
    ]);
  }
  return doc;
}

/** Public status lookup by application number + registered mobile. */
export async function lookupTrainerApplication(applicationNo: string, mobile: string) {
  const app = await db.trainerApplication.findFirst({
    where: { applicationNo: applicationNo.trim().toUpperCase(), mobile: normalizeMobile(mobile) },
    include: { state: true, district: true, block: true, documents: { select: { id: true, type: true, name: true, status: true, remarks: true, createdAt: true } }, statusHistory: { orderBy: { createdAt: "asc" }, select: { toStatus: true, note: true, createdAt: true } }, trainer: { select: { trainerId: true } } },
  });
  if (!app) throw Errors.notFound("Application");
  return {
    id: app.id,
    applicationNo: app.applicationNo,
    name: app.name,
    level: app.level,
    status: app.status,
    submittedAt: app.submittedAt,
    location: [app.block?.name, app.district?.name, app.state.name].filter(Boolean).join(", "),
    interviewAt: app.interviewAt,
    interviewMode: app.interviewMode,
    reviewNotes: app.status === "DOCUMENTS_REQUIRED" ? app.reviewNotes : null,
    rejectionReason: app.status === "REJECTED" ? app.rejectionReason : null,
    trainerId: app.trainer?.trainerId ?? null,
    documents: app.documents,
    statusHistory: app.statusHistory,
  };
}

// ───────────────────────────── Admin: review ─────────────────────────────

async function load(id: string) {
  const app = await db.trainerApplication.findUnique({ where: { id }, include: { state: true, district: true, block: true } });
  if (!app) throw Errors.notFound("Trainer application");
  return app;
}

export async function transitionTrainerApplication(
  id: string,
  input: { to: TrainerApplicationStatus; note?: string | null; interviewAt?: Date | null; interviewMode?: string | null },
  ctx: Ctx
) {
  const app = await load(id);
  if (input.to === "APPROVED") throw Errors.badRequest("Use the approve action to approve an application.");
  if (!TRAINER_TRANSITIONS[app.status].includes(input.to)) throw Errors.badRequest(`Cannot move from "${titleCase(app.status)}" to "${titleCase(input.to)}".`);
  if (input.to === "INTERVIEW" && !input.interviewAt) throw Errors.validation("Please correct the highlighted fields.", { interviewAt: "Interview date & time is required" });
  if (input.to === "DOCUMENTS_REQUIRED" && !input.note) throw Errors.validation("Please correct the highlighted fields.", { note: "Describe which documents are required" });
  if (input.to === "REJECTED" && !input.note) throw Errors.validation("Please correct the highlighted fields.", { note: "Provide a reason" });

  await db.$transaction([
    db.trainerApplication.update({
      where: { id },
      data: {
        status: input.to,
        reviewedById: ctx.user.id,
        reviewNotes: input.note ?? app.reviewNotes,
        rejectionReason: input.to === "REJECTED" ? input.note : app.rejectionReason,
        interviewAt: input.to === "INTERVIEW" ? input.interviewAt : app.interviewAt,
        interviewMode: input.to === "INTERVIEW" ? (input.interviewMode ?? app.interviewMode) : app.interviewMode,
        interviewNotes: input.to === "VERIFIED" && app.status === "INTERVIEW" ? (input.note ?? app.interviewNotes) : app.interviewNotes,
      },
    }),
    db.trainerApplicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: input.to, note: input.note ?? null, changedById: ctx.user.id } }),
  ]);
  await audit({ user: ctx.user, action: input.to.toLowerCase(), module: "trainers", recordType: "TrainerApplication", recordId: id, description: `${ctx.user.name} moved trainer application ${app.applicationNo} to ${titleCase(input.to)}`, oldValue: { status: app.status }, newValue: { status: input.to, note: input.note, interviewAt: input.interviewAt }, ip: ctx.ip, userAgent: ctx.userAgent });

  const statusText = input.to === "INTERVIEW" && input.interviewAt ? `Interview scheduled on ${input.interviewAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${input.interviewMode ? ` (${input.interviewMode})` : ""}` : titleCase(input.to);
  await notify({ userId: app.userId, email: app.email, mobile: app.mobile, event: "TRAINER_APPLICATION_STATUS", data: { name: app.name, applicationNo: app.applicationNo, status: statusText, note: input.note ?? "" } });
}

export async function addTrainerApplicationNote(id: string, note: string, ctx: Ctx) {
  const app = await load(id);
  await db.trainerApplicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: app.status, note, changedById: ctx.user.id } });
  await audit({ user: ctx.user, action: "note", module: "trainers", recordType: "TrainerApplication", recordId: id, description: `${ctx.user.name} added a note on trainer application ${app.applicationNo}`, newValue: { note }, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function verifyTrainerDocument(docId: string, status: "VERIFIED" | "REJECTED", remarks: string | null | undefined, ctx: Ctx) {
  const doc = await db.trainerDocument.findUnique({ where: { id: docId } });
  if (!doc) throw Errors.notFound("Document");
  const updated = await db.trainerDocument.update({ where: { id: docId }, data: { status, remarks: remarks ?? null, verifiedById: ctx.user.id, verifiedAt: new Date() } });
  await audit({ user: ctx.user, action: status === "VERIFIED" ? "verify_document" : "reject_document", module: "trainers", recordType: "TrainerDocument", recordId: docId, description: `${ctx.user.name} ${status.toLowerCase()} trainer document "${doc.name}"`, newValue: { status, remarks }, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}

/** Approves a VERIFIED application: creates the trainer account (if needed), Trainer ID and record. */
export async function approveTrainerApplication(id: string, ctx: Ctx, opts: { note?: string | null } = {}) {
  // Password hashing is slow (bcrypt); do it before opening the transaction so the tx stays short.
  const preTempPassword = randomBytes(6).toString("base64url").replace(/[-_]/g, "a") + "9";
  const preHash = await hashPassword(preTempPassword);
  const out = await db.$transaction(async (tx) => {
    const app = await tx.trainerApplication.findUnique({ where: { id }, include: { trainer: true } });
    if (!app) throw Errors.notFound("Trainer application");
    if (app.trainer) throw Errors.conflict("This application has already been approved.");
    if (!TRAINER_TRANSITIONS[app.status].includes("APPROVED")) throw Errors.badRequest(`Only verified applications can be approved (current status: ${titleCase(app.status)}).`);

    let user = app.userId ? await tx.user.findUnique({ where: { id: app.userId } }) : null;
    if (!user) user = await tx.user.findFirst({ where: { OR: [{ email: app.email }, { mobile: app.mobile }], deletedAt: null } });
    let tempPassword: string | null = null;
    if (user && user.role !== "TRAINER") {
      throw Errors.conflict(`An account with this email/mobile already exists as ${titleCase(user.role)}. Ask the applicant to use a different email or mobile.`);
    }
    if (!user) {
      tempPassword = preTempPassword;
      user = await tx.user.create({ data: { name: app.name, email: app.email, mobile: app.mobile, passwordHash: preHash, role: "TRAINER", avatarUrl: app.photoUrl } });
    }
    const trainerId = await generateTrainerId(tx);
    const trainer = await tx.trainer.create({
      data: {
        trainerId,
        userId: user.id,
        applicationId: app.id,
        level: app.level,
        stateId: app.stateId,
        districtId: app.districtId,
        blockId: app.blockId,
        status: "ACTIVE",
        skills: app.skills,
        languages: app.languages,
        qualification: app.qualification,
        bio: app.motivation,
      },
    });
    await tx.trainerDocument.updateMany({ where: { applicationId: app.id }, data: { trainerId: trainer.id } });
    await tx.trainerApplication.update({ where: { id }, data: { status: "APPROVED", userId: user.id, reviewedById: ctx.user.id, reviewNotes: opts.note ?? app.reviewNotes } });
    await tx.trainerApplicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: "APPROVED", note: opts.note ?? null, changedById: ctx.user.id } });
    return { app, user, trainer, tempPassword };
  });

  await audit({ user: ctx.user, action: "approve", module: "trainers", recordType: "Trainer", recordId: out.trainer.id, description: `${ctx.user.name} approved trainer application ${out.app.applicationNo}; Trainer ID ${out.trainer.trainerId} issued to ${out.app.name}`, ip: ctx.ip, userAgent: ctx.userAgent });
  await notify({
    userId: out.user.id,
    email: out.user.email,
    mobile: out.user.mobile,
    event: "TRAINER_APPROVED",
    data: { name: out.app.name, trainerId: out.trainer.trainerId, credentials: out.tempPassword ? `\n\nLogin: ${out.user.email}\nTemporary password: ${out.tempPassword}\nPlease change it after your first login.` : "" },
  });
  return out.trainer;
}

// ───────────────────────────── Admin: trainers & assignments ─────────────────────────────

export async function assignTrainer(input: { trainerId: string; centerId: string; courseId?: string | null; batchId?: string | null; notes?: string | null }, ctx: Ctx) {
  const trainer = await db.trainer.findFirst({ where: { id: input.trainerId, deletedAt: null }, include: { user: true } });
  if (!trainer) throw Errors.notFound("Trainer");
  if (trainer.status !== "ACTIVE") throw Errors.badRequest("Only active trainers can be assigned.");
  const center = await db.center.findFirst({ where: { id: input.centerId, deletedAt: null } });
  if (!center) throw Errors.notFound("Training center");
  let courseId = input.courseId || null;
  let batch = null;
  if (input.batchId) {
    batch = await db.batch.findFirst({ where: { id: input.batchId, centerId: center.id, deletedAt: null }, include: { course: true } });
    if (!batch) throw Errors.badRequest("Batch must belong to the selected center.");
    courseId = batch.courseId;
  } else if (courseId) {
    const offered = await db.centerCourse.findUnique({ where: { centerId_courseId: { centerId: center.id, courseId } } });
    if (!offered) throw Errors.badRequest("This course is not offered at the selected center.");
  }
  const assignment = await db.$transaction(async (tx) => {
    const a = await tx.trainerAssignment.create({ data: { trainerId: trainer.id, centerId: center.id, courseId, batchId: batch?.id ?? null, notes: input.notes ?? null, assignedById: ctx.user.id } });
    if (batch) {
      await tx.trainerAssignment.updateMany({ where: { batchId: batch.id, isActive: true, id: { not: a.id } }, data: { isActive: false, endedAt: new Date() } });
      await tx.batch.update({ where: { id: batch.id }, data: { trainerId: trainer.id } });
      await tx.admission.updateMany({ where: { batchId: batch.id, status: { in: ["ACTIVE", "ON_HOLD"] } }, data: { trainerId: trainer.id } });
    }
    return a;
  });
  const details = batch ? ` for batch ${batch.name} (${batch.course.name})` : courseId ? ` for a course` : "";
  await audit({ user: ctx.user, action: "assign", module: "trainers", recordType: "TrainerAssignment", recordId: assignment.id, description: `${ctx.user.name} assigned trainer ${trainer.trainerId} to ${center.name}${details}`, newValue: assignment, ip: ctx.ip, userAgent: ctx.userAgent });
  await notify({ userId: trainer.userId, email: trainer.user.email, mobile: trainer.user.mobile, event: "TRAINER_ASSIGNED", data: { name: trainer.user.name, center: center.name, details } });
  return assignment;
}

export async function endAssignment(assignmentId: string, ctx: Ctx) {
  const a = await db.trainerAssignment.findUnique({ where: { id: assignmentId }, include: { trainer: true, center: true } });
  if (!a) throw Errors.notFound("Assignment");
  await db.$transaction(async (tx) => {
    await tx.trainerAssignment.update({ where: { id: assignmentId }, data: { isActive: false, endedAt: new Date() } });
    if (a.batchId) await tx.batch.updateMany({ where: { id: a.batchId, trainerId: a.trainerId }, data: { trainerId: null } });
  });
  await audit({ user: ctx.user, action: "end_assignment", module: "trainers", recordType: "TrainerAssignment", recordId: assignmentId, description: `${ctx.user.name} ended assignment of ${a.trainer.trainerId} at ${a.center.name}`, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function setTrainerStatus(trainerId: string, status: TrainerStatus, ctx: Ctx) {
  const trainer = await db.trainer.findFirst({ where: { id: trainerId, deletedAt: null } });
  if (!trainer) throw Errors.notFound("Trainer");
  await db.$transaction(async (tx) => {
    await tx.trainer.update({ where: { id: trainerId }, data: { status } });
    if (status === "INACTIVE") {
      await tx.trainerAssignment.updateMany({ where: { trainerId, isActive: true }, data: { isActive: false, endedAt: new Date() } });
      await tx.batch.updateMany({ where: { trainerId }, data: { trainerId: null } });
    }
  });
  await audit({ user: ctx.user, action: status === "ACTIVE" ? "activate" : "deactivate", module: "trainers", recordType: "Trainer", recordId: trainerId, description: `${ctx.user.name} ${status === "ACTIVE" ? "activated" : "deactivated"} trainer ${trainer.trainerId}`, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Queries ─────────────────────────────

export const trainerApplicationListSchema = paginationSchema.extend({
  status: z.string().optional(),
  level: z.string().optional(),
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  skill: z.string().trim().max(100).optional(),
  courseId: optionalUuid,
  from: optionalDate,
  to: optionalDate,
});

export async function listTrainerApplications(q: z.infer<typeof trainerApplicationListSchema>) {
  const where: Prisma.TrainerApplicationWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",") as TrainerApplicationStatus[] };
  if (q.level) where.level = { in: q.level.split(",") as TrainerLevel[] };
  if (q.stateId) where.stateId = q.stateId;
  if (q.districtId) where.districtId = q.districtId;
  if (q.blockId) where.blockId = q.blockId;
  if (q.skill) where.skills = { has: q.skill };
  if (q.courseId) where.preferredCourseIds = { has: q.courseId };
  if (q.from || q.to) where.submittedAt = { gte: q.from, lt: q.to };
  if (q.q) where.OR = [{ applicationNo: { contains: q.q, mode: "insensitive" } }, { name: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { mobile: { contains: q.q } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["submittedAt", "name", "status", "level"] as const, "submittedAt");
  const [items, total] = await Promise.all([
    db.trainerApplication.findMany({ where, orderBy, ...getPaging(q), include: { state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } }, _count: { select: { documents: true } } } }),
    db.trainerApplication.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getTrainerApplicationDetail(id: string) {
  const app = await db.trainerApplication.findUnique({
    where: { id },
    include: { state: true, district: true, block: true, documents: { orderBy: { createdAt: "desc" } }, statusHistory: { orderBy: { createdAt: "asc" } }, trainer: { include: { user: { select: { id: true, name: true, email: true, mobile: true } } } } },
  });
  if (!app) throw Errors.notFound("Trainer application");
  const courses = app.preferredCourseIds.length ? await db.course.findMany({ where: { id: { in: app.preferredCourseIds } }, select: { id: true, name: true, code: true } }) : [];
  const actorIds = [...new Set(app.statusHistory.map((h) => h.changedById).filter((v): v is string => !!v))];
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  return { ...app, preferredCourses: courses, actors: Object.fromEntries(actors.map((a) => [a.id, a.name])), allowedTransitions: TRAINER_TRANSITIONS[app.status] };
}

export const trainerListSchema = paginationSchema.extend({
  status: z.string().optional(),
  level: z.string().optional(),
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  centerId: optionalUuid,
  courseId: optionalUuid,
  skill: z.string().trim().max(100).optional(),
});

export async function listTrainers(q: z.infer<typeof trainerListSchema>) {
  const where: Prisma.TrainerWhereInput = { deletedAt: null };
  if (q.status) where.status = { in: q.status.split(",") as TrainerStatus[] };
  if (q.level) where.level = { in: q.level.split(",") as TrainerLevel[] };
  if (q.stateId) where.stateId = q.stateId;
  if (q.districtId) where.districtId = q.districtId;
  if (q.blockId) where.blockId = q.blockId;
  if (q.skill) where.skills = { has: q.skill };
  if (q.centerId || q.courseId) where.assignments = { some: { isActive: true, centerId: q.centerId, courseId: q.courseId } };
  if (q.q) where.OR = [{ trainerId: { contains: q.q, mode: "insensitive" } }, { user: { name: { contains: q.q, mode: "insensitive" } } }, { user: { email: { contains: q.q, mode: "insensitive" } } }, { user: { mobile: { contains: q.q } } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["joinedAt", "trainerId", "level", "status"] as const, "joinedAt");
  const [items, total] = await Promise.all([
    db.trainer.findMany({
      where,
      orderBy,
      ...getPaging(q),
      include: {
        user: { select: { id: true, name: true, email: true, mobile: true, avatarUrl: true } },
        state: { select: { name: true } },
        district: { select: { name: true } },
        block: { select: { name: true } },
        assignments: { where: { isActive: true }, include: { center: { select: { id: true, name: true, code: true } }, course: { select: { name: true } }, batch: { select: { name: true, code: true } } } },
        _count: { select: { batches: true } },
      },
    }),
    db.trainer.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getTrainerDetail(id: string) {
  const t = await db.trainer.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, mobile: true, avatarUrl: true, status: true, lastLoginAt: true } },
      state: true,
      district: true,
      block: true,
      application: { select: { id: true, applicationNo: true, submittedAt: true, experienceYears: true, teachingExperienceYears: true, availability: true, trainingMode: true, motivation: true, preferredCourseIds: true } },
      assignments: { orderBy: { assignedAt: "desc" }, include: { center: { select: { id: true, name: true, code: true } }, course: { select: { id: true, name: true } }, batch: { select: { id: true, name: true, code: true, status: true } } } },
      batches: { where: { deletedAt: null }, orderBy: { startDate: "desc" }, include: { course: { select: { name: true } }, center: { select: { name: true, code: true } }, _count: { select: { admissions: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!t) throw Errors.notFound("Trainer");
  const studentCount = await db.admission.count({ where: { batch: { trainerId: id }, status: { in: ["ACTIVE", "ON_HOLD"] } } });
  return { ...t, studentCount };
}
