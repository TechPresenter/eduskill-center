import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import type { ContentStatus } from "@/generated/prisma/enums";
import type { BadgeTone } from "@/components/ui/badge";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { formatDateTime } from "@/lib/utils";
import { optionalEmail, slugSchema, stringList, uuid } from "@/lib/validation/common";
import { paginationSchema, getPaging, buildOrderBy, paged, optionalUuid, optionalBool } from "@/lib/api/query";
import { assertCanPublish, uniqueContentSlug, type Ctx } from "@/server/cms-admin";
import { markdownWordCount, readingMinutes } from "@/lib/blog/markdown";
import { displayStatus, isScheduled, livePostWhere } from "@/lib/blog/visibility";

/**
 * Admin-side blog service: posts, categories, authors and the tag lookup table.
 *
 * Lifted out of `src/server/content.ts` (which still owns gallery, events, FAQs) because the
 * blog is no longer a 60-line CRUD block — it now carries scheduling rules, three taxonomies
 * and a tag table that has to be kept in step with the `Blog.tags` array on every save.
 *
 * PUBLIC READS DO NOT BELONG HERE. Everything a visitor sees goes through
 * `src/server/blog-public.ts`, which starts every query from `livePostWhere()`. This file is
 * reached only from `/admin/**` pages and `/api/admin/**` routes, so it deliberately returns
 * drafts, archived and future-dated posts: that is what an editor is here to manage.
 */

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

/**
 * An uploaded path (`/blog/…`) or an https URL — never `http:`, never `data:`.
 * The cover is rendered through `next/image`, and a `data:` URI would both defeat the image
 * optimiser and let an editor paste an arbitrary payload into a public page.
 */
const imageUrl = z
  .union([z.literal(""), z.string().trim().max(500).regex(/^(\/|https:\/\/)/, "Upload an image or paste an https:// address")])
  .optional()
  .nullable();

const optionalUrl = z.union([z.literal(""), z.string().trim().url("Enter a full URL, e.g. https://example.org").max(500)]).optional().nullable();

/**
 * Mirrors `BadgeTone` so a category chip can be tinted with an existing token instead of new
 * CSS. The type-only import is erased at build time, so `satisfies` gives us compile-time
 * drift protection without pulling a React module into the service layer.
 */
const CATEGORY_TONES = ["neutral", "navy", "orange", "success", "warning", "danger", "info"] as const satisfies readonly BadgeTone[];

// ───────────────────────────── Posts ─────────────────────────────

export const blogSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a title").max(200),
    slug: z.union([z.literal(""), slugSchema]).optional().nullable(),
    excerpt: z.string().trim().max(500).optional().nullable(),
    content: z.string().min(20, "Write the post content (20+ characters)").max(200_000),
    coverImage: imageUrl,
    coverImageAlt: z.string().trim().max(200).optional().nullable(),
    authorName: z.string().trim().max(120).optional().nullable(),
    authorId: z.union([z.literal(""), uuid]).optional().nullable(),
    categoryId: z.union([z.literal(""), uuid]).optional().nullable(),
    tags: stringList.default([]),
    status: contentStatus.default("DRAFT"),
    publishedAt: optionalDateTimeInput,
    isFeatured: z.coerce.boolean().default(false),
    relatedPostIds: z.array(uuid).max(3, "Pin at most 3 related articles").default([]),
    seoTitle: z.string().trim().max(200).optional().nullable(),
    seoDescription: z.string().trim().max(400).optional().nullable(),
    canonicalUrl: optionalUrl,
    ogImage: imageUrl,
    noIndex: z.coerce.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    // A cover with no alt text is the single most common accessibility regression on a blog,
    // and it is invisible to the person who introduced it. Fail the save instead.
    if (d.coverImage && !d.coverImageAlt) ctx.addIssue({ code: "custom", path: ["coverImageAlt"], message: "Describe the image for screen readers" });
    if (new Set(d.relatedPostIds).size !== d.relatedPostIds.length) ctx.addIssue({ code: "custom", path: ["relatedPostIds"], message: "The same article is pinned twice" });
  });
