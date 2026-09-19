import { db, type Prisma } from "@/lib/db";
import type { CentreApplicationStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify, notifyStaff } from "@/lib/notifications";
import { generateCentreApplicationNo } from "@/lib/ids";
import { getSetting } from "@/lib/settings";
import { titleCase } from "@/lib/utils";
import type { StoredFile } from "@/lib/storage";
import { normalizeEmail, normalizeMobile } from "@/server/auth";
import { createCenter } from "@/server/centers";
import type { CentreApplicationInput } from "@/lib/validation/centre-applications";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalDate } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * The seven-step Shiksha Mission process, expressed as allowed status moves:
 *  1 Application            → SUBMITTED
 *  2 Documents Verification → UNDER_REVIEW ↔ DOCUMENTS_REQUIRED → DOCUMENTS_VERIFIED
 *  3 Centre Verification    → CENTRE_VERIFICATION
 *  4 Selection              → SELECTED
 *  5 Authorization          → AGREEMENT_PENDING → AGREEMENT_SIGNED
 *  6 Orientation            → ORIENTATION
 *  7 Centre Start           → APPROVED (creates the Center record)
 */
export const CENTRE_TRANSITIONS: Record<CentreApplicationStatus, CentreApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["DOCUMENTS_REQUIRED", "DOCUMENTS_VERIFIED", "REJECTED"],
  DOCUMENTS_REQUIRED: ["UNDER_REVIEW", "DOCUMENTS_VERIFIED", "REJECTED"],
  DOCUMENTS_VERIFIED: ["CENTRE_VERIFICATION", "REJECTED"],
  CENTRE_VERIFICATION: ["SELECTED", "DOCUMENTS_REQUIRED", "REJECTED"],
  SELECTED: ["AGREEMENT_PENDING", "REJECTED"],
  AGREEMENT_PENDING: ["AGREEMENT_SIGNED", "REJECTED"],
  AGREEMENT_SIGNED: ["ORIENTATION", "REJECTED"],
  ORIENTATION: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: ["UNDER_REVIEW"],
};

/** Step number (1–7) each status belongs to, for the public tracker. */
export const CENTRE_STEP_OF: Record<CentreApplicationStatus, number> = {
  SUBMITTED: 1,
  UNDER_REVIEW: 2,
  DOCUMENTS_REQUIRED: 2,
  DOCUMENTS_VERIFIED: 2,
  CENTRE_VERIFICATION: 3,
  SELECTED: 4,
  AGREEMENT_PENDING: 5,
  AGREEMENT_SIGNED: 5,
  ORIENTATION: 6,
  APPROVED: 7,
  REJECTED: 0,
};

export const CENTRE_STEPS = [
  { step: 1, title: "Application", description: "Submit the centre application form." },
  { step: 2, title: "Documents Verification", description: "Identity, address and qualification documents are checked." },
  { step: 3, title: "Centre Verification", description: "The proposed space, classroom and basic facilities are verified." },
  { step: 4, title: "Selection", description: "The application is selected against the Foundation's standards." },
  { step: 5, title: "Authorization / Agreement", description: "The authorisation or agreement is completed with the operator." },
  { step: 6, title: "Orientation", description: "Operator and teachers are oriented on running the centre and its academics." },
  { step: 7, title: "Centre Start", description: "Class 1–4 classes begin at the centre." },
] as const;

/** Status → short, applicant-facing explanation. */
export function centreStatusMessage(status: CentreApplicationStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "We have received your application. Our team will begin the review shortly.";
    case "UNDER_REVIEW":
      return "Your application and documents are being reviewed by the Foundation.";
    case "DOCUMENTS_REQUIRED":
      return "Some documents are missing or unclear. Please upload them to continue.";
    case "DOCUMENTS_VERIFIED":
      return "Your documents are verified. A centre verification will be arranged next.";
    case "CENTRE_VERIFICATION":
      return "Your proposed space is being verified for classrooms and basic facilities.";
    case "SELECTED":
      return "Congratulations, your application has been selected. Authorisation comes next.";
    case "AGREEMENT_PENDING":
      return "Your authorisation / agreement is being prepared. Our team will contact you.";
    case "AGREEMENT_SIGNED":
      return "Agreement complete. Your orientation will be scheduled shortly.";
    case "ORIENTATION":
      return "Orientation is scheduled. After it, your centre can start classes.";
    case "APPROVED":
      return "Your centre is approved and can begin Class 1–4 classes.";
    case "REJECTED":
      return "This application was not approved. See the reason below.";
  }
}

