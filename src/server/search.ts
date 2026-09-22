import { db, type Prisma } from "@/lib/db";
import { centerUrl } from "@/components/site/center-card";
import { faqCategoryId } from "@/components/site/faq-accordion";
import { markdownExcerpt } from "@/components/site/markdown";

/*
 * Public site search: the catalogue a visitor wants to find from the header — courses, training
 * centres, programs and published FAQs. Only records that are already public elsewhere on the site
 * are searched, with the same visibility rules as src/server/public.ts and src/server/centers.ts
 * (ACTIVE and not soft-deleted courses and centres, active programs, published FAQs). Nothing behind
 * a login — students, trainers, staff, applications — is ever touched here.
 *
 * Matching: case-insensitive, whitespace-collapsed, minimum two characters. Every word of the query
 * must match at least one searchable field of a record ("plumbing jaipur" finds a Jaipur centre that
 * teaches plumbing only when both words hit), up to MAX_TOKENS words. Ordering is stable and puts an
 * exact code or PIN match first, then a code/PIN prefix, then a title that starts with the query,
 * then a title that contains it, then everything else in the catalogue's own sort order.
 */

export type SearchResultType = "course" | "centre" | "program" | "faq";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  /** One line under the title: code, place, category or an excerpt. */
  subtitle: string;
  /** App-absolute href (no base path — Link applies it). */
  href: string;
  /** Short trailing label (course code, centre code, PIN) shown at the end of a row. */
  meta?: string;
}

export interface SearchGroups {
  /** The normalised query that was searched ("" when it was too short). */
  query: string;
  courses: SearchResult[];
  centres: SearchResult[];
  programs: SearchResult[];
  faqs: SearchResult[];
  total: number;
}

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;
/** Results per group in the header palette. The /search page asks for more. */
export const SEARCH_DEFAULT_LIMIT = 5;
export const SEARCH_MAX_LIMIT = 20;
const MAX_TOKENS = 5;

const insensitive = (value: string) => ({ contains: value, mode: "insensitive" as const });

/** Trim, collapse whitespace and cap the length. */
export function normalizeSearchQuery(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
}

function tokenize(query: string): string[] {
  const words = query.split(" ").filter((w) => w.length > 0);
  // Deduplicate case-insensitively so "it IT" is one condition, not two.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= MAX_TOKENS) break;
  }
  return out;
}

/**
 * Relevance rank, lower is better. `codes` are identifiers a visitor may have been given verbatim
 * (course code, centre code, PIN), compared exactly and as a prefix.
 */
function rank(query: string, title: string, codes: (string | null | undefined)[]): number {
  const q = query.toLowerCase();
  const compact = q.replace(/\s+/g, "");
  for (const c of codes) if (c && (c.toLowerCase() === q || c.toLowerCase() === compact)) return 0;
  for (const c of codes) if (c && c.toLowerCase().startsWith(compact)) return 1;
  const t = title.toLowerCase();
  if (t.startsWith(q)) return 2;
  if (t.includes(q)) return 3;
  return 4;
}

