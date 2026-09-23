import { db, Prisma } from "@/lib/db";
import { livePostWhere } from "@/lib/blog/visibility";

/**
 * Every public read of the blog. Nothing outside this file may touch `db.blog` for a visitor:
 * the site pages, the sitemap and the RSS feed all call in here.
 *
 * The reason is scheduling. A post is live iff `status = PUBLISHED AND published_at <= now()`,
 * and that gate lives in exactly one place — `livePostWhere()` from `@/lib/blog/visibility`.
 * A query that spells the filter out by hand publishes an embargoed article early, which is the
 * one failure this module exists to make impossible. So every query below STARTS from
 * `livePostWhere()` and narrows through its `extra` argument; none of them re-state `status` or
 * `publishedAt` themselves. The single documented exception is {@link getPostForPreview}.
 *
 * Two rules that go with it:
 *
 * - `new Date()` inside `livePostWhere()` is evaluated when the query runs, so any route that
 *   calls into this module must stay request-time dynamic. Adding `export const revalidate`,
 *   `export const dynamic = "force-static"` or `generateStaticParams` to a blog route would
 *   freeze that timestamp into a cached render and a scheduled post would appear late (or a
 *   404 would be cached for an article that has since gone live).
 * - `livePostWhere()` must be CALLED where the query is built, never stored in a module-level
 *   constant. A `where` object captured at module load would pin `now` to process start, and a
 *   long-lived server would keep serving a stale cut-off. That is why the `_count` selects for
 *   categories and authors are assembled inside their functions rather than beside the field
 *   lists they extend.
 *
 * Imported directly from `@/lib/blog/visibility` rather than the `@/lib/blog` barrel: the barrel
 * re-exports the markdown renderer, and pulling React into the sitemap and the RSS route for one
 * `where` helper is dead weight.
 */

// ───────────────────────────── Shared selects ─────────────────────────────

/**
 * Everything a post CARD needs and nothing more. Note the absent `content` — the index page
 * currently fetches the full markdown body of all nine posts just to render titles and
 * excerpts; a card never renders the body, so it never loads it.
 */
export const publicPostCardSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  coverImageAlt: true,
  publishedAt: true,
  createdAt: true,
  readingMinutes: true,
  tags: true,
  isFeatured: true,
  // The legacy / guest byline. `PostCard` prefers `author.name` and falls back to this, so a
  // pre-migration post and a one-off guest author still get a name under the title.
  authorName: true,
  category: { select: { id: true, name: true, slug: true, colorTone: true } },
  author: { select: { id: true, name: true, slug: true, avatar: true, role: true } },
} satisfies Prisma.BlogSelect;

export type PublicPostCard = Prisma.BlogGetPayload<{ select: typeof publicPostCardSelect }>;

/** The article page wants the whole row plus the joined taxonomy for the byline and chips. */
export const publicPostInclude = { category: true, author: true } satisfies Prisma.BlogInclude;

export type PublicPost = Prisma.BlogGetPayload<{ include: typeof publicPostInclude }>;

/**
 * Newest first, falling back to creation order for the rare pair that shares a publish
 * timestamp (the seed and a bulk import both produce those), so pagination is stable.
 */
const PUBLIC_ORDER = [{ publishedAt: "desc" }, { createdAt: "desc" }] satisfies Prisma.BlogOrderByWithRelationInput[];

/** Matches the current `/blog` grid (3 columns x 3 rows); callers may ask for fewer or more. */
const DEFAULT_PAGE_SIZE = 9;
/** A hard ceiling so a hand-edited `?limit=` in a future query string cannot ask for the table. */
const MAX_PAGE_SIZE = 50;

