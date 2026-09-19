import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/session";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac/permissions";
import { CMS_ICONS, CMS_SECTIONS, getSectionDef, mergeSectionData, type CmsAnyField, type CmsField, type CmsSectionDef } from "@/lib/cms/sections";
import { saveSection } from "@/lib/cms";
import { slugify } from "@/lib/utils";
import { optionalString, slugSchema, uuid } from "@/lib/validation/common";
import { paginationSchema, getPaging, buildOrderBy, paged } from "@/lib/api/query";

export interface Ctx {
  user: AuthUser;
  ip?: string | null;
  userAgent?: string | null;
}

/** Throws 403 when a change would publish/unpublish content and the actor lacks cms.publish. */
export function assertCanPublish(user: AuthUser, changesPublishState: boolean) {
  if (changesPublishState && !hasPermission(user, "cms.publish")) {
    throw Errors.forbidden("Publishing or unpublishing content requires the 'Publish Website Content' permission.");
  }
}

// ───────────────────────────── Sections ─────────────────────────────

export async function listSectionsWithState() {
  const rows = await db.cmsSection.findMany({ select: { key: true, updatedAt: true, updatedById: true } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const actorIds = [...new Set(rows.map((r) => r.updatedById).filter((v): v is string => !!v))];
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  return CMS_SECTIONS.map((def) => {
    const saved = byKey.get(def.key);
    return {
      key: def.key,
      name: def.name,
      page: def.page,
      description: def.description,
      fieldCount: def.fields.length,
      customised: !!saved,
      updatedAt: saved?.updatedAt ?? null,
      updatedBy: saved?.updatedById ? (actorName.get(saved.updatedById) ?? null) : null,
    };
  });
}

export async function getSectionForEdit(key: string) {
  const def = getSectionDef(key);
  if (!def) throw Errors.notFound("CMS section");
  const row = await db.cmsSection.findUnique({ where: { key } });
  return { def, data: mergeSectionData(def, row?.data), customised: !!row, updatedAt: row?.updatedAt ?? null };
}

const isSafeUrl = (v: string) => v === "" || v.startsWith("/") || v.startsWith("#") || /^https?:\/\//i.test(v) || /^mailto:/i.test(v) || /^tel:/i.test(v);

function validateScalar(field: CmsField, raw: unknown, path: string, errors: Record<string, string>): unknown {
  switch (field.type) {
    case "number": {
      if (raw === "" || raw === null || raw === undefined) return 0;
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) errors[path] = "Enter a valid number";
      return Number.isFinite(n) ? n : 0;
    }
    case "boolean":
      return raw === true || raw === "true" || raw === "on" || raw === 1 || raw === "1";
    case "icon": {
      const s = raw == null ? "" : String(raw).trim();
      if (s && !(CMS_ICONS as readonly string[]).includes(s)) errors[path] = "Choose an icon from the list";
      return s;
    }
    case "url": {
      const s = raw == null ? "" : String(raw).trim();
      if (!isSafeUrl(s)) errors[path] = "Enter a relative path (/page) or a full http(s) link";
      return s.slice(0, 500);
    }
    case "image": {
      const s = raw == null ? "" : String(raw).trim();
      if (s && !isSafeUrl(s)) errors[path] = "Upload an image or paste a valid image URL";
      return s.slice(0, 500);
    }
    case "text":
      return (raw == null ? "" : String(raw)).slice(0, 500);
    case "textarea":
    default:
      return (raw == null ? "" : String(raw)).slice(0, 5000);
  }
}

/** Validates a section payload against its registry definition. Unknown keys are dropped. */
export function validateSectionData(def: CmsSectionDef, raw: unknown): Record<string, unknown> {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};
  const out: Record<string, unknown> = {};
  for (const field of def.fields as CmsAnyField[]) {
    if (field.type === "list") {
      const list = Array.isArray(input[field.key]) ? (input[field.key] as unknown[]) : [];
      if (field.max && list.length > field.max) errors[field.key] = `At most ${field.max} items are allowed`;
      out[field.key] = list.slice(0, field.max ?? 50).map((item, i) => {
        const obj = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const o: Record<string, unknown> = {};
        for (const f of field.itemFields) o[f.key] = validateScalar(f, obj[f.key], `${field.key}.${i}.${f.key}`, errors);
        return o;
      });
    } else {
      out[field.key] = validateScalar(field, input[field.key], field.key, errors);
    }
  }
  if (Object.keys(errors).length) throw Errors.validation("Please correct the highlighted fields.", errors);
  return out;
}