export type BlogInput = z.infer<typeof blogSchema>;

export const blogListSchema = paginationSchema.extend({
  status: z.string().optional(),
  tag: z.string().trim().max(60).optional(),
  categoryId: optionalUuid,
  authorId: optionalUuid,
  featured: optionalBool,
});
export type BlogListQuery = z.infer<typeof blogListSchema>;

export async function listBlogs(q: BlogListQuery) {
  const where: Prisma.BlogWhereInput = {};
  if (q.tag) where.tags = { has: q.tag };
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.authorId) where.authorId = q.authorId;
  if (q.featured !== undefined) where.isFeatured = q.featured;
  if (q.q)
    where.OR = [
      { title: { contains: q.q, mode: "insensitive" } },
      { slug: { contains: q.q, mode: "insensitive" } },
      { authorName: { contains: q.q, mode: "insensitive" } },
      { author: { name: { contains: q.q, mode: "insensitive" } } },
      { category: { name: { contains: q.q, mode: "insensitive" } } },
    ];

  // `status` carries two pseudo-values the database has never heard of. SCHEDULED and LIVE are
  // the two halves of PUBLISHED either side of `publishedAt`, which is how an editor actually
  // thinks about the list ("what is out?" / "what is queued?"). Everything else is validated
  // against the enum rather than cast — the old `as ContentStatus[]` let `?status=x` reach
  // Postgres and blow up with a 500 instead of simply matching nothing.
  const raw = (q.status ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const real = raw.filter((s): s is ContentStatus => s === "DRAFT" || s === "PUBLISHED" || s === "ARCHIVED");
  const ors: Prisma.BlogWhereInput[] = [];
  if (real.length) ors.push({ status: { in: real } });
  if (raw.includes("SCHEDULED")) ors.push({ status: "PUBLISHED", publishedAt: { gt: new Date() } });
  if (raw.includes("LIVE")) ors.push(livePostWhere());
  if (ors.length) where.AND = [{ OR: ors }];

  const orderBy = buildOrderBy(q.sort, q.order, ["updatedAt", "createdAt", "publishedAt", "title", "status", "readingMinutes"] as const, "updatedAt");
  const [items, total] = await Promise.all([
    db.blog.findMany({
      where,
      orderBy,
      ...getPaging(q),
      // `content` stays out: a list of 20 posts would otherwise drag up to 4 MB of markdown
      // across the wire to render cards that never show a word of it.
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        authorName: true,
        tags: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
        coverImage: true,
        coverImageAlt: true,
        isFeatured: true,
        readingMinutes: true,
        noIndex: true,
        category: { select: { id: true, name: true, slug: true, colorTone: true } },
        author: { select: { id: true, name: true, slug: true, avatar: true } },
      },
    }),
    db.blog.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getBlog(id: string) {
  const blog = await db.blog.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, slug: true } }, author: { select: { id: true, name: true, slug: true, avatar: true } } },
  });
  if (!blog) throw Errors.notFound("Blog post");
  return blog;
}

/** "published" · "scheduled for 12 Oct 2026, 09:00 AM" · "draft" · "archived" — for audit copy. */
function statusPhrase(post: { status: ContentStatus; publishedAt: Date | null }) {
  return isScheduled(post) ? `scheduled for ${formatDateTime(post.publishedAt)}` : displayStatus(post).toLowerCase();
}

