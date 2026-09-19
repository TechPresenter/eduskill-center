import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { CourseStatus, CourseLevel, CourseMode } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { slugify, toNumber } from "@/lib/utils";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalBool } from "@/lib/api/query";
import { money, optionalString } from "@/lib/validation/common";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

// ───────────────────────────── Schemas ─────────────────────────────

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(80),
  description: optionalString,
  icon: z.string().trim().max(60).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const syllabusItemSchema = z.object({
  module: z.string().trim().min(1, "Module label is required").max(60),
  title: z.string().trim().min(1, "Title is required").max(200),
  topics: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

export const courseInputSchema = z.object({
  name: z.string().trim().min(3, "Enter the course name").max(160),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "Use 2–20 uppercase letters, digits or hyphens (e.g. BCA-102)"),
  categoryId: z.union([z.literal(""), z.string().uuid()]).optional().nullable(),
  shortDescription: z.string().trim().max(300).optional().nullable(),
  description: z.string().trim().max(20000).optional().nullable(),
  image: optionalString,
  icon: z.string().trim().max(60).optional().nullable(),
  durationText: z.string().trim().min(1, "Enter the duration (e.g. 3 months)").max(60),
  durationWeeks: z.coerce.number().int().min(0).max(520).default(0),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("BEGINNER"),
  mode: z.enum(["OFFLINE", "ONLINE", "HYBRID"]).default("OFFLINE"),
  eligibility: optionalString,
  minAge: z.union([z.literal(""), z.coerce.number().int().min(5).max(100)]).optional().nullable(),
  maxAge: z.union([z.literal(""), z.coerce.number().int().min(5).max(100)]).optional().nullable(),
  syllabus: z.array(syllabusItemSchema).max(100).optional(),
  totalClasses: z.coerce.number().int().min(0).max(2000).default(0),
  courseFee: money.default(0),
  registrationFee: money.default(0),
  examFee: money.default(0),
  certificateFee: money.default(0),
  scholarshipAvailable: z.coerce.boolean().default(false),
  scholarshipNote: optionalString,
  certificateEligibility: optionalString,
  minAttendancePct: z.coerce.number().int().min(0).max(100).default(75),
  passingMarksPct: z.coerce.number().int().min(0).max(100).default(40),
  requiredDocuments: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("DRAFT"),
  isFeatured: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
  seoTitle: z.string().trim().max(160).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
}).superRefine((v, ctx) => {
  if (typeof v.minAge === "number" && typeof v.maxAge === "number" && v.maxAge < v.minAge) {
    ctx.addIssue({ code: "custom", path: ["maxAge"], message: "Maximum age must be greater than minimum age" });
  }
});
export type CourseInput = z.infer<typeof courseInputSchema>;

export const courseListSchema = paginationSchema.extend({
  categoryId: optionalUuid,
  status: z.string().optional(),
  level: z.string().optional(),
  mode: z.string().optional(),
  featured: optionalBool,
});
export type CourseListQuery = z.infer<typeof courseListSchema>;

// ───────────────────────────── Categories ─────────────────────────────

export async function listCategories(opts: { activeOnly?: boolean } = {}) {
  return db.courseCategory.findMany({
    where: opts.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { courses: { where: { deletedAt: null } } } } },
  });
}

async function uniqueCategorySlug(name: string, excludeId?: string) {
  let slug = slugify(name) || "category";
  let i = 1;
  while (await db.courseCategory.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) slug = `${slugify(name)}-${++i}`;
  return slug;
}

export async function createCategory(input: CategoryInput, ctx: Ctx) {
  const dupe = await db.courseCategory.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } });
  if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A category with this name already exists" });
  const cat = await db.courseCategory.create({ data: { name: input.name, slug: await uniqueCategorySlug(input.name), description: input.description ?? null, icon: input.icon || null, sortOrder: input.sortOrder ?? 0, isActive: input.isActive ?? true } });
  await audit({ user: ctx.user, action: "create", module: "courses", recordType: "CourseCategory", recordId: cat.id, description: `${ctx.user.name} created course category ${cat.name}`, newValue: cat, ip: ctx.ip, userAgent: ctx.userAgent });
  return cat;
}

export async function updateCategory(id: string, input: Partial<CategoryInput>, ctx: Ctx) {
  const existing = await db.courseCategory.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Category");
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const dupe = await db.courseCategory.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, id: { not: id } } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A category with this name already exists" });
  }
  const cat = await db.courseCategory.update({
    where: { id },
    data: { name: input.name, slug: input.name && input.name !== existing.name ? await uniqueCategorySlug(input.name, id) : undefined, description: input.description, icon: input.icon === undefined ? undefined : input.icon || null, sortOrder: input.sortOrder, isActive: input.isActive },
  });
  await audit({ user: ctx.user, action: "update", module: "courses", recordType: "CourseCategory", recordId: id, description: `${ctx.user.name} updated course category ${cat.name}`, oldValue: existing, newValue: cat, ip: ctx.ip, userAgent: ctx.userAgent });
  return cat;
}