/** `Blog.id` / `relatedPostIds` are `@db.Uuid`; a non-uuid string reaches Postgres as a cast error. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ───────────────────────────── Posts ─────────────────────────────

export interface PublicPostQuery {
  page?: number;
  limit?: number;
  /** Free text over title, excerpt and exact tag. */
  q?: string;
  categorySlug?: string;
  /** The tag LABEL as stored in `Blog.tags` — resolve a slug through {@link getPublicTag} first. */
  tagName?: string;
  authorSlug?: string;
  /** Posts already rendered elsewhere on the page (the featured hero), so they are not repeated. */
  excludeIds?: string[];
}

export interface PublicPostList {
  items: PublicPostCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * The narrowing half of the list query. Returned separately from the visibility gate so it can
 * only ever be handed to `livePostWhere()` as `extra` — there is no code path here that builds a
 * complete `where` without the gate.
 *
 * An archive filters on the RELATION (`category: { slug, isActive }`) rather than on `categoryId`
 * so that deactivating a category immediately empties its archive without a second query, and so
 * a stale `?category=` link returns nothing instead of everything.
 */
function postFilter(opts: PublicPostQuery): Prisma.BlogWhereInput | undefined {
  const where: Prisma.BlogWhereInput = {};
  if (opts.categorySlug) where.category = { slug: opts.categorySlug, isActive: true };
  if (opts.tagName) where.tags = { has: opts.tagName };
  if (opts.authorSlug) where.author = { slug: opts.authorSlug, isActive: true };
  if (opts.excludeIds?.length) where.id = { notIn: opts.excludeIds };
  const q = opts.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { excerpt: { contains: q, mode: "insensitive" } },
      // Exact tag match: a visitor typing "tailoring" should find the posts tagged with it.
      { tags: { has: q } },
    ];
  }
  return Object.keys(where).length > 0 ? where : undefined;
}

/**
 * The paged list behind `/blog` and all three archives. One `where` object is built once and
 * used for BOTH the page and the count: calling `livePostWhere()` twice would stamp two
 * timestamps microseconds apart and could, for a post publishing in that gap, report a total
 * that does not match the rows returned.
 */