function blogData(input: BlogInput, slug: string, tags: string[], existing?: { publishedAt: Date | null; status: ContentStatus }) {
  /**
   * THE scheduling rule, and the whole of it.
   *
   * PUBLISHED keeps whatever date the editor chose (a future one = scheduled), falls back to
   * the date it already had, and only stamps `now()` for a post that has never been published.
   * DRAFT and ARCHIVED take the submitted date or NOTHING — the old code fell back to
   * `existing?.publishedAt`, which meant a date could be set but never cleared: unpublishing
   * and re-publishing silently resurrected the original timestamp.
   */
  const publishedAt =
    input.status === "PUBLISHED"
      ? (input.publishedAt ?? existing?.publishedAt ?? new Date())
      : (input.publishedAt ?? null);

  return {
    title: input.title,
    slug,
    excerpt: input.excerpt || null,
    content: input.content,
    coverImage: input.coverImage || null,
    // Alt text belongs to the image it describes; keeping it after the cover is removed would
    // re-attach a stale description to whatever is uploaded next.
    coverImageAlt: input.coverImage ? input.coverImageAlt || null : null,
    authorName: input.authorName || null,
    authorId: input.authorId || null,
    categoryId: input.categoryId || null,
    tags,
    status: input.status,
    publishedAt,
    isFeatured: input.isFeatured,
    // Measured once here rather than on every render, so a card can show "6 min read" without
    // the body column ever leaving the database.
    readingMinutes: readingMinutes(input.content),
    wordCount: markdownWordCount(input.content),
    relatedPostIds: input.relatedPostIds,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    canonicalUrl: input.canonicalUrl || null,
    ogImage: input.ogImage || null,
    noIndex: input.noIndex,
  };
}

/**
 * Category, author and pinned-article ids all come from `<Select>`s and a picker, so a bad one
 * means the form is out of date (or someone is posting by hand) — a 422 against the offending
 * field, never a raw foreign-key error. Mirrors `createGalleryItems`' centre check.
 */
async function validateBlogRefs(input: BlogInput, id?: string) {
  const errors: Record<string, string> = {};
  if (input.categoryId) {
    const category = await db.blogCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category) errors.categoryId = "Select a valid category";
  }
  if (input.authorId) {
    const author = await db.blogAuthor.findUnique({ where: { id: input.authorId }, select: { id: true } });
    if (!author) errors.authorId = "Select a valid author";
  }
  if (id && input.relatedPostIds.includes(id)) {
    errors.relatedPostIds = "A post cannot be related to itself";
  } else if (input.relatedPostIds.length) {
    const found = await db.blog.count({ where: { id: { in: input.relatedPostIds } } });
    if (found !== input.relatedPostIds.length) errors.relatedPostIds = "One of the pinned articles no longer exists";
  }
  if (Object.keys(errors).length) throw Errors.validation("Please correct the highlighted fields.", errors);
}

