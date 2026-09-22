import { db } from "@/lib/db";
import { getSections } from "@/lib/cms";
import { coverageStats, listHomeCenters } from "@/server/centers";
import { toNumber } from "@/lib/utils";

// ───────────────────────────── Impact statistics ─────────────────────────────

export interface ImpactStatValue {
  key: string;
  label: string;
  value: number;
  suffix: string;
}

/** Course completion percentage from real admissions, or null when nothing has completed yet. */
async function completionRate(): Promise<number | null> {
  const today = new Date();
  const [completed, dropped, activePastEnd] = await Promise.all([
    db.admission.count({ where: { status: "COMPLETED" } }),
    db.admission.count({ where: { status: "DROPPED" } }),
    db.admission.count({ where: { status: "ACTIVE", batch: { endDate: { lt: today } } } }),
  ]);
  if (completed === 0) return null;
  const denominator = completed + dropped + activePastEnd;
  if (denominator === 0) return null;
  return Math.round((completed / denominator) * 100);
}

/** Computes the value for an AUTO impact stat key from live data. Unknown keys resolve to null. */
async function autoStatValue(key: string, coverage: Awaited<ReturnType<typeof coverageStats>>): Promise<number | null> {
  switch (key) {
    case "students":
      return coverage.students;
    case "centers":
      return coverage.centers;
    case "trainers":
      return coverage.trainers;
    case "states":
      return coverage.states;
    case "districts":
      return coverage.districts;
    case "blocks":
      return coverage.blocks;
    case "courses":
      return db.course.count({ where: { status: "ACTIVE", deletedAt: null } });
    case "certificates":
      return db.certificate.count({ where: { status: "ISSUED" } });
    case "completion":
      return completionRate();
    default:
      return null;
  }
}

/**
 * Resolves active impact stats. AUTO stats are computed from real records (students with a
 * Student ID, ACTIVE centers/trainers, states with active centers, completion rate);
 * MANUAL stats use the admin-entered value. Stats without a positive value are omitted –
 * the website never shows fake numbers.
 */
export async function getImpactStats(): Promise<ImpactStatValue[]> {
  const [rows, coverage] = await Promise.all([db.impactStat.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }), coverageStats()]);
  const out: ImpactStatValue[] = [];
  for (const row of rows) {
    const value = row.source === "MANUAL" ? (row.manualValue ?? null) : await autoStatValue(row.key, coverage);
    if (value === null || !Number.isFinite(value) || value <= 0) continue;
    out.push({ key: row.key, label: row.label, value, suffix: row.suffix });
  }
  return out;
}

// ───────────────────────────── Content lists ─────────────────────────────

export const publicCourseSelect = {
  id: true,
  code: true,
  slug: true,
  name: true,
  shortDescription: true,
  image: true,
  icon: true,
  durationText: true,
  durationWeeks: true,
  level: true,
  mode: true,
  courseFee: true,
  registrationFee: true,
  examFee: true,
  certificateFee: true,
  scholarshipAvailable: true,
  scholarshipNote: true,
  isFeatured: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
} as const;

export interface PublicCourseCard {
  id: string;
  code: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  image: string | null;
  icon: string | null;
  durationText: string;
  durationWeeks: number;
  level: string;
  mode: string;
  courseFee: number;
  registrationFee: number;
  examFee: number;
  certificateFee: number;
  totalFee: number;
  scholarshipAvailable: boolean;
  scholarshipNote: string | null;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string; icon: string | null } | null;
}

