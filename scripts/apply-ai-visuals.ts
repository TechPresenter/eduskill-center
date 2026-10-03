/**
 * Points the website at the photographs made by scripts/generate-ai-media.ts:
 *
 *   - each course's cover (`course.image`) → /media/ai/courses/<slug>.webp
 *   - each programme's picture (`program.image`) → /media/ai/programs/<slug>.webp
 *   - the Shiksha Mission and Open-a-Centre hero slides → their cut-out figures
 *
 * Only DEFAULT artwork is replaced: an empty field, the old shared cover (/media/course-cover.jpg),
 * the old bundled PNGs under /media/courses|programs/, or an earlier /media/ai/ file. Anything an
 * admin uploaded in Admin → Courses / CMS is left alone unless --force is given. Every change is
 * written to the audit log as a System action.
 *
 * Idempotent; reads public/media/ai/manifest.json, so it only ever points at files that exist.
 *
 *   npx tsx scripts/apply-ai-visuals.ts            # apply
 *   npx tsx scripts/apply-ai-visuals.ts --dry-run  # only report what would change
 *   npx tsx scripts/apply-ai-visuals.ts --force    # also replace admin-uploaded images
 *   npm run content:visuals
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { db, type Prisma } from "../src/lib/db";
import { audit } from "../src/lib/audit";

const MANIFEST = path.resolve(process.cwd(), "public", "media", "ai", "manifest.json");
const OLD_SHARED_COVER = "/media/course-cover.jpg";

/** Which hero slide gets which figure: matched on the slide's own content, not its position. */
const HERO_FIGURES: { id: string; matches: (slide: Record<string, unknown>) => boolean }[] = [
  { id: "hero-shiksha-student", matches: (s) => /shiksha/i.test(String(s.eyebrow ?? "")) },
  { id: "hero-centre-teacher", matches: (s) => String(s.primaryHref ?? "") === "/open-a-centre" },
];

export interface ApplyAiVisualsOptions {
  dryRun?: boolean;
  /** Replace images an admin uploaded too, not just the defaults. */
  force?: boolean;
  quiet?: boolean;
}

export interface ApplyAiVisualsResult {
  courses: number;
  programs: number;
  heroSlides: number;
  skipped: string[];
}

/** True when `current` is default artwork this script may replace. */
function isDefaultArtwork(current: string | null | undefined): boolean {
  const v = (current ?? "").trim();
  return v === "" || v === OLD_SHARED_COVER || v.startsWith("/media/courses/") || v.startsWith("/media/programs/") || v.startsWith("/media/ai/");
}

async function readManifest(): Promise<Map<string, string>> {
  try {
    const parsed = JSON.parse(await fs.readFile(MANIFEST, "utf8")) as { assets?: Record<string, { file?: string }> };
    const files = new Map<string, string>();
    for (const [id, entry] of Object.entries(parsed.assets ?? {})) {
      if (!entry?.file) continue;
      // Only point at files that are really there.
      const onDisk = path.resolve(process.cwd(), "public", entry.file.replace(/^\/+/, ""));
      if (await fs.stat(onDisk).then((s) => s.isFile() && s.size > 0).catch(() => false)) files.set(id, entry.file);
    }
    return files;
  } catch {
    return new Map();
  }
}