export async function createBlog(input: BlogInput, ctx: Ctx) {
  assertCanPublish(ctx.user, input.status === "PUBLISHED");
  await validateBlogRefs(input);
  const slug = await uniqueContentSlug("blog", input.slug || input.title);
  const tags = await canonicalTagLabels(input.tags);
  const blog = await db.blog.create({ data: { ...blogData(input, slug, tags), createdById: ctx.user.id } });
  await syncBlogTags([], blog.tags);
  await audit({
    user: ctx.user,
    action: "create",
    module: "cms",
    recordType: "Blog",
    recordId: blog.id,
    description: `${ctx.user.name} created blog post "${blog.title}"${blog.status === "DRAFT" ? "" : ` (${statusPhrase(blog)})`}`,
    newValue: { ...blog, content: undefined },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return blog;
}

export async function updateBlog(id: string, input: BlogInput, ctx: Ctx) {
  const existing = await db.blog.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Blog post");

  // Moving the date of a published post IS a publish decision — it is how a post is embargoed
  // or brought forward — so it is gated exactly like a status change. Comparing epoch millis
  // (`+date`) rather than the Date objects, which are never `===`.
  const statusChanged = input.status !== existing.status;
  const scheduleChanged = input.status === "PUBLISHED" && +(input.publishedAt ?? 0) !== +(existing.publishedAt ?? 0);
  assertCanPublish(ctx.user, statusChanged || scheduleChanged);

  await validateBlogRefs(input, id);
  const slug = input.slug && input.slug !== existing.slug ? await uniqueContentSlug("blog", input.slug, id) : existing.slug;
  const tags = await canonicalTagLabels(input.tags);
  const blog = await db.blog.update({ where: { id }, data: blogData(input, slug, tags, existing) });
  await syncBlogTags(existing.tags, blog.tags);

  const announced = statusChanged || scheduleChanged;
  await audit({
    user: ctx.user,
    // "scheduled", not "published": the log has to say what actually happened to the reader.
    action: announced ? displayStatus(blog).toLowerCase() : "update",
    module: "cms",
    recordType: "Blog",
    recordId: id,
    description: `${ctx.user.name} ${announced ? `set blog post "${blog.title}" to ${statusPhrase(blog)}` : `updated blog post "${blog.title}"`}`,
    oldValue: { ...existing, content: undefined },
    newValue: { ...blog, content: undefined },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return blog;
}

export async function deleteBlog(id: string, ctx: Ctx) {
  const existing = await db.blog.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Blog post");
  await db.blog.delete({ where: { id } });
  // The post is gone but its labels live on in `blog_tags`; recount so the tag cloud and the
  // admin filter do not keep advertising an article nobody can open.
  await syncBlogTags(existing.tags, []);
  await audit({
    user: ctx.user,
    action: "delete",
    module: "cms",
    recordType: "Blog",
    recordId: id,
    description: `${ctx.user.name} deleted blog post "${existing.title}"`,
    oldValue: { ...existing, content: undefined },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

// ───────────────────────────── Categories ─────────────────────────────

export const blogCategorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(80),
  description: z.string().trim().max(2000).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
  colorTone: z.union([z.literal(""), z.enum(CATEGORY_TONES)]).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
  seoTitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(400).optional().nullable(),
});
export type BlogCategoryInput = z.infer<typeof blogCategorySchema>;

/**
 * The PARTIAL shape for a PUT, and the reason it is not just `schema.partial()`.
 *
 * Zod's `.partial()` makes a key optional but does NOT strip its `.default()`, so an absent
 * `isActive` still parses to `true` and an absent `sortOrder` still parses to `0`. The taxonomy
 * managers save one field at a time, so a rename was quietly reactivating a category the admin had
 * switched off and dragging it back to the top of the order. Removing the defaults first means an
 * omitted key stays `undefined`, which Prisma leaves alone.
 */
export const blogCategoryUpdateSchema = blogCategorySchema
  .omit({ sortOrder: true, isActive: true })
  .extend({
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .partial();

/**
 * `_count.posts` counts EVERY post, not just the live ones: it is what the delete guard and the
 * admin manager need ("this category still holds 4 posts"). Public post counts are a
 * `blog-public` concern and go through `livePostWhere()` there.
 */
export async function listBlogCategories(opts: { activeOnly?: boolean } = {}) {
  return db.blogCategory.findMany({
    where: opts.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true } } },
  });
}

async function assertCategoryNameFree(name: string, excludeId?: string) {
  const dupe = await db.blogCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A category with this name already exists" });
}

export async function createBlogCategory(input: BlogCategoryInput, ctx: Ctx) {
  await assertCategoryNameFree(input.name);
  const category = await db.blogCategory.create({
    data: {
      name: input.name,
      slug: await uniqueContentSlug("blogCategory", input.name),
      description: input.description || null,
      icon: input.icon || null,
      colorTone: input.colorTone || null,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
    },
  });
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "BlogCategory", recordId: category.id, description: `${ctx.user.name} created blog category "${category.name}"`, newValue: category, ip: ctx.ip, userAgent: ctx.userAgent });
  return category;
}

export async function updateBlogCategory(id: string, input: Partial<BlogCategoryInput>, ctx: Ctx) {
  const existing = await db.blogCategory.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Blog category");
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) await assertCategoryNameFree(input.name, id);
  const category = await db.blogCategory.update({
    where: { id },
    data: {
      name: input.name,
      // The slug is part of a public URL, so it only moves when the name genuinely changed.
      slug: input.name && input.name !== existing.name ? await uniqueContentSlug("blogCategory", input.name, id) : undefined,
      description: input.description === undefined ? undefined : input.description || null,
      icon: input.icon === undefined ? undefined : input.icon || null,
      colorTone: input.colorTone === undefined ? undefined : input.colorTone || null,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      seoTitle: input.seoTitle === undefined ? undefined : input.seoTitle || null,
      seoDescription: input.seoDescription === undefined ? undefined : input.seoDescription || null,
    },
  });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "BlogCategory", recordId: id, description: `${ctx.user.name} updated blog category "${category.name}"`, oldValue: existing, newValue: category, ip: ctx.ip, userAgent: ctx.userAgent });
  return category;
}