export async function listPublicPosts(opts: PublicPostQuery = {}): Promise<PublicPostList> {
  const page = Math.max(1, Math.trunc(opts.page ?? 1) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(opts.limit ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));
  const where = livePostWhere(postFilter(opts));
  // `db` is the pooled client, so these two may run concurrently — unlike queries on a `tx`.
  const [items, total] = await Promise.all([
    db.blog.findMany({ where, orderBy: PUBLIC_ORDER, skip: (page - 1) * limit, take: limit, select: publicPostCardSelect }),
    db.blog.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * The one post the index leads with. Newest wins, so an editor promotes a post simply by
 * featuring it — there is no second "featured slot" field to keep tidy. Returns null when
 * nothing is featured (or the featured post is still scheduled), and the index then falls back
 * to a plain grid.
 */
export async function getFeaturedPost(): Promise<PublicPostCard | null> {
  return db.blog.findFirst({ where: livePostWhere({ isFeatured: true }), orderBy: PUBLIC_ORDER, select: publicPostCardSelect });
}

/** The article itself. `null` for a draft, an archived post or one whose publish date is still ahead. */
export async function getPublicPost(slug: string): Promise<PublicPost | null> {
  return db.blog.findFirst({ where: livePostWhere({ slug }), include: publicPostInclude });
}

/**
 * THE ONLY EXPORT IN THIS FILE THAT SKIPS `livePostWhere()`. It loads a post by id whatever its
 * status, so staff can proof a draft or a scheduled article before it is visible to anyone.
 *
 * Its single caller is `/blog/preview/[id]`, which is guarded by `requireAdmin("cms.view")`.
 * Nothing else may call it, and nothing may pass its result to a surface a visitor can reach.
 *
 * The id is shape-checked first because `Blog.id` is `@db.Uuid`: handing Postgres a slug-like
 * string from the URL raises a cast error, which would surface as a 500 instead of a 404.
 */
export async function getPostForPreview(id: string): Promise<PublicPost | null> {
  if (!UUID_RE.test(id)) return null;
  return db.blog.findUnique({ where: { id }, include: publicPostInclude });
}

/** Sort key for a card; a live post always has `publishedAt`, but the type allows null. */
function publishedTime(post: { publishedAt: Date | null; createdAt: Date }): number {
  return (post.publishedAt ?? post.createdAt).getTime();
}

/**
 * Related articles, in four tiers, stopping as soon as `limit` is filled:
 *
 * 1. the author's manual pins, in the order they pinned them — editorial intent beats any
 *    heuristic, so nothing below can displace them;
 * 2. same category, 3. shared tags — one query for both, scored in JS (category is worth more
 *    than any number of tags, ties broken by recency), because two separate queries would have
 *    to de-duplicate their results anyway;
 * 4. a recency top-up, so the rail is never half empty on a post with no category and no tags.
 *
 * Every tier goes through `livePostWhere()`, including the pins: a pinned post that is still
 * scheduled must not be leaked by the article that points at it.
 */
export async function listRelatedPosts(
  post: { id: string; categoryId: string | null; tags: string[]; relatedPostIds: string[] },
  limit = 3
): Promise<PublicPostCard[]> {
  if (limit < 1) return [];
  const picked: PublicPostCard[] = [];
  // Seeded with the current post so no tier can ever recommend the article you are reading.
  const taken = new Set<string>([post.id]);

  // 1. Manual pins. Fetched in one query, then re-ordered to the author's sequence, which the
  //    database has no way to express.
  const pins = post.relatedPostIds.filter((id) => UUID_RE.test(id));
  if (pins.length > 0) {
    const rows = await db.blog.findMany({ where: livePostWhere({ id: { in: pins } }), select: publicPostCardSelect });
    const byId = new Map(rows.map((p) => [p.id, p]));
    for (const id of pins) {
      if (picked.length >= limit) break;
      const p = byId.get(id);
      if (p && !taken.has(p.id)) {
        picked.push(p);
        taken.add(p.id);
      }
    }
  }

  // 2 + 3. Same category, then tag overlap.
  if (picked.length < limit) {
    const or: Prisma.BlogWhereInput[] = [];
    // Guard: `{ categoryId: undefined }` is an ABSENT filter in Prisma, not "categoryId is null",
    // so pushing it for an uncategorised post would match every live article and turn tier 2 into
    // tier 4 with extra steps.
    if (post.categoryId) or.push({ categoryId: post.categoryId });
    if (post.tags.length > 0) or.push({ tags: { hasSome: post.tags } });
    if (or.length > 0) {
      const candidates = await db.blog.findMany({
        where: livePostWhere({ id: { notIn: [...taken] }, OR: or }),
        orderBy: PUBLIC_ORDER,
        // A window, not the table: 24 recent matches is far more than the 3 we keep, and it
        // bounds the work on a blog with thousands of posts in one category.
        take: 24,
        select: publicPostCardSelect,
      });
      const score = (c: PublicPostCard) =>
        (post.categoryId && c.category?.id === post.categoryId ? 100 : 0) + c.tags.filter((t) => post.tags.includes(t)).length * 10;
      candidates.sort((a, b) => score(b) - score(a) || publishedTime(b) - publishedTime(a));
      for (const c of candidates) {
        if (picked.length >= limit) break;
        picked.push(c);
        taken.add(c.id);
      }
    }
  }

  // 4. Recency top-up.
  if (picked.length < limit) {
    const recent = await db.blog.findMany({
      where: livePostWhere({ id: { notIn: [...taken] } }),
      orderBy: PUBLIC_ORDER,
      take: limit - picked.length,
      select: publicPostCardSelect,
    });
    picked.push(...recent);
  }

  return picked.slice(0, limit);
}

/** Minimal shape for the prev/next footer links. */
export type AdjacentPost = { slug: string; title: string; coverImage: string | null; coverImageAlt: string | null };

/**
 * The older ("prev") and newer ("next") live posts around this one.
 *
 * `id: { not: post.id }` is not redundant with the date comparison: two posts published in the
 * same second (a bulk import, the seed) would otherwise let a post link to itself. Both queries
 * go through `livePostWhere()`, which is why the helper ANDs `extra` instead of spreading it —
 * the `{ lt }` / `{ gt }` below would otherwise overwrite the `lte: now` gate and step straight
 * into a scheduled post.
 */
export async function getAdjacentPosts(post: { id: string; publishedAt: Date }): Promise<{ prev: AdjacentPost | null; next: AdjacentPost | null }> {
  const select = { slug: true, title: true, coverImage: true, coverImageAlt: true } satisfies Prisma.BlogSelect;
  const [prev, next] = await Promise.all([
    db.blog.findFirst({
      where: livePostWhere({ id: { not: post.id }, publishedAt: { lt: post.publishedAt } }),
      orderBy: { publishedAt: "desc" },
      select,
    }),
    db.blog.findFirst({
      where: livePostWhere({ id: { not: post.id }, publishedAt: { gt: post.publishedAt } }),
      orderBy: { publishedAt: "asc" },
      select,
    }),
  ]);
  return { prev, next };
}

// ───────────────────────────── Taxonomy ─────────────────────────────

const publicCategoryFields = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  colorTone: true,
  seoTitle: true,
  seoDescription: true,
} satisfies Prisma.BlogCategorySelect;

/**
 * The count is LIVE posts only, so a category whose articles are all scheduled reads as empty — a
 * chip promising "3 posts" that opens an empty archive is the same leak in a different shape.
 *
 * It is exposed BOTH ways on purpose: `_count.posts` is the shape `CategoryChips` already accepts
 * (and the raw shape Prisma returns), while `postCount` is the flat field, named to match the
 * `BlogTag.postCount` column so a chip row over tags and one over categories read the same.
 */
export type PublicBlogCategory = Prisma.BlogCategoryGetPayload<{ select: typeof publicCategoryFields }> & {
  _count: { posts: number };
  postCount: number;
};

/**
 * Active categories with their live post counts, ordered the way the admin arranged them.
 *
 * Empty categories are dropped by default: the public chip row must not offer a filter that
 * returns nothing. Pass `includeEmpty` where the zero is the point (a "no posts yet" archive
 * header, a future picker).
 */
export async function listPublicCategories({ includeEmpty = false }: { includeEmpty?: boolean } = {}): Promise<PublicBlogCategory[]> {
  const rows = await db.blogCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    // Built here, not beside `publicCategoryFields`: a module-level `livePostWhere()` would
    // freeze `now` at process start and the counts would drift for as long as the server runs.
    select: { ...publicCategoryFields, _count: { select: { posts: { where: livePostWhere() } } } },
  });
  const items = rows.map((row) => ({ ...row, postCount: row._count.posts }));
  return includeEmpty ? items : items.filter((c) => c.postCount > 0);
}

