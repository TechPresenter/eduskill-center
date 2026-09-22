import { db, Prisma } from "@/lib/db";
import type { CenterStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { generateCenterCode } from "@/lib/ids";
import { slugify } from "@/lib/utils";
import type { CenterInput, CenterSearchQuery } from "@/lib/validation/centers";
import { countOccupiedSeats } from "@/server/batches";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

async function resolveHierarchy(stateId: string, districtId: string, blockId: string) {
  const block = await db.block.findFirst({ where: { id: blockId, districtId, district: { stateId } }, include: { district: { include: { state: true } } } });
  if (!block) throw Errors.validation("Please correct the highlighted fields.", { blockId: "Block must belong to the selected district and state" });
  return { state: block.district.state, district: block.district, block };
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base) || "center";
  let i = 1;
  while (await db.center.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) {
    slug = `${slugify(base)}-${++i}`;
  }
  return slug;
}

export async function createCenter(input: CenterInput, ctx: Ctx) {
  const { state, district } = await resolveHierarchy(input.stateId, input.districtId, input.blockId);
  const slug = await uniqueSlug(input.name);
  const center = await db.$transaction(async (tx) => {
    const { code, sequence } = await generateCenterCode(state.code, district.code, tx);
    return tx.center.create({
      data: {
        code,
        codeSequence: sequence,
        name: input.name,
        slug,
        stateId: state.id,
        districtId: district.id,
        blockId: input.blockId,
        address: input.address,
        landmark: input.landmark ?? null,
        villageTown: input.villageTown ?? null,
        pincode: input.pincode,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        phone: input.phone || null,
        whatsapp: input.whatsapp || null,
        email: input.email || null,
        openingHours: input.openingHours ?? undefined,
        capacity: input.capacity,
        facilities: input.facilities,
        description: input.description ?? null,
        coverImage: input.coverImage ?? null,
        contactPerson: input.contactPerson ?? null,
        isVerified: input.isVerified ?? false,
        status: input.status ?? "PENDING",
        establishedOn: input.establishedOn ? new Date(input.establishedOn) : null,
        createdById: ctx.user.id,
        courses: input.courseIds?.length ? { create: input.courseIds.map((courseId) => ({ courseId })) } : undefined,
      },
    });
  });
  await audit({ user: ctx.user, action: "create", module: "centers", recordType: "Center", recordId: center.id, description: `${ctx.user.name} created training center ${center.code} (${center.name})`, newValue: center, ip: ctx.ip, userAgent: ctx.userAgent });
  return center;
}

export async function updateCenter(id: string, input: Partial<CenterInput>, ctx: Ctx) {
  const existing = await db.center.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw Errors.notFound("Training center");
  const stateId = input.stateId ?? existing.stateId;
  const districtId = input.districtId ?? existing.districtId;
  const blockId = input.blockId ?? existing.blockId;
  await resolveHierarchy(stateId, districtId, blockId);
  const slug = input.name && input.name !== existing.name ? await uniqueSlug(input.name, id) : undefined;
  const center = await db.$transaction(async (tx) => {
    const updated = await tx.center.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        stateId,
        districtId,
        blockId,
        address: input.address,
        landmark: input.landmark,
        villageTown: input.villageTown,
        pincode: input.pincode,
        latitude: input.latitude,
        longitude: input.longitude,
        phone: input.phone === "" ? null : input.phone,
        whatsapp: input.whatsapp === "" ? null : input.whatsapp,
        email: input.email === "" ? null : input.email,
        openingHours: input.openingHours === null ? Prisma.DbNull : input.openingHours,
        capacity: input.capacity,
        facilities: input.facilities,
        description: input.description,
        coverImage: input.coverImage,
        contactPerson: input.contactPerson,
        isVerified: input.isVerified,
        status: input.status,
        establishedOn: input.establishedOn === undefined ? undefined : input.establishedOn ? new Date(input.establishedOn) : null,
      },
    });
    if (input.courseIds) {
      const current = await tx.centerCourse.findMany({ where: { centerId: id }, select: { courseId: true } });
      const currentIds = new Set(current.map((c) => c.courseId));
      const nextIds = new Set(input.courseIds);
      const toRemove = [...currentIds].filter((c) => !nextIds.has(c));
      const toAdd = [...nextIds].filter((c) => !currentIds.has(c));
      if (toRemove.length) {
        const inUse = await tx.batch.count({ where: { centerId: id, courseId: { in: toRemove }, deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } } });
        if (inUse) throw Errors.conflict("Cannot remove a course that has upcoming or ongoing batches at this center.");
        await tx.centerCourse.deleteMany({ where: { centerId: id, courseId: { in: toRemove } } });
      }
      if (toAdd.length) await tx.centerCourse.createMany({ data: toAdd.map((courseId) => ({ centerId: id, courseId })), skipDuplicates: true });
    }
    return updated;
  });
  await audit({ user: ctx.user, action: "update", module: "centers", recordType: "Center", recordId: id, description: `${ctx.user.name} updated training center ${center.code}`, oldValue: existing, newValue: center, ip: ctx.ip, userAgent: ctx.userAgent });
  return center;
}