export async function deleteBlogCategory(id: string, ctx: Ctx) {
  const existing = await db.blogCategory.findUnique({ where: { id }, include: { _count: { select: { posts: true } } } });
  if (!existing) throw Errors.notFound("Blog category");
  // The FK is SetNull, so a delete would quietly strip the category off every post instead of
  // failing. Refuse loudly — an editor who wants that can reassign or deactivate deliberately.
  if (existing._count.posts > 0) throw Errors.conflict(`Move its ${existing._count.posts} post(s) first or deactivate the category.`);
  await db.blogCategory.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "BlogCategory", recordId: id, description: `${ctx.user.name} deleted blog category "${existing.name}"`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Authors ─────────────────────────────

export const blogAuthorSchema = z.object({
  name: z.string().trim().min(2, "Enter the author's name").max(120),
  role: z.string().trim().max(80).optional().nullable(),
  bio: z.string().trim().max(1000).optional().nullable(),
  avatar: imageUrl,
  email: optionalEmail,
  linkedinUrl: optionalUrl,
  twitterUrl: optionalUrl,
  websiteUrl: optionalUrl,
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type BlogAuthorInput = z.infer<typeof blogAuthorSchema>;

/**
 * The PARTIAL shape for a PUT, and the reason it is not just `schema.partial()`.
 *
 * Zod's `.partial()` makes a key optional but does NOT strip its `.default()`, so an absent
 * `isActive` still parses to `true` and an absent `sortOrder` still parses to `0`. The taxonomy
 * managers save one field at a time, so a rename was quietly reactivating a category the admin had
 * switched off and dragging it back to the top of the order. Removing the defaults first means an
 * omitted key stays `undefined`, which Prisma leaves alone.
 */
export const blogAuthorUpdateSchema = blogAuthorSchema
  .omit({ isActive: true, sortOrder: true })
  .extend({
    isActive: z.coerce.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .partial();

export async function listBlogAuthors(opts: { activeOnly?: boolean } = {}) {
  return db.blogAuthor.findMany({
    where: opts.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true } } },
  });
}

/**
 * `BlogAuthor.name` is deliberately NOT unique in the database — two people can share a name —
 * but a second "EduSkill Team" is nearly always a slip that leaves half the posts credited to
 * a duplicate row, so the service refuses it the way a category does. A genuine namesake is
 * handled by qualifying the name ("Ananya Deshmukh (Programmes)").
 */
async function assertAuthorNameFree(name: string, excludeId?: string) {
  const dupe = await db.blogAuthor.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "An author with this name already exists" });
}