export async function applyAiVisuals(opts: ApplyAiVisualsOptions = {}): Promise<ApplyAiVisualsResult> {
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };
  const dry = !!opts.dryRun;
  const result: ApplyAiVisualsResult = { courses: 0, programs: 0, heroSlides: 0, skipped: [] };
  const files = await readManifest();
  if (files.size === 0) {
    log("No generated images found (public/media/ai/manifest.json). Run scripts/generate-ai-media.ts first.");
    return result;
  }

  // ── Courses ──
  for (const [id, file] of files) {
    if (!id.startsWith("course-")) continue;
    const slug = id.slice("course-".length);
    const course = await db.course.findFirst({ where: { slug, deletedAt: null }, select: { id: true, name: true, image: true, bannerImage: true } });
    if (!course) {
      result.skipped.push(`${id}: no course with slug "${slug}"`);
      continue;
    }
    if (course.image === file && course.bannerImage !== OLD_SHARED_COVER) continue;
    if (!opts.force && !isDefaultArtwork(course.image)) {
      result.skipped.push(`${id}: ${course.name} has an uploaded cover (${course.image}) — kept`);
      continue;
    }
    // A banner that is still the old shared cover would win over the new image on the course page.
    const data: Prisma.CourseUpdateInput = { image: file, ...(course.bannerImage === OLD_SHARED_COVER ? { bannerImage: null } : {}) };
    log(`course   ${course.name}: ${course.image || "(none)"} → ${file}`);
    if (!dry) {
      await db.course.update({ where: { id: course.id }, data });
      await audit({ action: "update", module: "courses", recordType: "Course", recordId: course.id, description: `System set the generated cover for ${course.name}`, oldValue: { image: course.image, bannerImage: course.bannerImage }, newValue: data });
    }
    result.courses++;
  }

  // ── Programmes ──
  for (const [id, file] of files) {
    if (!id.startsWith("program-")) continue;
    const slug = id.slice("program-".length);
    const program = await db.program.findUnique({ where: { slug }, select: { id: true, title: true, image: true } });
    if (!program) {
      result.skipped.push(`${id}: no programme with slug "${slug}"`);
      continue;
    }
    if (program.image === file) continue;
    if (!opts.force && !isDefaultArtwork(program.image)) {
      result.skipped.push(`${id}: ${program.title} has an uploaded picture (${program.image}) — kept`);
      continue;
    }
    log(`program  ${program.title}: ${program.image || "(none)"} → ${file}`);
    if (!dry) {
      await db.program.update({ where: { id: program.id }, data: { image: file } });
      await audit({ action: "update", module: "cms", recordType: "Program", recordId: program.id, description: `System set the generated picture for ${program.title}`, oldValue: { image: program.image }, newValue: { image: file } });
    }
    result.programs++;
  }

  // ── Hero slides (only when the hero has been saved in Admin → CMS; otherwise the code defaults apply) ──
  const hero = await db.cmsSection.findUnique({ where: { key: "home.hero" } });
  const data = hero?.data && typeof hero.data === "object" && !Array.isArray(hero.data) ? (hero.data as Record<string, unknown>) : null;
  if (hero && data && Array.isArray(data.slides)) {
    const slides = (data.slides as unknown[]).map((s) => (s && typeof s === "object" ? { ...(s as Record<string, unknown>) } : s));
    let changed = 0;
    for (const figure of HERO_FIGURES) {
      const file = files.get(figure.id);
      if (!file) continue;
      const slide = slides.find((s): s is Record<string, unknown> => !!s && typeof s === "object" && figure.matches(s as Record<string, unknown>));
      if (!slide || slide.imageUrl === file) continue;
      if (!opts.force && !isDefaultArtwork(String(slide.imageUrl ?? ""))) {
        result.skipped.push(`${figure.id}: hero slide "${String(slide.eyebrow ?? "")}" has an uploaded image — kept`);
        continue;
      }
      log(`hero     slide "${String(slide.eyebrow ?? "")}": ${String(slide.imageUrl || "(default photo)")} → ${file}`);
      slide.imageUrl = file;
      changed++;
    }
    if (changed && !dry) {
      await db.cmsSection.update({ where: { key: "home.hero" }, data: { data: { ...data, slides } as Prisma.InputJsonValue } });
      await audit({ action: "update", module: "cms", recordType: "CmsSection", recordId: hero.id, description: `System set generated figures on ${changed} hero slide(s)` });
    }
    result.heroSlides = changed;
  } else {
    log("hero     not saved in the CMS yet — the slides use the code defaults (src/lib/cms/sections.ts)");
  }

  for (const s of result.skipped) log(`skip     ${s}`);
  log(`${dry ? "DRY RUN — would update" : "Updated"}: ${result.courses} course(s), ${result.programs} programme(s), ${result.heroSlides} hero slide(s).`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-ai-visuals.ts"))) {
  applyAiVisuals({ dryRun: process.argv.includes("--dry-run"), force: process.argv.includes("--force") })
    .then(async () => {
      await db.$disconnect();
    })
    .catch(async (e: unknown) => {
      console.error(e);
      await db.$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