export async function saveSectionAdmin(key: string, raw: unknown, ctx: Ctx) {
  const def = getSectionDef(key);
  if (!def) throw Errors.notFound("CMS section");
  const data = validateSectionData(def, raw);
  const before = await db.cmsSection.findUnique({ where: { key } });
  const row = await saveSection(key, data, ctx.user.id);
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "CmsSection", recordId: row.id, description: `${ctx.user.name} updated website section "${def.name}" (${def.page})`, oldValue: before?.data ?? null, newValue: data, ip: ctx.ip, userAgent: ctx.userAgent });
  return { key, data: mergeSectionData(def, data), updatedAt: row.updatedAt };
}

export async function resetSectionAdmin(key: string, ctx: Ctx) {
  const def = getSectionDef(key);
  if (!def) throw Errors.notFound("CMS section");
  const before = await db.cmsSection.findUnique({ where: { key } });
  if (before) await db.cmsSection.delete({ where: { key } });
  await audit({ user: ctx.user, action: "reset", module: "cms", recordType: "CmsSection", recordId: before?.id ?? key, description: `${ctx.user.name} reset website section "${def.name}" to defaults`, oldValue: before?.data ?? null, ip: ctx.ip, userAgent: ctx.userAgent });
  return { key, data: def.defaults };
}

// ───────────────────────────── Pages ─────────────────────────────

/** Slugs the public website links to directly. They can be edited but never renamed or deleted. */
export const FIXED_PAGE_SLUGS = ["about", "scholarship", "volunteer", "donate", "contact", "privacy-policy", "terms", "refund-policy", "disclaimer"] as const;
export const isFixedPageSlug = (slug: string) => (FIXED_PAGE_SLUGS as readonly string[]).includes(slug);

export const cmsPageSchema = z.object({
  title: z.string().trim().min(2, "Enter a title").max(200),
  slug: z.union([z.literal(""), slugSchema]).optional().nullable(),
  excerpt: z.string().trim().max(500).optional().nullable(),
  content: z.string().min(1, "Write the page content").max(100_000),
  seoTitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(400).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
});
export type CmsPageInput = z.infer<typeof cmsPageSchema>;

export const cmsPageListSchema = paginationSchema.extend({ status: z.string().optional() });

export async function listCmsPages(q: z.infer<typeof cmsPageListSchema>) {
  const where: Prisma.CmsPageWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",") as Prisma.EnumContentStatusFilter["in"] };
  if (q.q) where.OR = [{ title: { contains: q.q, mode: "insensitive" } }, { slug: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["updatedAt", "title", "slug", "status"] as const, "updatedAt");
  const [items, total] = await Promise.all([db.cmsPage.findMany({ where, orderBy, ...getPaging(q) }), db.cmsPage.count({ where })]);
  return paged(items.map((p) => ({ ...p, isFixed: isFixedPageSlug(p.slug) })), total, q);
}

export async function getCmsPage(id: string) {
  const page = await db.cmsPage.findUnique({ where: { id } });
  if (!page) throw Errors.notFound("Page");
  return { ...page, isFixed: isFixedPageSlug(page.slug) };
}

async function uniqueSlug(model: "cmsPage" | "program" | "blog" | "event" | "campaign", base: string, excludeId?: string) {
  const root = slugify(base) || "item";
  let slug = root;
  let i = 1;
  const exists = async (s: string) => {
    const where = { slug: s, ...(excludeId ? { id: { not: excludeId } } : {}) };
    switch (model) {
      case "cmsPage":
        return db.cmsPage.findFirst({ where, select: { id: true } });
      case "program":
        return db.program.findFirst({ where, select: { id: true } });
      case "blog":
        return db.blog.findFirst({ where, select: { id: true } });
      case "event":
        return db.event.findFirst({ where, select: { id: true } });
      case "campaign":
        return db.campaign.findFirst({ where, select: { id: true } });
    }
  };
  while (await exists(slug)) slug = `${root}-${++i}`;
  return slug;
}
export { uniqueSlug as uniqueContentSlug };

export async function createCmsPage(input: CmsPageInput, ctx: Ctx) {
  assertCanPublish(ctx.user, input.status === "PUBLISHED");
  const slug = await uniqueSlug("cmsPage", input.slug || input.title);
  const page = await db.cmsPage.create({ data: { title: input.title, slug, excerpt: input.excerpt || null, content: input.content, seoTitle: input.seoTitle || null, seoDescription: input.seoDescription || null, status: input.status, updatedById: ctx.user.id } });
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "CmsPage", recordId: page.id, description: `${ctx.user.name} created page "${page.title}" (/${page.slug})`, newValue: page, ip: ctx.ip, userAgent: ctx.userAgent });
  return page;
}