export async function createBlogAuthor(input: BlogAuthorInput, ctx: Ctx) {
  await assertAuthorNameFree(input.name);
  const author = await db.blogAuthor.create({
    data: {
      name: input.name,
      slug: await uniqueContentSlug("blogAuthor", input.name),
      role: input.role || null,
      bio: input.bio || null,
      avatar: input.avatar || null,
      email: input.email || null,
      linkedinUrl: input.linkedinUrl || null,
      twitterUrl: input.twitterUrl || null,
      websiteUrl: input.websiteUrl || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
  await audit({ user: ctx.user, action: "create", module: "cms", recordType: "BlogAuthor", recordId: author.id, description: `${ctx.user.name} added blog author "${author.name}"`, newValue: author, ip: ctx.ip, userAgent: ctx.userAgent });
  return author;
}

export async function updateBlogAuthor(id: string, input: Partial<BlogAuthorInput>, ctx: Ctx) {
  const existing = await db.blogAuthor.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Blog author");
  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) await assertAuthorNameFree(input.name, id);
  const author = await db.blogAuthor.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.name && input.name !== existing.name ? await uniqueContentSlug("blogAuthor", input.name, id) : undefined,
      role: input.role === undefined ? undefined : input.role || null,
      bio: input.bio === undefined ? undefined : input.bio || null,
      avatar: input.avatar === undefined ? undefined : input.avatar || null,
      email: input.email === undefined ? undefined : input.email || null,
      linkedinUrl: input.linkedinUrl === undefined ? undefined : input.linkedinUrl || null,
      twitterUrl: input.twitterUrl === undefined ? undefined : input.twitterUrl || null,
      websiteUrl: input.websiteUrl === undefined ? undefined : input.websiteUrl || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "BlogAuthor", recordId: id, description: `${ctx.user.name} updated blog author "${author.name}"`, oldValue: existing, newValue: author, ip: ctx.ip, userAgent: ctx.userAgent });
  return author;
}

export async function deleteBlogAuthor(id: string, ctx: Ctx) {
  const existing = await db.blogAuthor.findUnique({ where: { id }, include: { _count: { select: { posts: true } } } });
  if (!existing) throw Errors.notFound("Blog author");
  // SetNull again: deleting would strip the byline off published articles without a word.
  if (existing._count.posts > 0) throw Errors.conflict(`This author is credited on ${existing._count.posts} post(s). Reassign them first or deactivate the author.`);
  await db.blogAuthor.delete({ where: { id } });
  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "BlogAuthor", recordId: id, description: `${ctx.user.name} deleted blog author "${existing.name}"`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}

// ───────────────────────────── Tags ─────────────────────────────

/**
 * `Blog.tags` stays a plain `String[]` and `BlogTag` is a lookup table over it — `name` holds
 * the exact label stored inside the array, which is what keeps every existing `?tag=` link
 * working. Nothing in the database enforces that relationship: these helpers are the only
 * thing keeping the two in step, so every write path through this file goes through them.
 */

/** How many posts one tag rewrite may touch before we refuse. */
const TAG_REWRITE_LIMIT = 500;

/** Trim, collapse internal whitespace, cap at the 60 characters `BlogTag.name` is sized for. */
export function normalizeTagLabel(s: string): string {
  return s.trim().replace(/\s+/g, " ").slice(0, 60).trim();
}

/**
 * Normalises the submitted labels and snaps each one onto the casing an existing `BlogTag`
 * already uses, so "AI", "ai" and "Ai" all converge on whichever row exists rather than
 * splitting one topic across three archive pages.
 *
 * Called BEFORE the `Blog` row is written — rewriting the array afterwards would need a second
 * update, and the post would briefly carry the un-canonical label.
 */
export async function canonicalTagLabels(tags: string[]): Promise<string[]> {
  const seen = new Map<string, string>();
  for (const raw of tags) {
    const label = normalizeTagLabel(raw);
    if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label);
  }
  if (!seen.size) return [];
  // An OR of case-insensitive equals rather than `in`: `in` compares byte-for-byte, which is
  // precisely the comparison we are trying to avoid. At most 50 labels (`stringList`).
  const rows = await db.blogTag.findMany({ where: { OR: [...seen.values()].map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) }, select: { name: true } });
  const canonical = new Map(rows.map((r) => [r.name.toLowerCase(), r.name]));
  return [...seen].map(([lower, label]) => canonical.get(lower) ?? label);
}

/**
 * Recomputes `postCount` for the given labels from the posts that are actually LIVE, so the
 * public tag cloud never advertises a draft or an embargoed article.
 *
 * Known drift, accepted deliberately: a scheduled post joins its tags' counts only the next
 * time one of those tags is touched, because nothing runs when the clock passes (there is no
 * cron and none is added). The count is a display hint — the archive pages themselves query
 * live posts directly, so a stale number never leaks content.
 */
