import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { ContentStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { optionalString, slugSchema, uuid } from "@/lib/validation/common";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid } from "@/lib/api/query";
import { assertCanPublish, uniqueContentSlug, type Ctx } from "@/server/cms-admin";

export type { Ctx };

/** Accepts `datetime-local` values (YYYY-MM-DDTHH:mm) or ISO strings. */
const dateTimeInput = z
  .string()
  .trim()
  .min(1, "Required")
  .transform((v, ctx) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date & time" });
      return z.NEVER;
    }
    return d;
  });
const optionalDateTimeInput = z.union([z.literal(""), dateTimeInput]).optional().nullable().transform((v) => (v ? v : null));

const contentStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

// ───────────────────────────── Gallery ─────────────────────────────

export const galleryCreateSchema = z.object({
  items: z.array(z.object({ imageUrl: z.string().trim().min(1).max(500), title: z.string().trim().max(150).optional().nullable() })).min(1, "Upload at least one image").max(30),
  title: z.string().trim().max(150).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  centerId: z.union([z.literal(""), uuid]).optional().nullable(),
  isPublished: z.coerce.boolean().default(true),
});
export const galleryUpdateSchema = z.object({
  title: z.string().trim().max(150).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  centerId: z.union([z.literal(""), uuid]).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isPublished: z.coerce.boolean().default(true),
});
export const galleryListSchema = paginationSchema.extend({ category: z.string().trim().max(60).optional(), centerId: optionalUuid, published: z.enum(["true", "false"]).optional() });

export async function listGallery(q: z.infer<typeof galleryListSchema>) {
  const where: Prisma.GalleryItemWhereInput = {};
  if (q.category) where.category = q.category;
  if (q.centerId) where.centerId = q.centerId;
  if (q.published) where.isPublished = q.published === "true";
  if (q.q) where.OR = [{ title: { contains: q.q, mode: "insensitive" } }, { category: { contains: q.q, mode: "insensitive" } }];
  const [items, total, categories] = await Promise.all([
    db.galleryItem.findMany({ where, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], ...getPaging(q), include: { center: { select: { id: true, name: true, code: true } } } }),
    db.galleryItem.count({ where }),
    db.galleryItem.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
  ]);
  return { ...paged(items, total, q), categories: categories.map((c) => c.category!).filter(Boolean) };
}

export async function createGalleryItems(input: z.infer<typeof galleryCreateSchema>, ctx: Ctx) {
  assertCanPublish(ctx.user, input.isPublished);
  if (input.centerId) {
    const c = await db.center.findFirst({ where: { id: input.centerId, deletedAt: null }, select: { id: true } });
    if (!c) throw Errors.validation("Please correct the highlighted fields.", { centerId: "Select a valid training center" });
  }
  const max = await db.galleryItem.aggregate({ _max: { sortOrder: true } });
  const base = (max._max.sortOrder ?? 0) + 1;
  const created = await db.$transaction(
    input.items.map((it, i) =>
      db.galleryItem.create({ data: { imageUrl: it.imageUrl, title: it.title || input.title || null, category: input.category || null, centerId: input.centerId || null, sortOrder: base + i, isPublished: input.isPublished } })
    )
  );
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "GalleryItem", recordId: created[0]?.id ?? null, description: `${ctx.user.name} added ${created.length} gallery image${created.length === 1 ? "" : "s"}${input.category ? ` (${input.category})` : ""}`, newValue: { ids: created.map((c) => c.id), category: input.category, centerId: input.centerId }, ip: ctx.ip, userAgent: ctx.userAgent });
  return created;
}

export async function updateGalleryItem(id: string, input: z.infer<typeof galleryUpdateSchema>, ctx: Ctx) {
  const existing = await db.galleryItem.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Gallery image");
  assertCanPublish(ctx.user, input.isPublished !== existing.isPublished);
  const item = await db.galleryItem.update({ where: { id }, data: { title: input.title || null, category: input.category || null, centerId: input.centerId || null, sortOrder: input.sortOrder, isPublished: input.isPublished } });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "GalleryItem", recordId: id, description: `${ctx.user.name} updated gallery image${item.title ? ` "${item.title}"` : ""}`, oldValue: existing, newValue: item, ip: ctx.ip, userAgent: ctx.userAgent });
  return item;
}

export async function deleteGalleryItem(id: string, ctx: Ctx) {
  const existing = await db.galleryItem.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Gallery image");
  await db.galleryItem.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "GalleryItem", recordId: id, description: `${ctx.user.name} deleted gallery image${existing.title ? ` "${existing.title}"` : ""}`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Events ─────────────────────────────

export const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a title").max(200),
    slug: z.union([z.literal(""), slugSchema]).optional().nullable(),
    summary: z.string().trim().max(500).optional().nullable(),
    content: z.string().max(100_000).optional().nullable(),
    image: optionalString,
    startAt: dateTimeInput,
    endAt: optionalDateTimeInput,
    location: z.string().trim().max(200).optional().nullable(),
    stateId: z.union([z.literal(""), uuid]).optional().nullable(),
    districtId: z.union([z.literal(""), uuid]).optional().nullable(),
    registrationUrl: z.union([z.literal(""), z.string().trim().url("Enter a full URL, e.g. https://forms.example.org").max(500)]).optional().nullable(),
    status: contentStatus.default("DRAFT"),
  })
  .superRefine((d, ctx) => {
    if (d.endAt && d.endAt < d.startAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "End must be after the start" });
    if (d.districtId && !d.stateId) ctx.addIssue({ code: "custom", path: ["stateId"], message: "Select the state first" });
  });