/** One category for `/blog/category/[slug]`. Inactive categories are `null` — a 404, not an empty page. */
export async function getPublicCategory(slug: string): Promise<PublicBlogCategory | null> {
  const row = await db.blogCategory.findFirst({
    where: { slug, isActive: true },
    select: { ...publicCategoryFields, _count: { select: { posts: { where: livePostWhere() } } } },
  });
  if (!row) return null;
  return { ...row, postCount: row._count.posts };
}

const publicTagFields = { id: true, name: true, slug: true, description: true, seoTitle: true, seoDescription: true, postCount: true } satisfies Prisma.BlogTagSelect;

export type PublicBlogTag = Prisma.BlogTagGetPayload<{ select: typeof publicTagFields }>;

/**
 * The tag cloud. `BlogTag` has NO relation to `Blog` — the labels live in the `Blog.tags` array —
 * so the count comes from the maintained `postCount` column, which the admin service recomputes
 * against `livePostWhere()` whenever a post is saved. Tags at zero are filtered out in SQL, which
 * is also what keeps a tag used only by scheduled posts out of the cloud.
 */
export async function listPublicTags(limit?: number): Promise<PublicBlogTag[]> {
  return db.blogTag.findMany({
    where: { postCount: { gt: 0 } },
    orderBy: [{ postCount: "desc" }, { name: "asc" }],
    take: limit,
    select: publicTagFields,
  });
}