async function recountTags(names: string[]) {
  const unique = [...new Set(names.map(normalizeTagLabel).filter(Boolean))];
  // `db` is the pooled client here, not a transaction, so these may run concurrently.
  await Promise.all(
    unique.map(async (name) => {
      const postCount = await db.blog.count({ where: livePostWhere({ tags: { has: name } }) });
      await db.blogTag.updateMany({ where: { name }, data: { postCount } });
    })
  );
}

/**
 * Brings `blog_tags` back in line after a post is saved or deleted: creates a row for any
 * label that is new to the site, then recounts both the labels the post gained and the ones it
 * lost.
 *
 * Runs AFTER the post is written and never rethrows, the same bargain `audit()` and `notify()`
 * make: the article is already saved, and a bookkeeping row for a lookup table is not worth
 * turning a successful publish into a 500 the editor cannot act on. A failure lands in the
 * server log and self-corrects the next time one of those tags is saved.
 */
export async function syncBlogTags(before: string[], after: string[]) {
  try {
    const rows = after.length ? await db.blogTag.findMany({ where: { OR: after.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) }, select: { name: true } }) : [];
    const known = new Set(rows.map((t) => t.name.toLowerCase()));
    for (const name of after) {
      if (known.has(name.toLowerCase())) continue;
      // `upsert` on the unique name rather than `create`: two editors saving the same brand-new
      // tag at the same moment would otherwise race into a P2002 and fail one of the saves.
      await db.blogTag.upsert({ where: { name }, update: {}, create: { name, slug: await uniqueContentSlug("blogTag", name) } });
    }
    await recountTags([...before, ...after]);
  } catch (err) {
    console.error("[blog] Failed to sync blog tags:", err);
  }
}

export async function listBlogTags() {
  return db.blogTag.findMany({ orderBy: [{ postCount: "desc" }, { name: "asc" }] });
}

export const blogTagUpdateSchema = z.object({
  name: z.string().trim().min(1, "Enter a tag name").max(60).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  seoTitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(400).optional().nullable(),
});
export type BlogTagUpdateInput = z.infer<typeof blogTagUpdateSchema>;

/** Posts carrying an exact label, and a refusal when the rewrite would be too large to hold a lock over. */
async function tagPostCountOrThrow(name: string) {
  const count = await db.blog.count({ where: { tags: { has: name } } });
  if (count > TAG_REWRITE_LIMIT) {
    throw Errors.conflict(`"${name}" is on ${count} posts. Tag changes are limited to ${TAG_REWRITE_LIMIT} posts at a time so the database is not locked for minutes.`);
  }
  return count;
}

/**
 * Renames a tag AND rewrites the label inside every post's `tags` array, which is the only
 * reason this needs a transaction: the lookup row and the arrays must never disagree.
 *
 * Inside `$transaction` the client is ONE connection, so the per-post updates run sequentially.
 * `Promise.all` on `tx` would interleave queries on a single connection and deadlock.
 */
