import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";
import { listAllCenterUrls } from "@/server/public";
import { listLivePostUrls, listPublicAuthors, listPublicCategories, listPublicTags } from "@/server/blog-public";

/**
 * Rendered per request, never prerendered.
 *
 * A blog post is live only while `status = PUBLISHED AND published_at <= now()`, and that `now()`
 * is evaluated when the query runs. Baked into the build output, the cut-off would freeze at deploy
 * time: a post scheduled for next Tuesday would either be advertised to Google today or stay out of
 * the sitemap long after it went live. The DB round-trips below are a handful of indexed reads and
 * crawlers fetch this a few times a day, so there is nothing to gain from caching it anyway.
 */
export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];
type Freq = NonNullable<Entry["changeFrequency"]>;

/**
 * Always-present public pages. Login/register/portals are excluded (see robots.ts).
 *
 * All paths here are app-relative and base-path-FREE: `absoluteUrl()` joins them onto APP_URL,
 * which carries the deployment sub-path ("https://eduskillindia.org/center"), so the emitted
 * `<loc>` values come out as https://eduskillindia.org/center/courses/… . Do not prefix by hand.
 */
const STATIC_PAGES: { path: string; priority: number; changeFrequency: Freq }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/programs", priority: 0.9, changeFrequency: "weekly" },
  { path: "/courses", priority: 0.9, changeFrequency: "weekly" },
  { path: "/training-centers", priority: 0.9, changeFrequency: "daily" },
  { path: "/become-a-trainer", priority: 0.8, changeFrequency: "monthly" },
  { path: "/become-a-trainer/apply", priority: 0.6, changeFrequency: "monthly" },
  { path: "/become-a-trainer/status", priority: 0.3, changeFrequency: "yearly" },
  { path: "/open-a-centre", priority: 0.8, changeFrequency: "monthly" },
  { path: "/open-a-centre/apply", priority: 0.6, changeFrequency: "monthly" },
  // /open-a-centre/status is noindex (it exposes an applicant's own record), so it is not listed.
  { path: "/scholarship", priority: 0.8, changeFrequency: "monthly" },
  { path: "/success-stories", priority: 0.7, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.7, changeFrequency: "yearly" },
  { path: "/verify-certificate", priority: 0.6, changeFrequency: "yearly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/events", priority: 0.7, changeFrequency: "weekly" },
  { path: "/gallery", priority: 0.5, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/donate", priority: 0.7, changeFrequency: "monthly" },
];

/** CMS-backed pages are listed only when the page is published. */
const CMS_PAGE_PATHS: Record<string, string> = {
  "privacy-policy": "/privacy-policy",
  terms: "/terms",
  "refund-policy": "/refund-policy",
  disclaimer: "/disclaimer",
  volunteer: "/volunteer",
};

const safe = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => []);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, programs, centers, blogs, blogCategories, blogTags, blogAuthors, events, cmsPages] = await Promise.all([
    safe(db.course.findMany({ where: { status: "ACTIVE", deletedAt: null }, select: { slug: true, updatedAt: true } })),
    safe(db.program.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } })),
    safe(listAllCenterUrls()),
    // Blog reads go through `@/server/blog-public`, never `db.blog` — that module is the only place
    // `livePostWhere()` is applied, and it also drops `noIndex` posts. Querying the table here is how
    // a future-dated post used to be handed to Google the moment it was saved.
    safe(listLivePostUrls()),
    // These three already exclude anything with no live posts, so the sitemap never advertises an
    // archive URL that renders an empty page.
    safe(listPublicCategories()),
    safe(listPublicTags(100)),
    safe(listPublicAuthors()),
    safe(db.event.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } })),
    safe(db.cmsPage.findMany({ where: { status: "PUBLISHED", slug: { in: Object.keys(CMS_PAGE_PATHS) } }, select: { slug: true, updatedAt: true } })),
  ]);

  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({ url: absoluteUrl(p.path), priority: p.priority, changeFrequency: p.changeFrequency }));

  for (const p of cmsPages) {
    entries.push({ url: absoluteUrl(CMS_PAGE_PATHS[p.slug]), lastModified: p.updatedAt, priority: 0.3, changeFrequency: "yearly" });
  }
  for (const c of courses) entries.push({ url: absoluteUrl(`/courses/${c.slug}`), lastModified: c.updatedAt, priority: 0.8, changeFrequency: "weekly" });
  for (const p of programs) entries.push({ url: absoluteUrl(`/programs/${p.slug}`), lastModified: p.updatedAt, priority: 0.7, changeFrequency: "monthly" });

  // State and district hubs are derived from active centers; keep the latest center update as lastModified.
  const hubs = new Map<string, Date>();
  for (const c of centers) {
    for (const hub of [c.stateUrl, c.districtUrl]) {
      const prev = hubs.get(hub);
      if (!prev || prev < c.updatedAt) hubs.set(hub, c.updatedAt);
    }
  }
  for (const [url, lastModified] of hubs) entries.push({ url: absoluteUrl(url), lastModified, priority: 0.7, changeFrequency: "weekly" });
  for (const c of centers) entries.push({ url: absoluteUrl(c.url), lastModified: c.updatedAt, priority: 0.8, changeFrequency: "weekly" });

  for (const b of blogs) entries.push({ url: absoluteUrl(`/blog/${b.slug}`), lastModified: b.updatedAt, priority: 0.6, changeFrequency: "monthly" });

  /*
   * Blog archives. They rank below the posts themselves because they are navigation, not content,
   * and their weights follow how often each one actually changes: a category gains a post every
   * week or so, an author's archive moves with them, a tag is a long tail that rarely shifts.
   *
   * `lastModified` is deliberately absent. The honest value is the newest live post in that
   * archive, which none of the list helpers return, and a wrong date (the taxonomy row's own
   * `updatedAt`, which only moves when an admin renames it) teaches a crawler to ignore the field.
   * Omitting it lets the crawler decide, which is the correct outcome for a listing page.
   *
   * Paginated `?page=` URLs are not listed: every archive page carries a self-referencing canonical
   * and the posts they link to are already in this sitemap individually.
   */
  for (const c of blogCategories) entries.push({ url: absoluteUrl(`/blog/category/${c.slug}`), priority: 0.6, changeFrequency: "weekly" });
  for (const a of blogAuthors) entries.push({ url: absoluteUrl(`/blog/author/${a.slug}`), priority: 0.5, changeFrequency: "weekly" });
  for (const t of blogTags) entries.push({ url: absoluteUrl(`/blog/tag/${t.slug}`), priority: 0.4, changeFrequency: "monthly" });

  for (const e of events) entries.push({ url: absoluteUrl(`/events/${e.slug}`), lastModified: e.updatedAt, priority: 0.5, changeFrequency: "monthly" });

  return entries;
}
