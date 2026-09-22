import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getSection } from "@/lib/cms";
import { getSectionDef } from "@/lib/cms/sections";
import { isMegaTone, type CoursesMenuData, type MegaMenuFeature, type MegaMenuLink, type MegaTone } from "@/components/site/mega-menu/types";

/**
 * Data for the header's "Courses" mega menu.
 *
 *   popular    – the first four ACTIVE course categories (by sortOrder, then name) that have at least
 *                one active course, so a visitor never lands on an empty catalogue. One query, with the
 *                active-course count computed by Postgres in the same round trip.
 *   feature +
 *   quickLinks – the CMS section "nav.coursesMenu" (defaults in src/lib/cms/sections.ts).
 *
 * The header renders on every public page, so the result is cached across requests for a short window
 * and deduplicated within a request. Any failure degrades to the CMS defaults with no popular rows,
 * never to a broken header.
 */

const SECTION_KEY = "nav.coursesMenu";
/** Cache tag; `revalidateTag(NAV_MENU_TAG)` refreshes the menu immediately after a CMS or category edit. */
export const NAV_MENU_TAG = "nav-menu";
const REVALIDATE_SECONDS = 60;
const POPULAR_TONES: MegaTone[] = ["orange", "blue", "purple", "rose"];
const QUICK_TONES: MegaTone[] = ["green", "rose", "amber", "navy"];
const MAX_ROWS = 4;
const ACTIVE_COURSE = { status: "ACTIVE", deletedAt: null } as const;

interface CoursesMenuSection {
  featureTitle?: unknown;
  featureDescription?: unknown;
  ctaLabel?: unknown;
  ctaHref?: unknown;
  quickLinks?: unknown;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/**
 * App-relative ("/scholarship") or absolute http(s) only. The CMS URL check accepts anything starting
 * with "/", which lets a protocol-relative "//other-site" through; in a site-wide menu that would be an
 * off-site link dressed as an internal one, so it is dropped here.
 */
const safeHref = (v: unknown) => {
  const s = str(v);
  return (s.startsWith("/") && !s.startsWith("//")) || /^https?:\/\//i.test(s) ? s : "";
};

function toFeature(s: CoursesMenuSection, fallback: CoursesMenuSection): MegaMenuFeature {
  return {
    title: str(s.featureTitle) || str(fallback.featureTitle),
    description: str(s.featureDescription),
    ctaLabel: str(s.ctaLabel) || str(fallback.ctaLabel),
    ctaHref: safeHref(s.ctaHref) || "/courses",
  };
}

function toQuickLinks(raw: unknown): MegaMenuLink[] {
  if (!Array.isArray(raw)) return [];
  const out: MegaMenuLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = str(o.title);
    const href = safeHref(o.href);
    // A row without a title or a destination would be a dead control; skip it.
    if (!title || !href) continue;
    const tone = str(o.tone).toLowerCase();
    out.push({
      title,
      subtitle: str(o.subtitle),
      href,
      icon: str(o.icon) || "Sparkles",
      tone: isMegaTone(tone) ? tone : QUICK_TONES[out.length % QUICK_TONES.length],
    });
    if (out.length === MAX_ROWS) break;
  }
  return out;
}

async function loadPopular(): Promise<MegaMenuLink[]> {
  const rows = await db.courseCategory.findMany({
    where: { isActive: true, courses: { some: ACTIVE_COURSE } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: MAX_ROWS,
    select: { name: true, slug: true, description: true, icon: true, _count: { select: { courses: { where: ACTIVE_COURSE } } } },
  });
  return rows.map((c, i) => {
    const count = c._count.courses;
    return {
      title: c.name,
      subtitle: c.description?.trim() || `${count} ${count === 1 ? "course" : "courses"}`,
      // /courses reads `?category=<slug>` (src/app/(site)/courses/page.tsx → CourseCatalog initialCategory).
      href: `/courses?category=${encodeURIComponent(c.slug)}`,
      icon: c.icon || "BookOpen",
      tone: POPULAR_TONES[i % POPULAR_TONES.length],
    };
  });
}

async function buildCoursesMenu(): Promise<CoursesMenuData> {
  const defaults = (getSectionDef(SECTION_KEY)?.defaults ?? {}) as CoursesMenuSection;
  const [section, popular] = await Promise.all([
    getSection<CoursesMenuSection>(SECTION_KEY).catch(() => defaults),
    loadPopular().catch(() => [] as MegaMenuLink[]),
  ]);
  return { feature: toFeature(section, defaults), popular, quickLinks: toQuickLinks(section.quickLinks) };
}

const cachedCoursesMenu = unstable_cache(buildCoursesMenu, ["nav-menu:courses:v1"], { revalidate: REVALIDATE_SECONDS, tags: [NAV_MENU_TAG] });

/** Cached across requests (60s) and memoised within one request. Never throws. */
export const getCoursesMenu = cache(async (): Promise<CoursesMenuData> => {
  try {
    return await cachedCoursesMenu();
  } catch {
    // unstable_cache is unavailable outside a request (scripts, tests): build directly.
    return buildCoursesMenu();
  }
});