/**
 * One tag for `/blog/tag/[slug]`. Not filtered on `postCount`: the column is a cached number and
 * the archive's own `listPublicPosts({ tagName })` is the truth, so a tag whose count is briefly
 * stale still renders its (possibly empty) archive rather than a spurious 404.
 */
export async function getPublicTag(slug: string): Promise<PublicBlogTag | null> {
  return db.blogTag.findUnique({ where: { slug }, select: publicTagFields });
}

const publicAuthorFields = {
  id: true,
  name: true,
  slug: true,
  role: true,
  bio: true,
  avatar: true,
  linkedinUrl: true,
  twitterUrl: true,
  websiteUrl: true,
} satisfies Prisma.BlogAuthorSelect;

/**
 * `email` is deliberately not selected — a byline is not a reason to publish a staff mailbox.
 * The live post count is carried both ways, exactly as on {@link PublicBlogCategory}.
 */
export type PublicBlogAuthor = Prisma.BlogAuthorGetPayload<{ select: typeof publicAuthorFields }> & {
  _count: { posts: number };
  postCount: number;
};

/** Active authors with live post counts. Authors with nothing live are dropped, as for categories. */
export async function listPublicAuthors({ includeEmpty = false }: { includeEmpty?: boolean } = {}): Promise<PublicBlogAuthor[]> {
  const rows = await db.blogAuthor.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { ...publicAuthorFields, _count: { select: { posts: { where: livePostWhere() } } } },
  });
  const items = rows.map((row) => ({ ...row, postCount: row._count.posts }));
  return includeEmpty ? items : items.filter((a) => a.postCount > 0);
}

/** One author for `/blog/author/[slug]`. Deactivated authors are `null` — their archive 404s. */
export async function getPublicAuthor(slug: string): Promise<PublicBlogAuthor | null> {
  const row = await db.blogAuthor.findFirst({
    where: { slug, isActive: true },
    select: { ...publicAuthorFields, _count: { select: { posts: { where: livePostWhere() } } } },
  });
  if (!row) return null;
  return { ...row, postCount: row._count.posts };
}

// ───────────────────────────── Syndication ─────────────────────────────

export type LivePostUrl = { slug: string; updatedAt: Date };

/**
 * Sitemap entries. `noIndex: false` as well as the live gate: a post kept out of search engines
 * should not be handed to them in the sitemap either, and a scheduled post must not appear until
 * the hour it goes live — which is exactly why the sitemap route must stay dynamic.
 */
export async function listLivePostUrls(): Promise<LivePostUrl[]> {
  return db.blog.findMany({ where: livePostWhere({ noIndex: false }), select: { slug: true, updatedAt: true }, orderBy: PUBLIC_ORDER });
}

const feedPostSelect = {
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  publishedAt: true,
  updatedAt: true,
  authorName: true,
  author: { select: { name: true } },
} satisfies Prisma.BlogSelect;

export type FeedPost = Prisma.BlogGetPayload<{ select: typeof feedPostSelect }>;

/**
 * The newest posts for `/blog/rss.xml`. This is the one public read that does fetch `content`,
 * because a feed item carries the body. Capped rather than unbounded: readers only ever show the
 * recent window, and a feed that grows with the archive would be re-downloaded in full forever.
 *
 * `authorName` rides along with the joined author so the feed can fall back to the legacy/guest
 * byline when a post has no `BlogAuthor` row.
 */
export async function listFeedPosts(limit = 20): Promise<FeedPost[]> {
  return db.blog.findMany({
    where: livePostWhere({ noIndex: false }),
    orderBy: PUBLIC_ORDER,
    take: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(limit) || 20)),
    select: feedPostSelect,
  });
}