export async function updateCmsPage(id: string, input: CmsPageInput, ctx: Ctx) {
  const existing = await db.cmsPage.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Page");
  assertCanPublish(ctx.user, input.status !== existing.status);
  let slug = existing.slug;
  if (!isFixedPageSlug(existing.slug) && input.slug && input.slug !== existing.slug) slug = await uniqueSlug("cmsPage", input.slug, id);
  const page = await db.cmsPage.update({ where: { id }, data: { title: input.title, slug, excerpt: input.excerpt || null, content: input.content, seoTitle: input.seoTitle || null, seoDescription: input.seoDescription || null, status: input.status, updatedById: ctx.user.id } });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "CmsPage", recordId: id, description: `${ctx.user.name} updated page "${page.title}" (/${page.slug})`, oldValue: existing, newValue: page, ip: ctx.ip, userAgent: ctx.userAgent });
  return page;
}

export async function deleteCmsPage(id: string, ctx: Ctx) {
  const existing = await db.cmsPage.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Page");
  if (isFixedPageSlug(existing.slug)) throw Errors.badRequest("This page is linked from the website and cannot be deleted. Set it to Draft instead.");
  await db.cmsPage.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "CmsPage", recordId: id, description: `${ctx.user.name} deleted page "${existing.title}" (/${existing.slug})`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Programs ─────────────────────────────

export const programSchema = z.object({
  title: z.string().trim().min(2, "Enter a title").max(150),
  slug: z.union([z.literal(""), slugSchema]).optional().nullable(),
  icon: z.union([z.literal(""), z.enum(CMS_ICONS)]).optional().nullable(),
  summary: z.string().trim().min(10, "Write a short summary (10+ characters)").max(500),
  content: z.string().max(50_000).optional().nullable(),
  image: optionalString,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
});
export type ProgramInput = z.infer<typeof programSchema>;

export async function listPrograms() {
  return db.program.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
}

export async function createProgram(input: ProgramInput, ctx: Ctx) {
  const slug = await uniqueSlug("program", input.slug || input.title);
  const max = await db.program.aggregate({ _max: { sortOrder: true } });
  const program = await db.program.create({ data: { title: input.title, slug, icon: input.icon || null, summary: input.summary, content: input.content || null, image: input.image || null, sortOrder: input.sortOrder || (max._max.sortOrder ?? 0) + 1, isActive: input.isActive } });
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "Program", recordId: program.id, description: `${ctx.user.name} created program "${program.title}"`, newValue: program, ip: ctx.ip, userAgent: ctx.userAgent });
  return program;
}

export async function updateProgram(id: string, input: ProgramInput, ctx: Ctx) {
  const existing = await db.program.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Program");
  const slug = input.slug && input.slug !== existing.slug ? await uniqueSlug("program", input.slug, id) : existing.slug;
  const program = await db.program.update({ where: { id }, data: { title: input.title, slug, icon: input.icon || null, summary: input.summary, content: input.content || null, image: input.image || null, sortOrder: input.sortOrder, isActive: input.isActive } });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "Program", recordId: id, description: `${ctx.user.name} updated program "${program.title}"`, oldValue: existing, newValue: program, ip: ctx.ip, userAgent: ctx.userAgent });
  return program;
}