export function toCourseCard(c: {
  id: string;
  code: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  image: string | null;
  icon: string | null;
  durationText: string;
  durationWeeks: number;
  level: string;
  mode: string;
  courseFee: unknown;
  registrationFee: unknown;
  examFee: unknown;
  certificateFee: unknown;
  scholarshipAvailable: boolean;
  scholarshipNote: string | null;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string; icon: string | null } | null;
}): PublicCourseCard {
  const courseFee = toNumber(c.courseFee);
  const registrationFee = toNumber(c.registrationFee);
  const examFee = toNumber(c.examFee);
  const certificateFee = toNumber(c.certificateFee);
  return {
    id: c.id,
    code: c.code,
    slug: c.slug,
    name: c.name,
    shortDescription: c.shortDescription,
    image: c.image,
    icon: c.icon,
    durationText: c.durationText,
    durationWeeks: c.durationWeeks,
    level: c.level,
    mode: c.mode,
    courseFee,
    registrationFee,
    examFee,
    certificateFee,
    totalFee: courseFee + registrationFee + examFee + certificateFee,
    scholarshipAvailable: c.scholarshipAvailable,
    scholarshipNote: c.scholarshipNote,
    isFeatured: c.isFeatured,
    category: c.category,
  };
}

export async function listPublicCourses(opts: { featured?: boolean; limit?: number } = {}): Promise<PublicCourseCard[]> {
  const rows = await db.course.findMany({
    where: { status: "ACTIVE", deletedAt: null, ...(opts.featured ? { isFeatured: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: opts.limit,
    select: publicCourseSelect,
  });
  return rows.map(toCourseCard);
}

export async function listPrograms() {
  return db.program.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
}

export async function getProgram(slug: string) {
  return db.program.findFirst({ where: { slug, isActive: true } });
}

export async function listSuccessStories(opts: { limit?: number; courseSlug?: string } = {}) {
  return db.successStory.findMany({
    where: { isPublished: true, ...(opts.courseSlug ? { course: { slug: opts.courseSlug } } : {}) },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: opts.limit,
    include: { course: { select: { slug: true, name: true } }, center: { select: { slug: true, state: { select: { slug: true } }, district: { select: { slug: true } } } } },
  });
}

export async function listPartners() {
  return db.partner.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function listFaqs() {
  return db.faq.findMany({ where: { isPublished: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
}

export async function listScholarshipPrograms() {
  const today = new Date();
  const rows = await db.scholarshipProgram.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  return rows
    .filter((p) => (!p.startDate || p.startDate <= today) && (!p.endDate || p.endDate >= today))
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      description: p.description,
      percentage: p.percentage,
      fixedAmount: p.fixedAmount === null ? null : toNumber(p.fixedAmount),
      maxAmount: p.maxAmount === null ? null : toNumber(p.maxAmount),
      eligibilityCriteria: p.eligibilityCriteria,
    }));
}

/** Largest scholarship (in rupees) any active program could grant on a given fee. */
export function maxScholarshipFor(fee: number, programs: { percentage: number | null; fixedAmount: number | null; maxAmount: number | null }[]) {
  let best = 0;
  for (const p of programs) {
    let amount = 0;
    if (p.percentage) amount = (fee * p.percentage) / 100;
    else if (p.fixedAmount) amount = p.fixedAmount;
    if (p.maxAmount !== null && p.maxAmount > 0) amount = Math.min(amount, p.maxAmount);
    amount = Math.min(amount, fee);
    if (amount > best) best = amount;
  }
  return Math.round(best);
}

// ───────────────────────────── Homepage ─────────────────────────────

export const HOME_SECTION_KEYS = [
  "home.hero",
  "home.trust",
  "home.about",
  "home.programs",
  "home.courses",
  "home.centerSearch",
  "home.process",
  "home.fees",
  "home.why",
  "home.impact",
  "home.stories",
  "home.cta",
];

export interface FeePresentation {
  course: { name: string; slug: string };
  originalFee: number;
  scholarshipUpTo: number;
  yourFeeFrom: number;
}

export async function getHomepageData() {
  const [sections, programs, featuredCourses, stories, partners, coverage, impact, scholarships, homeCenters] = await Promise.all([
    getSections(HOME_SECTION_KEYS),
    listPrograms(),
    listPublicCourses({ featured: true, limit: 6 }),
    listSuccessStories({ limit: 3 }),
    listPartners(),
    coverageStats(),
    getImpactStats(),
    listScholarshipPrograms(),
    // A failure only hides the phone "Training centres" rail.
    listHomeCenters(8).catch(() => []),
  ]);

  let feeCourse = featuredCourses.find((c) => c.scholarshipAvailable && c.courseFee > 0) ?? null;
  if (!feeCourse) {
    const all = await listPublicCourses();
    feeCourse = all.find((c) => c.scholarshipAvailable && c.courseFee > 0) ?? null;
  }
  let fees: FeePresentation | null = null;
  if (feeCourse) {
    const scholarshipUpTo = maxScholarshipFor(feeCourse.courseFee, scholarships);
    fees = {
      course: { name: feeCourse.name, slug: feeCourse.slug },
      originalFee: feeCourse.courseFee,
      scholarshipUpTo,
      yourFeeFrom: Math.max(0, feeCourse.courseFee - scholarshipUpTo),
    };
  }

  return { sections, programs, featuredCourses, stories, partners, coverage, impact, fees, homeCenters };
}

// ───────────────────────────── Locations ─────────────────────────────

export async function getStateBySlug(slug: string) {
  return db.state.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, slug: true, code: true } });
}

export async function getDistrictBySlug(stateSlug: string, districtSlug: string) {
  return db.district.findFirst({
    where: { slug: districtSlug, isActive: true, state: { slug: stateSlug } },
    select: { id: true, name: true, slug: true, state: { select: { id: true, name: true, slug: true } } },
  });
}

/** States that have at least one ACTIVE center, with center counts. */
export async function listStatesWithCenters() {
  const groups = await db.center.groupBy({ by: ["stateId"], where: { deletedAt: null, status: "ACTIVE" }, _count: { _all: true } });
  if (groups.length === 0) return [];
  const states = await db.state.findMany({ where: { id: { in: groups.map((g) => g.stateId) } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
  const counts = new Map(groups.map((g) => [g.stateId, g._count._all]));
  return states.map((s) => ({ ...s, centerCount: counts.get(s.id) ?? 0 }));
}

/** Districts of a state that have at least one ACTIVE center, with center counts. */
export async function listDistrictsWithCenters(stateId: string) {
  const groups = await db.center.groupBy({ by: ["districtId"], where: { deletedAt: null, status: "ACTIVE", stateId }, _count: { _all: true } });
  if (groups.length === 0) return [];
  const districts = await db.district.findMany({ where: { id: { in: groups.map((g) => g.districtId) } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
  const counts = new Map(groups.map((g) => [g.districtId, g._count._all]));
  return districts.map((d) => ({ ...d, centerCount: counts.get(d.id) ?? 0 }));
}

/** Active centers offering a course (for the course detail page). */
export async function listCentersForCourse(courseId: string) {
  const rows = await db.centerCourse.findMany({
    where: { courseId, isActive: true, center: { deletedAt: null, status: "ACTIVE" } },
    select: {
      center: {
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          villageTown: true,
          isVerified: true,
          state: { select: { name: true, slug: true } },
          district: { select: { name: true, slug: true } },
          block: { select: { name: true } },
        },
      },
    },
    orderBy: { center: { name: "asc" } },
  });
  return rows.map((r) => r.center);
}

export async function getDocumentTypeNames(keys: string[]) {
  if (keys.length === 0) return [] as { key: string; name: string; description: string | null; isRequired: boolean }[];
  const rows = await db.documentType.findMany({ where: { key: { in: keys } }, orderBy: { sortOrder: "asc" }, select: { key: true, name: true, description: true, isRequired: true } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return keys.map((k) => byKey.get(k) ?? { key: k, name: k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()), description: null, isRequired: false });
}

/** Total number of active centers – used for section copy and the sitemap. */
export async function listAllCenterUrls() {
  const rows = await db.center.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { slug: true, updatedAt: true, state: { select: { slug: true } }, district: { select: { slug: true } } },
  });
  return rows.map((r) => ({ url: `/training-centers/${r.state.slug}/${r.district.slug}/${r.slug}`, stateUrl: `/training-centers/${r.state.slug}`, districtUrl: `/training-centers/${r.state.slug}/${r.district.slug}`, updatedAt: r.updatedAt }));
}