export async function setCenterStatus(id: string, status: CenterStatus, ctx: Ctx) {
  const center = await db.center.findFirst({ where: { id, deletedAt: null } });
  if (!center) throw Errors.notFound("Training center");
  const updated = await db.center.update({ where: { id }, data: { status } });
  await audit({ user: ctx.user, action: status === "ACTIVE" ? "activate" : "deactivate", module: "centers", recordType: "Center", recordId: id, description: `${ctx.user.name} set center ${center.code} to ${status}`, oldValue: { status: center.status }, newValue: { status }, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}

export async function verifyCenter(id: string, verified: boolean, ctx: Ctx) {
  const center = await db.center.findFirst({ where: { id, deletedAt: null } });
  if (!center) throw Errors.notFound("Training center");
  const updated = await db.center.update({ where: { id }, data: { isVerified: verified, status: verified && center.status === "PENDING" ? "ACTIVE" : center.status } });
  await audit({ user: ctx.user, action: verified ? "verify" : "unverify", module: "centers", recordType: "Center", recordId: id, description: `${ctx.user.name} ${verified ? "verified" : "removed verification from"} center ${center.code}`, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}

export async function deleteCenter(id: string, ctx: Ctx) {
  const center = await db.center.findFirst({ where: { id, deletedAt: null } });
  if (!center) throw Errors.notFound("Training center");
  const active = await db.admission.count({ where: { centerId: id, status: { in: ["ACTIVE", "ON_HOLD"] } } });
  if (active) throw Errors.conflict("This center has active students. Deactivate it instead of deleting.");
  await db.center.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } });
  await audit({ user: ctx.user, action: "delete", module: "centers", recordType: "Center", recordId: id, description: `${ctx.user.name} deleted center ${center.code}`, oldValue: center, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function addGalleryImage(centerId: string, url: string, caption: string | null, ctx: Ctx) {
  const count = await db.centerGallery.count({ where: { centerId } });
  const item = await db.centerGallery.create({ data: { centerId, url, caption, sortOrder: count + 1 } });
  await audit({ user: ctx.user, action: "gallery_add", module: "centers", recordType: "Center", recordId: centerId, description: `${ctx.user.name} added a photo to center gallery`, ip: ctx.ip, userAgent: ctx.userAgent });
  return item;
}

export async function removeGalleryImage(id: string, ctx: Ctx) {
  const item = await db.centerGallery.findUnique({ where: { id } });
  if (!item) throw Errors.notFound("Photo");
  await db.centerGallery.delete({ where: { id } });
  await audit({ user: ctx.user, action: "gallery_remove", module: "centers", recordType: "Center", recordId: item.centerId, description: `${ctx.user.name} removed a photo from center gallery`, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Public queries ─────────────────────────────

const publicCenterSelect = {
  id: true,
  code: true,
  name: true,
  slug: true,
  address: true,
  landmark: true,
  villageTown: true,
  pincode: true,
  latitude: true,
  longitude: true,
  phone: true,
  whatsapp: true,
  email: true,
  openingHours: true,
  capacity: true,
  facilities: true,
  description: true,
  coverImage: true,
  isVerified: true,
  status: true,
  establishedOn: true,
  state: { select: { id: true, name: true, slug: true, code: true } },
  district: { select: { id: true, name: true, slug: true } },
  block: { select: { id: true, name: true, slug: true } },
  courses: { where: { isActive: true, course: { status: "ACTIVE" as const, deletedAt: null } }, select: { course: { select: { id: true, name: true, slug: true, code: true, durationText: true, level: true, mode: true, courseFee: true, scholarshipAvailable: true, icon: true } } } },
  gallery: { orderBy: { sortOrder: "asc" as const }, select: { id: true, url: true, caption: true } },
} satisfies Prisma.CenterSelect;

async function decorateCenter<T extends { id: string; capacity: number }>(c: T) {
  const [trainerCount, studentCount, batches] = await Promise.all([
    db.trainerAssignment.groupBy({ by: ["trainerId"], where: { centerId: c.id, isActive: true } }).then((r) => r.length),
    db.admission.count({ where: { centerId: c.id, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
    db.batch.findMany({ where: { centerId: c.id, deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } }, select: { id: true, capacity: true } }),
  ]);
  let availableSeats = 0;
  for (const b of batches) availableSeats += Math.max(0, b.capacity - (await countOccupiedSeats(b.id)));
  return { ...c, trainerCount, studentCount, availableSeats, openBatches: batches.length };
}

export async function searchCenters(q: CenterSearchQuery) {
  const where: Prisma.CenterWhereInput = { deletedAt: null, status: "ACTIVE" };
  if (q.stateId) where.stateId = q.stateId;
  if (q.districtId) where.districtId = q.districtId;
  if (q.blockId) where.blockId = q.blockId;
  if (q.state) where.state = { slug: q.state };
  if (q.district) where.district = { slug: q.district };
  if (q.courseId) where.courses = { some: { courseId: q.courseId, isActive: true } };
  if (q.verified) where.isVerified = q.verified === "true";
  if (q.pincode) where.pincode = { startsWith: q.pincode };
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { code: { contains: q.q, mode: "insensitive" } },
      { pincode: { startsWith: q.q } },
      { villageTown: { contains: q.q, mode: "insensitive" } },
      { district: { name: { contains: q.q, mode: "insensitive" } } },
    ];
  }
  const [rows, total] = await Promise.all([
    db.center.findMany({ where, orderBy: [{ isVerified: "desc" }, { name: "asc" }], ...getPaging(q), select: publicCenterSelect }),
    db.center.count({ where }),
  ]);
  const items = [];
  for (const r of rows) items.push(await decorateCenter(r));
  await db.analyticsEvent.create({ data: { type: "CENTER_SEARCH", metadata: { stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, courseId: q.courseId, q: q.q } } }).catch(() => undefined);
  return paged(items, total, q);
}

export async function getPublicCenter(stateSlug: string, districtSlug: string, centerSlug: string) {
  const c = await db.center.findFirst({ where: { slug: centerSlug, deletedAt: null, status: { in: ["ACTIVE", "PENDING"] }, state: { slug: stateSlug }, district: { slug: districtSlug } }, select: publicCenterSelect });
  if (!c) return null;
  const batches = await db.batch.findMany({
    where: { centerId: c.id, deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } },
    orderBy: { startDate: "asc" },
    include: { course: { select: { id: true, name: true, slug: true } }, trainer: { include: { user: { select: { name: true } } } } },
  });
  const batchesWithSeats = [];
  for (const b of batches) {
    const occupied = await countOccupiedSeats(b.id);
    batchesWithSeats.push({ id: b.id, code: b.code, name: b.name, course: b.course, startDate: b.startDate, endDate: b.endDate, startTime: b.startTime, endTime: b.endTime, days: b.days, status: b.status, capacity: b.capacity, available: Math.max(0, b.capacity - occupied), trainerName: b.trainer?.user.name ?? null });
  }
  const trainers = await db.trainerAssignment.findMany({ where: { centerId: c.id, isActive: true }, distinct: ["trainerId"], include: { trainer: { include: { user: { select: { name: true, avatarUrl: true } } } }, course: { select: { name: true } } } });
  const decorated = await decorateCenter(c);
  await db.analyticsEvent.create({ data: { type: "CENTER_VIEW", refId: c.id } }).catch(() => undefined);
  return {
    ...decorated,
    batches: batchesWithSeats,
    trainers: trainers.map((t) => ({ id: t.trainer.id, trainerId: t.trainer.trainerId, name: t.trainer.user.name, avatarUrl: t.trainer.user.avatarUrl, level: t.trainer.level, skills: t.trainer.skills, course: t.course?.name ?? null })),
  };
}

export async function mapCenters(filter: { stateId?: string; districtId?: string; blockId?: string; courseId?: string } = {}) {
  const rows = await db.center.findMany({
    where: { deletedAt: null, status: "ACTIVE", latitude: { not: null }, longitude: { not: null }, stateId: filter.stateId, districtId: filter.districtId, blockId: filter.blockId, ...(filter.courseId ? { courses: { some: { courseId: filter.courseId, isActive: true } } } : {}) },
    select: { id: true, code: true, name: true, slug: true, latitude: true, longitude: true, isVerified: true, villageTown: true, state: { select: { name: true, slug: true } }, district: { select: { name: true, slug: true } }, block: { select: { name: true } }, courses: { where: { isActive: true }, select: { course: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, lat: r.latitude!, lng: r.longitude!, verified: r.isVerified, location: [r.villageTown, r.block.name, r.district.name, r.state.name].filter(Boolean).join(", "), courses: r.courses.map((c) => c.course.name), url: `/training-centers/${r.state.slug}/${r.district.slug}/${r.slug}` }));
}

/**
 * The phone homepage's "Training centres" rail: a bounded read (verified first, newest next), unlike
 * mapCenters() it includes centres without coordinates and never loads every active centre.
 */
export async function listHomeCenters(limit = 8) {
  const rows = await db.center.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { id: true, code: true, name: true, slug: true, isVerified: true, villageTown: true, state: { select: { name: true, slug: true } }, district: { select: { name: true, slug: true } }, block: { select: { name: true } }, courses: { where: { isActive: true }, select: { course: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, verified: r.isVerified, location: [r.villageTown, r.block.name, r.district.name, r.state.name].filter(Boolean).join(", "), courses: r.courses.map((c) => c.course.name), url: `/training-centers/${r.state.slug}/${r.district.slug}/${r.slug}` }));
}

/** Coverage: states/districts/blocks that actually have active centers (never claims coverage without a center). */
export async function coverageStats() {
  const [states, districts, blocks, centers, students, trainers] = await Promise.all([
    db.center.groupBy({ by: ["stateId"], where: { deletedAt: null, status: "ACTIVE" } }).then((r) => r.length),
    db.center.groupBy({ by: ["districtId"], where: { deletedAt: null, status: "ACTIVE" } }).then((r) => r.length),
    db.center.groupBy({ by: ["blockId"], where: { deletedAt: null, status: "ACTIVE" } }).then((r) => r.length),
    db.center.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.student.count({ where: { deletedAt: null, studentId: { not: null } } }),
    db.trainer.count({ where: { deletedAt: null, status: "ACTIVE" } }),
  ]);
  return { states, districts, blocks, centers, students, trainers };
}

// ───────────────────────────── Admin queries ─────────────────────────────

export const centerListSchema = paginationSchema.extend({
  stateId: optionalUuid,
  districtId: optionalUuid,
  blockId: optionalUuid,
  courseId: optionalUuid,
  status: z.string().optional(),
  verified: z.union([z.literal("true"), z.literal("false")]).optional(),
});

export async function listCentersAdmin(q: z.infer<typeof centerListSchema>) {
  const where: Prisma.CenterWhereInput = { deletedAt: null };
  if (q.stateId) where.stateId = q.stateId;
  if (q.districtId) where.districtId = q.districtId;
  if (q.blockId) where.blockId = q.blockId;
  if (q.courseId) where.courses = { some: { courseId: q.courseId } };
  if (q.status) where.status = { in: q.status.split(",") as CenterStatus[] };
  if (q.verified) where.isVerified = q.verified === "true";
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }, { pincode: { startsWith: q.q } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "name", "code", "status"] as const, "createdAt");
  const [items, total] = await Promise.all([
    db.center.findMany({ where, orderBy, ...getPaging(q), include: { state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } }, _count: { select: { batches: { where: { deletedAt: null } }, admissions: { where: { status: { in: ["ACTIVE", "ON_HOLD"] } } }, courses: true, trainerAssignments: { where: { isActive: true } } } } } }),
    db.center.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getCenterAdmin(id: string) {
  const c = await db.center.findFirst({
    where: { id, deletedAt: null },
    include: {
      state: true,
      district: true,
      block: true,
      courses: { include: { course: { select: { id: true, name: true, code: true, status: true } } } },
      gallery: { orderBy: { sortOrder: "asc" } },
      documents: true,
      batches: { where: { deletedAt: null }, orderBy: { startDate: "desc" }, include: { course: { select: { name: true } }, trainer: { include: { user: { select: { name: true } } } }, _count: { select: { admissions: { where: { status: { in: ["ACTIVE", "ON_HOLD"] } } } } } } },
      trainerAssignments: { where: { isActive: true }, include: { trainer: { include: { user: { select: { name: true } } } }, course: { select: { name: true } }, batch: { select: { name: true, code: true } } } },
    },
  });
  if (!c) throw Errors.notFound("Training center");
  const [studentCount, applicationCount, pendingApplications, certificates] = await Promise.all([
    db.admission.count({ where: { centerId: id, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
    db.application.count({ where: { centerId: id } }),
    db.application.count({ where: { centerId: id, status: { in: ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED"] } } }),
    db.certificate.count({ where: { centerId: id, status: "ISSUED" } }),
  ]);
  return { ...c, stats: { studentCount, applicationCount, pendingApplications, certificates, trainerCount: new Set(c.trainerAssignments.map((a) => a.trainerId)).size } };
}