export async function deleteProgram(id: string, ctx: Ctx) {
  const existing = await db.program.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Program");
  await db.program.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "Program", recordId: id, description: `${ctx.user.name} deleted program "${existing.title}"`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

export const reorderSchema = z.object({ ids: z.array(uuid).min(1).max(500) });

export async function reorderPrograms(ids: string[], ctx: Ctx) {
  await db.$transaction(ids.map((id, i) => db.program.update({ where: { id }, data: { sortOrder: i + 1 } })));
  await audit({ user: ctx.user, action: "reorder", module: "cms", recordType: "Program", description: `${ctx.user.name} reordered programs`, newValue: { ids }, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Success stories ─────────────────────────────

export const storySchema = z.object({
  studentName: z.string().trim().min(2, "Enter the student's name").max(120),
  photoUrl: optionalString,
  courseId: z.union([z.literal(""), uuid]).optional().nullable(),
  courseName: z.string().trim().max(150).optional().nullable(),
  centerId: z.union([z.literal(""), uuid]).optional().nullable(),
  centerName: z.string().trim().max(150).optional().nullable(),
  location: z.string().trim().max(150).optional().nullable(),
  story: z.string().trim().min(20, "Write the story (20+ characters)").max(5000),
  achievement: z.string().trim().max(300).optional().nullable(),
  isPublished: z.coerce.boolean().default(false),
  isFeatured: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type StoryInput = z.infer<typeof storySchema>;

export async function listStories() {
  return db.successStory.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], include: { course: { select: { id: true, name: true } }, center: { select: { id: true, name: true, code: true } } } });
}

async function resolveStoryRefs(input: StoryInput) {
  const errors: Record<string, string> = {};
  let courseName = input.courseName || null;
  let centerName = input.centerName || null;
  if (input.courseId) {
    const c = await db.course.findFirst({ where: { id: input.courseId, deletedAt: null }, select: { name: true } });
    if (!c) errors.courseId = "Select a valid course";
    else courseName = courseName || c.name;
  }
  if (input.centerId) {
    const c = await db.center.findFirst({ where: { id: input.centerId, deletedAt: null }, select: { name: true } });
    if (!c) errors.centerId = "Select a valid training center";
    else centerName = centerName || c.name;
  }
  if (Object.keys(errors).length) throw Errors.validation("Please correct the highlighted fields.", errors);
  return { courseName, centerName };
}

export async function createStory(input: StoryInput, ctx: Ctx) {
  assertCanPublish(ctx.user, input.isPublished);
  const refs = await resolveStoryRefs(input);
  const story = await db.successStory.create({ data: { studentName: input.studentName, photoUrl: input.photoUrl || null, courseId: input.courseId || null, courseName: refs.courseName, centerId: input.centerId || null, centerName: refs.centerName, location: input.location || null, story: input.story, achievement: input.achievement || null, isPublished: input.isPublished, isFeatured: input.isFeatured, sortOrder: input.sortOrder } });
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "SuccessStory", recordId: story.id, description: `${ctx.user.name} added success story of ${story.studentName}`, newValue: story, ip: ctx.ip, userAgent: ctx.userAgent });
  return story;
}

export async function updateStory(id: string, input: StoryInput, ctx: Ctx) {
  const existing = await db.successStory.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Success story");
  assertCanPublish(ctx.user, input.isPublished !== existing.isPublished);
  const refs = await resolveStoryRefs(input);
  const story = await db.successStory.update({ where: { id }, data: { studentName: input.studentName, photoUrl: input.photoUrl || null, courseId: input.courseId || null, courseName: refs.courseName, centerId: input.centerId || null, centerName: refs.centerName, location: input.location || null, story: input.story, achievement: input.achievement || null, isPublished: input.isPublished, isFeatured: input.isFeatured, sortOrder: input.sortOrder } });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "SuccessStory", recordId: id, description: `${ctx.user.name} updated success story of ${story.studentName}`, oldValue: existing, newValue: story, ip: ctx.ip, userAgent: ctx.userAgent });
  return story;
}

export async function deleteStory(id: string, ctx: Ctx) {
  const existing = await db.successStory.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Success story");
  await db.successStory.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "SuccessStory", recordId: id, description: `${ctx.user.name} deleted success story of ${existing.studentName}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Partners ─────────────────────────────

export const partnerSchema = z.object({
  name: z.string().trim().min(2, "Enter the partner name").max(150),
  logoUrl: z.string().trim().min(1, "Upload a logo").max(500),
  website: z.union([z.literal(""), z.string().trim().url("Enter a full URL, e.g. https://example.org").max(300)]).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
});
export type PartnerInput = z.infer<typeof partnerSchema>;

export async function listPartners() {
  return db.partner.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function createPartner(input: PartnerInput, ctx: Ctx) {
  const max = await db.partner.aggregate({ _max: { sortOrder: true } });
  const partner = await db.partner.create({ data: { name: input.name, logoUrl: input.logoUrl, website: input.website || null, sortOrder: input.sortOrder || (max._max.sortOrder ?? 0) + 1, isActive: input.isActive } });
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "Partner", recordId: partner.id, description: `${ctx.user.name} added partner "${partner.name}"`, newValue: partner, ip: ctx.ip, userAgent: ctx.userAgent });
  return partner;
}

export async function updatePartner(id: string, input: PartnerInput, ctx: Ctx) {
  const existing = await db.partner.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Partner");
  const partner = await db.partner.update({ where: { id }, data: { name: input.name, logoUrl: input.logoUrl, website: input.website || null, sortOrder: input.sortOrder, isActive: input.isActive } });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "Partner", recordId: id, description: `${ctx.user.name} updated partner "${partner.name}"`, oldValue: existing, newValue: partner, ip: ctx.ip, userAgent: ctx.userAgent });
  return partner;
}

export async function deletePartner(id: string, ctx: Ctx) {
  const existing = await db.partner.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Partner");
  await db.partner.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "Partner", recordId: id, description: `${ctx.user.name} deleted partner "${existing.name}"`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

/** Options for pickers in CMS forms (active courses and centers). */
export async function cmsPickerOptions() {
  const [courses, centers] = await Promise.all([
    db.course.findMany({ where: { deletedAt: null, status: { in: ["ACTIVE", "INACTIVE"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, status: true } }),
    db.center.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, status: true } }),
  ]);
  return { courses, centers };
}