/** Stable sort by rank (Array.prototype.sort is stable), then trim to `limit`. */
function ranked<T>(rows: T[], score: (row: T) => number, limit: number): T[] {
  return rows
    .map((row, index) => ({ row, index, s: score(row) }))
    .sort((a, b) => a.s - b.s || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.row);
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

async function searchCourses(query: string, tokens: string[], limit: number): Promise<SearchResult[]> {
  const base: Prisma.CourseWhereInput = { status: "ACTIVE", deletedAt: null };
  const select = { id: true, code: true, slug: true, name: true, shortDescription: true, durationText: true, category: { select: { name: true } } } as const;
  const [exact, rows] = await Promise.all([
    db.course.findMany({ where: { ...base, code: { equals: query.replace(/\s+/g, ""), mode: "insensitive" } }, select, take: 1 }),
    db.course.findMany({
      where: {
        ...base,
        AND: tokens.map((t) => ({
          OR: [{ name: insensitive(t) }, { code: insensitive(t) }, { shortDescription: insensitive(t) }, { category: { name: insensitive(t) } }],
        })),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: limit * 4,
      select,
    }),
  ]);
  return ranked(uniqueById([...exact, ...rows]), (c) => rank(query, c.name, [c.code]), limit).map((c) => ({
    id: c.id,
    type: "course",
    title: c.name,
    subtitle: [c.category?.name, c.durationText].filter(Boolean).join(" · ") || markdownExcerpt(c.shortDescription, 90),
    href: `/courses/${c.slug}`,
    meta: c.code,
  }));
}

async function searchCentres(query: string, tokens: string[], limit: number): Promise<SearchResult[]> {
  const base: Prisma.CenterWhereInput = { deletedAt: null, status: "ACTIVE" };
  const select = {
    id: true,
    code: true,
    slug: true,
    name: true,
    pincode: true,
    villageTown: true,
    isVerified: true,
    state: { select: { name: true, slug: true } },
    district: { select: { name: true, slug: true } },
  } as const;
  const compact = query.replace(/\s+/g, "");
  const [exact, rows] = await Promise.all([
    db.center.findMany({ where: { ...base, OR: [{ code: { equals: compact, mode: "insensitive" } }, { pincode: compact }] }, select, orderBy: [{ isVerified: "desc" }, { name: "asc" }], take: limit }),
    db.center.findMany({
      where: {
        ...base,
        AND: tokens.map((t) => ({
          OR: [
            { name: insensitive(t) },
            { code: insensitive(t) },
            { pincode: { startsWith: t } },
            { villageTown: insensitive(t) },
            { district: { name: insensitive(t) } },
            { state: { name: insensitive(t) } },
          ],
        })),
      },
      // Same order as the public centre finder (searchCenters in src/server/centers.ts).
      orderBy: [{ isVerified: "desc" }, { name: "asc" }],
      take: limit * 4,
      select,
    }),
  ]);
  return ranked(uniqueById([...exact, ...rows]), (c) => rank(query, c.name, [c.code, c.pincode]), limit).map((c) => ({
    id: c.id,
    type: "centre",
    title: c.name,
    subtitle: [c.villageTown && c.villageTown !== c.district.name ? c.villageTown : null, c.district.name, c.state.name].filter(Boolean).join(", ") + ` · PIN ${c.pincode}`,
    href: centerUrl(c),
    meta: c.code,
  }));
}

async function searchPrograms(query: string, tokens: string[], limit: number): Promise<SearchResult[]> {
  const rows = await db.program.findMany({
    where: { isActive: true, AND: tokens.map((t) => ({ OR: [{ title: insensitive(t) }, { summary: insensitive(t) }] })) },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: limit * 4,
    select: { id: true, slug: true, title: true, summary: true },
  });
  return ranked(rows, (p) => rank(query, p.title, []), limit).map((p) => ({
    id: p.id,
    type: "program",
    title: p.title,
    subtitle: markdownExcerpt(p.summary, 110),
    href: `/programs/${p.slug}`,
  }));
}

async function searchFaqs(query: string, tokens: string[], limit: number): Promise<SearchResult[]> {
  const rows = await db.faq.findMany({
    where: { isPublished: true, AND: tokens.map((t) => ({ OR: [{ question: insensitive(t) }, { answer: insensitive(t) }, { category: insensitive(t) }] })) },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    take: limit * 4,
    select: { id: true, question: true, answer: true, category: true },
  });
  // Questions that contain the words outrank answers that merely mention them.
  const inQuestion = (q: string) => tokens.every((t) => q.toLowerCase().includes(t.toLowerCase()));
  return ranked(rows, (f) => rank(query, f.question, []) + (inQuestion(f.question) ? 0 : 1), limit).map((f) => {
    const category = f.category?.trim() || "General";
    return {
      id: f.id,
      type: "faq",
      title: f.question,
      subtitle: markdownExcerpt(f.answer, 110),
      // /faq renders one section per category with this id (see FaqAccordion).
      href: `/faq#${faqCategoryId(category)}`,
    };
  });
}

/**
 * Grouped public search. Returns empty groups (never throws for input reasons) when the query is
 * shorter than SEARCH_MIN_LENGTH after normalising.
 */
export async function searchSite(raw: string, opts: { limit?: number } = {}): Promise<SearchGroups> {
  const query = normalizeSearchQuery(raw);
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? SEARCH_DEFAULT_LIMIT)), SEARCH_MAX_LIMIT);
  if (query.length < SEARCH_MIN_LENGTH) return { query: "", courses: [], centres: [], programs: [], faqs: [], total: 0 };
  const tokens = tokenize(query);
  // Pooled client, so the four groups run in parallel.
  const [courses, centres, programs, faqs] = await Promise.all([
    searchCourses(query, tokens, limit),
    searchCentres(query, tokens, limit),
    searchPrograms(query, tokens, limit),
    searchFaqs(query, tokens, limit),
  ]);
  return { query, courses, centres, programs, faqs, total: courses.length + centres.length + programs.length + faqs.length };
}