const detailInclude = {
  state: true,
  district: true,
  block: true,
  documents: { orderBy: { createdAt: "desc" } },
  statusHistory: { orderBy: { createdAt: "asc" } },
  center: { select: { id: true, code: true, name: true, slug: true, status: true } },
} satisfies Prisma.CentreApplicationInclude;

// ───────────────────────────── Public: apply & track ─────────────────────────────

export async function submitCentreApplication(input: CentreApplicationInput, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  if (!(await getSetting<boolean>("centres.applicationsOpen"))) {
    throw Errors.forbidden("Centre applications are currently closed. Please check back soon.");
  }
  const block = await db.block.findFirst({
    where: { id: input.blockId, districtId: input.districtId, district: { stateId: input.stateId }, isActive: true },
  });
  if (!block) throw Errors.validation("Please correct the highlighted fields.", { blockId: "Block must belong to the selected district and state" });

  const email = normalizeEmail(input.email);
  const mobile = normalizeMobile(input.mobile);

  const open = await db.centreApplication.findFirst({
    where: { OR: [{ email }, { mobile }], status: { notIn: ["REJECTED"] } },
    select: { applicationNo: true, status: true },
  });
  if (open) {
    throw Errors.conflict(
      `An application (${open.applicationNo}) already exists for this email or mobile and is ${titleCase(open.status)}. Track it from the status page.`
    );
  }

  const app = await db.$transaction(async (tx) => {
    const applicationNo = await generateCentreApplicationNo(tx);
    return tx.centreApplication.create({
      data: {
        applicationNo,
        applicantName: input.applicantName,
        mobile,
        whatsapp: input.whatsapp ? normalizeMobile(input.whatsapp) : mobile,
        email,
        dob: input.dob || null,
        gender: input.gender ?? null,
        photoUrl: input.photoUrl ?? null,
        qualification: input.qualification,
        occupation: input.occupation ?? null,
        teachingExperienceYears: input.teachingExperienceYears,
        stateId: input.stateId,
        districtId: input.districtId,
        blockId: input.blockId,
        villageTown: input.villageTown,
        address: input.address,
        pincode: input.pincode,
        proposedName: input.proposedName,
        spaceType: input.spaceType,
        roomCount: input.roomCount,
        areaSqft: input.areaSqft ?? null,
        seatingCapacity: input.seatingCapacity,
        hasElectricity: input.hasElectricity,
        hasToilet: input.hasToilet,
        hasDrinkingWater: input.hasDrinkingWater,
        hasFurniture: input.hasFurniture,
        expectedStudents: input.expectedStudents,
        classes: input.classes,
        motivation: input.motivation,
        status: "SUBMITTED",
        statusHistory: { create: [{ toStatus: "SUBMITTED" }] },
      },
    });
  });

  await audit({
    user: null,
    action: "submit",
    module: "centre_applications",
    recordType: "CentreApplication",
    recordId: app.id,
    description: `Centre application ${app.applicationNo} submitted by ${app.applicantName} for ${app.villageTown}`,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  await notify({
    email,
    mobile,
    event: "CENTRE_APPLICATION_SUBMITTED",
    data: { name: app.applicantName, applicationNo: app.applicationNo, location: app.villageTown },
  });
  await notifyStaff({
    permission: "centre_applications.view",
    title: `New centre application ${app.applicationNo}`,
    body: `${app.applicantName} applied to open "${app.proposedName}" at ${app.villageTown}.\nMobile: ${mobile}\nEmail: ${email}`,
    path: `/admin/centre-applications/${app.id}`,
  });
  return { id: app.id, applicationNo: app.applicationNo };
}

export async function attachCentreDocument(applicationId: string, type: string, file: StoredFile) {
  const app = await db.centreApplication.findUnique({ where: { id: applicationId }, select: { id: true, status: true } });
  if (!app) throw Errors.notFound("Application");
  const doc = await db.centreApplicationDocument.create({
    data: { applicationId, type, name: file.name, url: file.url, mimeType: file.mimeType, size: file.size },
  });
  if (app.status === "DOCUMENTS_REQUIRED") {
    await db.$transaction([
      db.centreApplication.update({ where: { id: applicationId }, data: { status: "UNDER_REVIEW" } }),
      db.centreApplicationStatusHistory.create({
        data: { applicationId, fromStatus: "DOCUMENTS_REQUIRED", toStatus: "UNDER_REVIEW", note: "Documents uploaded by applicant" },
      }),
    ]);
  }
  return doc;
}

/** Public status lookup by application number + registered mobile. */
export async function lookupCentreApplication(applicationNo: string, mobile: string) {
  const app = await db.centreApplication.findFirst({
    where: { applicationNo: applicationNo.trim().toUpperCase(), mobile: normalizeMobile(mobile) },
    include: detailInclude,
  });
  if (!app) throw Errors.notFound("Application");
  return {
    id: app.id,
    applicationNo: app.applicationNo,
    applicantName: app.applicantName,
    proposedName: app.proposedName,
    status: app.status,
    step: CENTRE_STEP_OF[app.status],
    message: centreStatusMessage(app.status),
    submittedAt: app.submittedAt,
    location: [app.villageTown, app.block.name, app.district.name, app.state.name].filter(Boolean).join(", "),
    classes: app.classes,
    verificationAt: app.verificationAt,
    orientationAt: app.orientationAt,
    orientationMode: app.orientationMode,
    reviewNotes: app.status === "DOCUMENTS_REQUIRED" ? app.reviewNotes : null,
    rejectionReason: app.status === "REJECTED" ? app.rejectionReason : null,
    center: app.center,
    documents: app.documents.map((d) => ({ id: d.id, type: d.type, name: d.name, status: d.status, remarks: d.remarks, createdAt: d.createdAt })),
    statusHistory: app.statusHistory.map((h) => ({ toStatus: h.toStatus, note: h.note, createdAt: h.createdAt })),
  };
}

export type CentreApplicationStatusView = Awaited<ReturnType<typeof lookupCentreApplication>>;

// ───────────────────────────── Admin ─────────────────────────────

async function load(id: string) {
  const app = await db.centreApplication.findUnique({ where: { id }, include: detailInclude });
  if (!app) throw Errors.notFound("Centre application");
  return app;
}

export interface CentreTransitionInput {
  to: CentreApplicationStatus;
  note?: string | null;
  verificationAt?: Date | null;
  orientationAt?: Date | null;
  orientationMode?: string | null;
  agreementReference?: string | null;
}

export async function transitionCentreApplication(id: string, input: CentreTransitionInput, ctx: Ctx) {
  const app = await load(id);
  if (input.to === "APPROVED") throw Errors.badRequest("Use the approve action to start the centre.");
  if (!CENTRE_TRANSITIONS[app.status].includes(input.to)) {
    throw Errors.badRequest(`Cannot move from "${titleCase(app.status)}" to "${titleCase(input.to)}".`);
  }
  if (input.to === "DOCUMENTS_REQUIRED" && !input.note) {
    throw Errors.validation("Please correct the highlighted fields.", { note: "Describe which documents are required" });
  }
  if (input.to === "REJECTED" && !input.note) {
    throw Errors.validation("Please correct the highlighted fields.", { note: "Provide a reason" });
  }
  if (input.to === "CENTRE_VERIFICATION" && !input.verificationAt) {
    throw Errors.validation("Please correct the highlighted fields.", { verificationAt: "Set the verification visit date" });
  }
  if (input.to === "ORIENTATION" && !input.orientationAt) {
    throw Errors.validation("Please correct the highlighted fields.", { orientationAt: "Set the orientation date" });
  }

  await db.$transaction([
    db.centreApplication.update({
      where: { id },
      data: {
        status: input.to,
        reviewedById: ctx.user.id,
        reviewNotes: input.note ?? app.reviewNotes,
        rejectionReason: input.to === "REJECTED" ? input.note : app.rejectionReason,
        verificationAt: input.to === "CENTRE_VERIFICATION" ? input.verificationAt : app.verificationAt,
        verificationNotes: input.to === "SELECTED" && app.status === "CENTRE_VERIFICATION" ? (input.note ?? app.verificationNotes) : app.verificationNotes,
        verifiedById: input.to === "DOCUMENTS_VERIFIED" ? ctx.user.id : app.verifiedById,
        agreementReference: input.agreementReference ?? app.agreementReference,
        agreementSignedAt: input.to === "AGREEMENT_SIGNED" ? new Date() : app.agreementSignedAt,
        orientationAt: input.to === "ORIENTATION" ? input.orientationAt : app.orientationAt,
        orientationMode: input.to === "ORIENTATION" ? (input.orientationMode ?? app.orientationMode) : app.orientationMode,
      },
    }),
    db.centreApplicationStatusHistory.create({
      data: { applicationId: id, fromStatus: app.status, toStatus: input.to, note: input.note ?? null, changedById: ctx.user.id },
    }),
  ]);

  await audit({
    user: ctx.user,
    action: input.to.toLowerCase(),
    module: "centre_applications",
    recordType: "CentreApplication",
    recordId: id,
    description: `${ctx.user.name} moved centre application ${app.applicationNo} to ${titleCase(input.to)}`,
    oldValue: { status: app.status },
    newValue: { status: input.to, note: input.note },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  const extra =
    input.to === "CENTRE_VERIFICATION" && input.verificationAt
      ? ` Visit scheduled for ${input.verificationAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.`
      : input.to === "ORIENTATION" && input.orientationAt
        ? ` Orientation on ${input.orientationAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${input.orientationMode ? ` (${input.orientationMode})` : ""}.`
        : "";
  await notify({
    email: app.email,
    mobile: app.mobile,
    event: "CENTRE_APPLICATION_STATUS",
    data: {
      name: app.applicantName,
      applicationNo: app.applicationNo,
      status: titleCase(input.to),
      message: `${centreStatusMessage(input.to)}${extra}`,
      note: input.note ? `Note: ${input.note}\n` : "",
    },
  });
}

export async function verifyCentreDocument(docId: string, status: "VERIFIED" | "REJECTED", remarks: string | null | undefined, ctx: Ctx) {
  const doc = await db.centreApplicationDocument.findUnique({ where: { id: docId } });
  if (!doc) throw Errors.notFound("Document");
  const updated = await db.centreApplicationDocument.update({
    where: { id: docId },
    data: { status, remarks: remarks ?? null, verifiedById: ctx.user.id, verifiedAt: new Date() },
  });
  await audit({
    user: ctx.user,
    action: status === "VERIFIED" ? "verify_document" : "reject_document",
    module: "centre_applications",
    recordType: "CentreApplicationDocument",
    recordId: docId,
    description: `${ctx.user.name} ${status.toLowerCase()} centre document "${doc.name}"`,
    newValue: { status, remarks },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return updated;
}

export interface CentreApproveInput {
  note?: string | null;
  centerName?: string;
  capacity?: number;
  phone?: string | null;
  courseIds?: string[];
}

/** Step 7 – Centre Start: creates the training centre from the approved application. */
export async function approveCentreApplication(id: string, input: CentreApproveInput, ctx: Ctx) {
  const app = await load(id);
  if (app.centerId) throw Errors.conflict("This application already has a centre.");
  if (!CENTRE_TRANSITIONS[app.status].includes("APPROVED")) {
    throw Errors.badRequest(`The orientation must be completed before the centre can start (current status: ${titleCase(app.status)}).`);
  }

  const facilities = [
    app.hasElectricity ? "Electricity" : null,
    app.hasDrinkingWater ? "Drinking Water" : null,
    app.hasToilet ? "Toilet" : null,
    app.hasFurniture ? "Furniture" : null,
    `${app.roomCount} classroom${app.roomCount === 1 ? "" : "s"}`,
  ].filter((f): f is string => !!f);

  const center = await createCenter(
    {
      name: input.centerName?.trim() || app.proposedName,
      stateId: app.stateId,
      districtId: app.districtId,
      blockId: app.blockId,
      address: app.address,
      villageTown: app.villageTown,
      pincode: app.pincode,
      phone: input.phone || app.mobile,
      whatsapp: app.whatsapp ?? app.mobile,
      email: app.email,
      capacity: input.capacity ?? app.seatingCapacity,
      facilities,
      description: `Normal Education Centre (Class 1–4) under the EduSkill Shiksha Mission, opened from centre application ${app.applicationNo}.`,
      contactPerson: app.applicantName,
      status: "ACTIVE",
      isVerified: true,
      courseIds: input.courseIds ?? [],
    },
    ctx
  );

  await db.$transaction([
    db.centreApplication.update({
      where: { id },
      data: { status: "APPROVED", centerId: center.id, reviewedById: ctx.user.id, reviewNotes: input.note ?? app.reviewNotes },
    }),
    db.centreApplicationStatusHistory.create({
      data: { applicationId: id, fromStatus: app.status, toStatus: "APPROVED", note: input.note ?? null, changedById: ctx.user.id },
    }),
  ]);

  await audit({
    user: ctx.user,
    action: "approve",
    module: "centre_applications",
    recordType: "CentreApplication",
    recordId: id,
    description: `${ctx.user.name} approved centre application ${app.applicationNo}; centre ${center.code} created for ${app.applicantName}`,
    newValue: { centerId: center.id, centerCode: center.code },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  await notify({
    email: app.email,
    mobile: app.mobile,
    event: "GENERIC",
    data: {
      title: `Your centre ${center.code} is approved`,
      body: `Dear ${app.applicantName},\n\nCongratulations! Your Normal Education Centre is approved and can begin Class 1–4 classes.\n\nCentre name: ${center.name}\nCentre code: ${center.code}\n\nThe Foundation team will be in touch about academics and student admissions.`,
    },
  });
  return center;
}

// ───────────────────────────── Queries ─────────────────────────────

export const centreApplicationListSchema = paginationSchema.extend({
  status: z.string().optional(),
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  from: optionalDate,
  to: optionalDate,
});

export type CentreApplicationListQuery = z.infer<typeof centreApplicationListSchema>;

export async function listCentreApplications(q: CentreApplicationListQuery) {
  const where: Prisma.CentreApplicationWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",").filter(Boolean) as CentreApplicationStatus[] };
  if (q.stateId) where.stateId = q.stateId;
  if (q.districtId) where.districtId = q.districtId;
  if (q.blockId) where.blockId = q.blockId;
  if (q.from || q.to) where.submittedAt = { gte: q.from, lt: q.to };
  if (q.q) {
    where.OR = [
      { applicationNo: { contains: q.q, mode: "insensitive" } },
      { applicantName: { contains: q.q, mode: "insensitive" } },
      { proposedName: { contains: q.q, mode: "insensitive" } },
      { email: { contains: q.q, mode: "insensitive" } },
      { mobile: { contains: q.q } },
      { villageTown: { contains: q.q, mode: "insensitive" } },
    ];
  }
  const orderBy = buildOrderBy(q.sort, q.order, ["submittedAt", "applicantName", "status", "proposedName"] as const, "submittedAt");
  const [items, total] = await Promise.all([
    db.centreApplication.findMany({
      where,
      orderBy,
      ...getPaging(q),
      include: {
        state: { select: { name: true } },
        district: { select: { name: true } },
        block: { select: { name: true } },
        center: { select: { id: true, code: true } },
        _count: { select: { documents: true } },
      },
    }),
    db.centreApplication.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getCentreApplicationDetail(id: string) {
  const app = await load(id);
  const actorIds = [...new Set(app.statusHistory.map((h) => h.changedById).filter((v): v is string => !!v))];
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  return {
    ...app,
    step: CENTRE_STEP_OF[app.status],
    message: centreStatusMessage(app.status),
    actors: Object.fromEntries(actors.map((a) => [a.id, a.name])),
    allowedTransitions: CENTRE_TRANSITIONS[app.status],
  };
}

export type CentreApplicationDetail = Awaited<ReturnType<typeof getCentreApplicationDetail>>;

/** Counts per status for the admin tab strip. */
export async function centreApplicationCounts() {
  const rows = await db.centreApplication.groupBy({ by: ["status"], _count: { _all: true } });
  const out: Partial<Record<CentreApplicationStatus, number>> = {};
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}