export type EventInput = z.infer<typeof eventSchema>;
export const eventListSchema = paginationSchema.extend({ status: z.string().optional(), when: z.enum(["upcoming", "past"]).optional() });

export async function listEvents(q: z.infer<typeof eventListSchema>) {
  const where: Prisma.EventWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",") as ContentStatus[] };
  if (q.when === "upcoming") where.startAt = { gte: new Date() };
  if (q.when === "past") where.startAt = { lt: new Date() };
  if (q.q) where.OR = [{ title: { contains: q.q, mode: "insensitive" } }, { location: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["startAt", "title", "status", "updatedAt"] as const, "startAt");
  const [items, total] = await Promise.all([
    db.event.findMany({ where, orderBy, ...getPaging(q), include: { state: { select: { id: true, name: true } }, district: { select: { id: true, name: true } } } }),
    db.event.count({ where }),
  ]);
  return paged(items, total, q);
}

async function validateEventLocation(input: EventInput) {
  if (input.stateId) {
    const s = await db.state.findUnique({ where: { id: input.stateId }, select: { id: true } });
    if (!s) throw Errors.validation("Please correct the highlighted fields.", { stateId: "Select a valid state" });
  }
  if (input.districtId) {
    const d = await db.district.findFirst({ where: { id: input.districtId, stateId: input.stateId || undefined }, select: { id: true } });
    if (!d) throw Errors.validation("Please correct the highlighted fields.", { districtId: "Select a district within the chosen state" });
  }
}

function eventData(input: EventInput, slug: string) {
  return { title: input.title, slug, summary: input.summary || null, content: input.content || null, image: input.image || null, startAt: input.startAt, endAt: input.endAt, location: input.location || null, stateId: input.stateId || null, districtId: input.districtId || null, registrationUrl: input.registrationUrl || null, status: input.status };
}

export async function createEvent(input: EventInput, ctx: Ctx) {
  assertCanPublish(ctx.user, input.status === "PUBLISHED");
  await validateEventLocation(input);
  const slug = await uniqueContentSlug("event", input.slug || input.title);
  const event = await db.event.create({ data: eventData(input, slug) });
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "Event", recordId: event.id, description: `${ctx.user.name} created event "${event.title}"`, newValue: { ...event, content: undefined }, ip: ctx.ip, userAgent: ctx.userAgent });
  return event;
}

export async function updateEvent(id: string, input: EventInput, ctx: Ctx) {
  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Event");
  assertCanPublish(ctx.user, input.status !== existing.status);
  await validateEventLocation(input);
  const slug = input.slug && input.slug !== existing.slug ? await uniqueContentSlug("event", input.slug, id) : existing.slug;
  const event = await db.event.update({ where: { id }, data: eventData(input, slug) });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "Event", recordId: id, description: `${ctx.user.name} updated event "${event.title}"`, oldValue: { ...existing, content: undefined }, newValue: { ...event, content: undefined }, ip: ctx.ip, userAgent: ctx.userAgent });
  return event;
}

export async function deleteEvent(id: string, ctx: Ctx) {
  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Event");
  await db.event.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "Event", recordId: id, description: `${ctx.user.name} deleted event "${existing.title}"`, oldValue: { ...existing, content: undefined }, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── FAQs ─────────────────────────────

export const faqSchema = z.object({
  question: z.string().trim().min(5, "Enter the question").max(300),
  answer: z.string().trim().min(5, "Enter the answer").max(5000),
  category: z.string().trim().max(60).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isPublished: z.coerce.boolean().default(true),
});
export type FaqInput = z.infer<typeof faqSchema>;

export async function listFaqs() {
  const items = await db.faq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const categories = [...new Set(items.map((f) => f.category).filter((c): c is string => !!c))].sort();
  return { items, categories };
}

export async function createFaq(input: FaqInput, ctx: Ctx) {
  assertCanPublish(ctx.user, input.isPublished);
  const max = await db.faq.aggregate({ _max: { sortOrder: true } });
  const faq = await db.faq.create({ data: { question: input.question, answer: input.answer, category: input.category || null, sortOrder: input.sortOrder || (max._max.sortOrder ?? 0) + 1, isPublished: input.isPublished } });
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "Faq", recordId: faq.id, description: `${ctx.user.name} added FAQ "${faq.question}"`, newValue: faq, ip: ctx.ip, userAgent: ctx.userAgent });
  return faq;
}

export async function updateFaq(id: string, input: FaqInput, ctx: Ctx) {
  const existing = await db.faq.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("FAQ");
  assertCanPublish(ctx.user, input.isPublished !== existing.isPublished);
  const faq = await db.faq.update({ where: { id }, data: { question: input.question, answer: input.answer, category: input.category || null, sortOrder: input.sortOrder, isPublished: input.isPublished } });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "Faq", recordId: id, description: `${ctx.user.name} updated FAQ "${faq.question}"`, oldValue: existing, newValue: faq, ip: ctx.ip, userAgent: ctx.userAgent });
  return faq;
}

export async function deleteFaq(id: string, ctx: Ctx) {
  const existing = await db.faq.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("FAQ");
  await db.faq.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "Faq", recordId: id, description: `${ctx.user.name} deleted FAQ "${existing.question}"`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function reorderFaqs(ids: string[], ctx: Ctx) {
  await db.$transaction(ids.map((id, i) => db.faq.update({ where: { id }, data: { sortOrder: i + 1 } })));
  await audit({ user: ctx.user, action: "reorder", module: "cms", recordType: "Faq", description: `${ctx.user.name} reordered FAQs`, newValue: { ids }, ip: ctx.ip, userAgent: ctx.userAgent });
}
