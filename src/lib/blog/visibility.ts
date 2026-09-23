import { formatDistanceToNowStrict } from "date-fns";
import type { Prisma } from "@/lib/db";

/**
 * THE single definition of "publicly visible blog post". Everything about scheduling hangs
 * off this file.
 *
 * A post is live iff `status = PUBLISHED AND published_at <= now()`. There is no SCHEDULED
 * value in `ContentStatus` — that enum is shared by Blog, Event, CmsPage, Program, Story and
 * Campaign, so adding one would make it legal (and unhandled) for five other models. Nothing
 * flips a status when the clock passes: the post simply starts matching {@link livePostWhere}.
 *
 * Two consequences the whole team has to respect:
 *
 * 1. EVERY public read goes through `livePostWhere()`. A query that spells the filter out by
 *    hand is a scheduling leak — it publishes an embargoed article early. The full list of
 *    call sites: the blog index, the article page (`getPublicPost`), `generateMetadata`'s post
 *    load, all four related-post queries, prev/next, the category / tag / author archives,
 *    `listLivePostUrls` (sitemap), `listFeedPosts` (RSS), and every category/tag/author count.
 *    After any change, `grep -rn "db\.blog" src/app src/server` must only hit
 *    `src/server/blog.ts`, `src/server/blog-public.ts`, `src/app/admin/**` and
 *    `src/app/api/admin/**`.
 *
 * 2. `new Date()` below is evaluated WHEN THE QUERY RUNS. Adding `export const revalidate`,
 *    `export const dynamic = "force-static"` or `generateStaticParams` to a blog route would
 *    freeze that timestamp into a cached render, so a scheduled post would appear late — or a
 *    404 would be cached for an article that has since gone live. The repo uses no ISR
 *    anywhere; keep these routes request-time dynamic.
 *
 * Imported with `import type { Prisma }`, so the Prisma client is fully erased at build time
 * and a client component ("use client") can import this module for `displayStatus` /
 * `scheduledIn` without dragging the server bundle along.
 */

/** The only `ContentStatus` a public reader ever sees. */
export const LIVE_STATUS = "PUBLISHED" as const;

/**
 * `where` clause for a publicly visible post, optionally narrowed further.
 *
 * `extra` is combined with `AND` rather than spread over the gate. Spreading would let a
 * caller's own `publishedAt` constraint (prev/next navigation uses `{ lt: current }`) silently
 * REPLACE the `lte: now` check and leak every future-dated post — the one mistake this helper
 * exists to make impossible. With `AND`, both constraints apply.
 *
 * `{ lte: new Date() }` already excludes NULL, because every SQL comparison against NULL is
 * false, so a PUBLISHED row that never got a date stays invisible with no extra clause.
 */
export function livePostWhere(extra?: Prisma.BlogWhereInput): Prisma.BlogWhereInput {
  const live: Prisma.BlogWhereInput = { status: LIVE_STATUS, publishedAt: { lte: new Date() } };
  return extra ? { AND: [live, extra] } : live;
}

/** What the admin sees. "SCHEDULED" is derived, never stored. */
export type BlogDisplayStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

/** The two fields every visibility helper needs; anything with them fits, whatever else it selects. */
export type PostVisibility = { status: string; publishedAt: Date | string | null };

function publishAt(post: PostVisibility): Date | null {
  if (!post.publishedAt) return null;
  const d = post.publishedAt instanceof Date ? post.publishedAt : new Date(post.publishedAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Live right now: PUBLISHED with a date that has already passed. Mirrors {@link livePostWhere}. */
export function isLive(post: PostVisibility): boolean {
  const at = publishAt(post);
  return post.status === LIVE_STATUS && at !== null && at.getTime() <= Date.now();
}

/** Embargoed: PUBLISHED, but the date is still in the future, so no public surface shows it. */
export function isScheduled(post: PostVisibility): boolean {
  const at = publishAt(post);
  return post.status === LIVE_STATUS && at !== null && at.getTime() > Date.now();
}

/**
 * The status to put on a badge. PUBLISHED + a future date reads as "Scheduled"; everything
 * else is the stored status.
 *
 * PUBLISHED with NO date is reported as PUBLISHED even though it is invisible: the status
 * column is what an editor set, and inventing a different label would hide the anomaly rather
 * than explain it. The blog service always stamps `publishedAt` when a post is published, so
 * this only ever comes from data written outside it.
 */
export function displayStatus(post: PostVisibility): BlogDisplayStatus {
  if (isScheduled(post)) return "SCHEDULED";
  const status = post.status;
  return status === "DRAFT" || status === "ARCHIVED" || status === "PUBLISHED" ? status : "DRAFT";
}

/**
 * Human countdown for the editor and the admin list — `"Goes live in 3 days"` — or `null`
 * when the post is not scheduled, so a caller can render it directly:
 * `{scheduledIn(post) && <p>{scheduledIn(post)}</p>}`.
 */
export function scheduledIn(post: PostVisibility): string | null {
  const at = publishAt(post);
  if (!at || !isScheduled(post)) return null;
  return `Goes live in ${formatDistanceToNowStrict(at)}`;
}