export async function renameBlogTag(id: string, input: BlogTagUpdateInput, ctx: Ctx) {
  const existing = await db.blogTag.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Tag");
  const name = input.name ? normalizeTagLabel(input.name) : existing.name;
  if (!name) throw Errors.validation("Please correct the highlighted fields.", { name: "Enter a tag name" });

  // A casing-only change ("ai" → "AI") still has to rewrite every array, because the arrays
  // store the label verbatim and `tags: { has: … }` is case-sensitive.
  const renamed = name !== existing.name;
  if (renamed) {
    const dupe = await db.blogTag.findFirst({ where: { name: { equals: name, mode: "insensitive" }, id: { not: id } }, select: { id: true } });
    if (dupe) throw Errors.validation("Please correct the highlighted fields.", { name: "A tag with this name already exists — merge into it instead" });
    await tagPostCountOrThrow(existing.name);
  }
  // The slug is a public URL; only move it when the name really changed, and resolve it before
  // the transaction opens so slug probing is not holding a write lock.
  const slug = name.toLowerCase() !== existing.name.toLowerCase() ? await uniqueContentSlug("blogTag", name, id) : existing.slug;

  // 30s rather than Prisma's 5s default: the cap above allows up to 500 sequential array
  // rewrites on one connection, which a loaded database will not finish inside five seconds.
  const tag = await db.$transaction(async (tx) => {
    const updated = await tx.blogTag.update({
      where: { id },
      data: {
        name,
        slug,
        description: input.description === undefined ? undefined : input.description || null,
        seoTitle: input.seoTitle === undefined ? undefined : input.seoTitle || null,
        seoDescription: input.seoDescription === undefined ? undefined : input.seoDescription || null,
      },
    });
    if (renamed) {
      const posts = await tx.blog.findMany({ where: { tags: { has: existing.name } }, select: { id: true, tags: true } });
      for (const post of posts) {
        const tags = [...new Set(post.tags.map((t) => (t === existing.name ? name : t)))];
        await tx.blog.update({ where: { id: post.id }, data: { tags } });
      }
    }
    return updated;
  }, { timeout: 30_000 });

  await recountTags([existing.name, name]);
  await audit({ user: ctx.user, action: "update", module: "cms", recordType: "BlogTag", recordId: id, description: renamed ? `${ctx.user.name} renamed blog tag "${existing.name}" to "${name}"` : `${ctx.user.name} updated blog tag "${name}"`, oldValue: existing, newValue: tag, ip: ctx.ip, userAgent: ctx.userAgent });
  return tag;
}

/** Folds one tag into another: every post swaps the label, then the source row is dropped. */
export async function mergeBlogTag(id: string, input: { intoId: string }, ctx: Ctx) {
  const [source, target] = await Promise.all([db.blogTag.findUnique({ where: { id } }), db.blogTag.findUnique({ where: { id: input.intoId } })]);
  if (!source) throw Errors.notFound("Tag");
  if (!target) throw Errors.validation("Please correct the highlighted fields.", { mergeIntoId: "Select a valid tag to merge into" });
  if (source.id === target.id) throw Errors.badRequest("A tag cannot be merged into itself.");
  await tagPostCountOrThrow(source.name);

  await db.$transaction(async (tx) => {
    const posts = await tx.blog.findMany({ where: { tags: { has: source.name } }, select: { id: true, tags: true } });
    // Sequential on purpose — see renameBlogTag.
    for (const post of posts) {
      // The Set collapses the case where a post already carried both labels.
      const tags = [...new Set(post.tags.map((t) => (t === source.name ? target.name : t)))];
      await tx.blog.update({ where: { id: post.id }, data: { tags } });
    }
    await tx.blogTag.delete({ where: { id } });
  }, { timeout: 30_000 });

  await recountTags([source.name, target.name]);
  await audit({ user: ctx.user, action: "merge", module: "cms", recordType: "BlogTag", recordId: id, description: `${ctx.user.name} merged blog tag "${source.name}" into "${target.name}"`, oldValue: source, newValue: target, ip: ctx.ip, userAgent: ctx.userAgent });
  return target;
}

/** Strips the label from every post, then removes the lookup row. */
export async function deleteBlogTag(id: string, ctx: Ctx) {
  const existing = await db.blogTag.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Tag");
  await tagPostCountOrThrow(existing.name);

  await db.$transaction(async (tx) => {
    const posts = await tx.blog.findMany({ where: { tags: { has: existing.name } }, select: { id: true, tags: true } });
    // Sequential on purpose — see renameBlogTag.
    for (const post of posts) {
      await tx.blog.update({ where: { id: post.id }, data: { tags: post.tags.filter((t) => t !== existing.name) } });
    }
    await tx.blogTag.delete({ where: { id } });
  }, { timeout: 30_000 });

  await audit({ user: ctx.user, action: "delete", module: "cms", recordType: "BlogTag", recordId: id, description: `${ctx.user.name} deleted blog tag "${existing.name}"`, oldValue: existing, ip: ctx.ip, userAgent: ctx.userAgent });
}