export async function deleteCategory(id: string, ctx: Ctx) {
  const existing = await db.courseCategory.findUnique({ where: { id }, include: { _count: { select: { courses: { where: { deletedAt: null } } } } } });
  if (!existing) throw Errors.notFound("Category");
  if (existing._count.courses > 0) throw Errors.conflict(`This category has ${existing._count.courses} course(s). Move them to another category first or deactivate the category.`);
  await db.courseCategory.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "courses", recordType: "CourseCategory", recordId: id, description: `${ctx.user.name} deleted course category ${existing.name}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Courses ─────────────────────────────

function serializeCourse<T extends { courseFee: unknown; registrationFee: unknown; examFee: unknown; certificateFee: unknown }>(c: T) {
  return { ...c, courseFee: toNumber(c.courseFee), registrationFee: toNumber(c.registrationFee), examFee: toNumber(c.examFee), certificateFee: toNumber(c.certificateFee) };
}

export async function listCoursesAdmin(q: CourseListQuery) {
  const where: Prisma.CourseWhereInput = { deletedAt: null };
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.status) where.status = { in: q.status.split(",").filter(Boolean) as CourseStatus[] };
  if (q.level) where.level = { in: q.level.split(",").filter(Boolean) as CourseLevel[] };
  if (q.mode) where.mode = { in: q.mode.split(",").filter(Boolean) as CourseMode[] };
  if (q.featured !== undefined) where.isFeatured = q.featured;
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }, { shortDescription: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.sort ? q.order : "asc", ["name", "code", "status", "sortOrder", "createdAt", "courseFee"] as const, "sortOrder");
  const [rows, total] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: [orderBy, { name: "asc" }],
      ...getPaging(q),
      include: { category: { select: { id: true, name: true } }, _count: { select: { centers: true, batches: { where: { deletedAt: null } }, applications: true, admissions: { where: { status: { in: ["ACTIVE", "ON_HOLD"] } } } } } },
    }),
    db.course.count({ where }),
  ]);
  return paged(rows.map(serializeCourse), total, q);
}

/** Active courses for pickers (batches, centers). */
export async function activeCourses(opts: { includeInactive?: boolean } = {}) {
  return db.course.findMany({
    where: { deletedAt: null, ...(opts.includeInactive ? {} : { status: { in: ["ACTIVE", "DRAFT"] } }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, status: true, durationText: true },
  });
}

export async function getCourseAdmin(id: string) {
  const c = await db.course.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      centers: { include: { center: { select: { id: true, code: true, name: true, status: true, isVerified: true, state: { select: { name: true } }, district: { select: { name: true } } } } } },
      batches: { where: { deletedAt: null }, orderBy: { startDate: "desc" }, take: 25, include: { center: { select: { id: true, name: true, code: true } }, trainer: { include: { user: { select: { name: true } } } }, _count: { select: { admissions: { where: { status: { in: ["ACTIVE", "ON_HOLD"] } } } } } } },
      _count: { select: { applications: true, admissions: true, certificates: true, batches: { where: { deletedAt: null } } } },
    },
  });
  if (!c) throw Errors.notFound("Course");
  const [byStatus, activeStudents, completed] = await Promise.all([
    db.application.groupBy({ by: ["status"], where: { courseId: id }, _count: { _all: true } }),
    db.admission.count({ where: { courseId: id, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
    db.admission.count({ where: { courseId: id, status: "COMPLETED" } }),
  ]);
  return { ...serializeCourse(c), stats: { applicationsByStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])), activeStudents, completed } };
}

async function uniqueCourseSlug(name: string, excludeId?: string) {
  let slug = slugify(name) || "course";
  let i = 1;
  while (await db.course.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) slug = `${slugify(name)}-${++i}`;
  return slug;
}

async function validateCategory(categoryId: string | null | undefined) {
  if (!categoryId) return null;
  const cat = await db.courseCategory.findUnique({ where: { id: categoryId } });
  if (!cat) throw Errors.validation("Please correct the highlighted fields.", { categoryId: "Select a valid category" });
  return cat.id;
}

async function validateDocumentKeys(keys: string[]) {
  if (!keys.length) return [];
  const types = await db.documentType.findMany({ where: { key: { in: keys }, appliesTo: "STUDENT" }, select: { key: true } });
  const valid = new Set(types.map((t) => t.key));
  const invalid = keys.filter((k) => !valid.has(k));
  if (invalid.length) throw Errors.validation("Please correct the highlighted fields.", { requiredDocuments: `Unknown document type(s): ${invalid.join(", ")}` });
  return keys;
}

function courseData(input: CourseInput, categoryId: string | null) {
  return {
    name: input.name,
    code: input.code,
    categoryId,
    shortDescription: input.shortDescription || null,
    description: input.description || null,
    image: input.image || null,
    icon: input.icon || null,
    durationText: input.durationText,
    durationWeeks: input.durationWeeks,
    level: input.level,
    mode: input.mode,
    eligibility: input.eligibility || null,
    minAge: typeof input.minAge === "number" ? input.minAge : null,
    maxAge: typeof input.maxAge === "number" ? input.maxAge : null,
    syllabus: (input.syllabus ?? []) as Prisma.InputJsonValue,
    totalClasses: input.totalClasses,
    courseFee: input.courseFee,
    registrationFee: input.registrationFee,
    examFee: input.examFee,
    certificateFee: input.certificateFee,
    scholarshipAvailable: input.scholarshipAvailable,
    scholarshipNote: input.scholarshipNote || null,
    certificateEligibility: input.certificateEligibility || null,
    minAttendancePct: input.minAttendancePct,
    passingMarksPct: input.passingMarksPct,
    requiredDocuments: input.requiredDocuments,
    status: input.status,
    isFeatured: input.isFeatured,
    sortOrder: input.sortOrder,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  };
}

export async function createCourse(input: CourseInput, ctx: Ctx) {
  const dupe = await db.course.findFirst({ where: { code: input.code } });
  if (dupe) throw Errors.validation("Please correct the highlighted fields.", { code: "This course code is already in use" });
  const categoryId = await validateCategory(input.categoryId || null);
  await validateDocumentKeys(input.requiredDocuments);
  const course = await db.course.create({ data: { ...courseData(input, categoryId), slug: await uniqueCourseSlug(input.name) } });
  await audit({ user: ctx.user, action: "create", module: "courses", recordType: "Course", recordId: course.id, description: `${ctx.user.name} created course ${course.code} (${course.name})`, newValue: course, ip: ctx.ip, userAgent: ctx.userAgent });
  return serializeCourse(course);
}

export async function updateCourse(id: string, input: CourseInput, ctx: Ctx) {
  const existing = await db.course.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw Errors.notFound("Course");
  if (input.code !== existing.code) {
    const dupe = await db.course.findFirst({ where: { code: input.code, id: { not: id } } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { code: "This course code is already in use" });
  }
  const categoryId = await validateCategory(input.categoryId || null);
  await validateDocumentKeys(input.requiredDocuments);
  const course = await db.course.update({
    where: { id },
    data: { ...courseData(input, categoryId), slug: input.name !== existing.name ? await uniqueCourseSlug(input.name, id) : undefined },
  });
  await audit({ user: ctx.user, action: "update", module: "courses", recordType: "Course", recordId: id, description: `${ctx.user.name} updated course ${course.code}`, oldValue: existing, newValue: course, ip: ctx.ip, userAgent: ctx.userAgent });
  return serializeCourse(course);
}

export async function setCourseStatus(id: string, status: CourseStatus, ctx: Ctx) {
  const existing = await db.course.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw Errors.notFound("Course");
  const course = await db.course.update({ where: { id }, data: { status } });
  await audit({ user: ctx.user, action: status === "ARCHIVED" ? "archive" : "status", module: "courses", recordType: "Course", recordId: id, description: `${ctx.user.name} set course ${course.code} to ${status}`, oldValue: { status: existing.status }, newValue: { status }, ip: ctx.ip, userAgent: ctx.userAgent });
  return serializeCourse(course);
}

/** Soft-deletes a course. Courses with batches cannot be deleted – archive them instead. */
export async function deleteCourse(id: string, ctx: Ctx) {
  const existing = await db.course.findFirst({ where: { id, deletedAt: null }, include: { _count: { select: { batches: true, applications: true, admissions: true } } } });
  if (!existing) throw Errors.notFound("Course");
  if (existing._count.batches > 0 || existing._count.admissions > 0 || existing._count.applications > 0) {
    throw Errors.conflict(`This course has ${existing._count.batches} batch(es) and ${existing._count.applications} application(s). Archive it instead of deleting.`);
  }
  await db.$transaction([
    db.centerCourse.deleteMany({ where: { courseId: id } }),
    db.course.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED" } }),
  ]);
  await audit({ user: ctx.user, action: "delete", module: "courses", recordType: "Course", recordId: id, description: `${ctx.user.name} deleted course ${existing.code}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function studentDocumentTypes() {
  return db.documentType.findMany({ where: { appliesTo: "STUDENT", isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { key: true, name: true, isRequired: true, description: true } });
}
