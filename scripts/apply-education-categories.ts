/**
 * Adds the catalogue above Normal Education (Class 1–4) — School Education (Class 5–10),
 * Senior Secondary (Class 11–12) and Competitive Exam Training:
 *
 *  - creates/updates the three course categories with the sortOrder that puts them 2nd, 3rd
 *    and 4th behind Normal Education (Class 1–4) in the header's "Popular courses" menu,
 *  - creates/updates one ACTIVE course per school class (Class 5–12) plus one general
 *    competitive-exam course, all free, so each category qualifies for the menu
 *    (src/server/nav-menu.ts lists only categories that have at least one ACTIVE course)
 *    and /courses?category=<slug> is never an empty page,
 *  - offers every new course at every active training centre, exactly as
 *    scripts/apply-shiksha-mission.ts does for Class 1–4.
 *
 * Idempotent: every row is upserted by its natural key (category slug, course code,
 * centre+course), so a second run changes nothing but the rows' own updatedAt. It never
 * deactivates or edits the Class 1–4 courses, any other course, or any category outside
 * the three below.
 *
 * ORDER MATTERS — run this AFTER scripts/apply-shiksha-mission.ts, never before. Step 6 of
 * that script deactivates every ACTIVE course whose code is not CLASS-1…CLASS-4, which today
 * means all nine courses created here. Running `npm run content:shiksha` on its own therefore
 * empties these three categories, and because src/server/nav-menu.ts only lists categories
 * that have at least one ACTIVE course, they silently drop out of the header's "Popular
 * courses" menu and their /courses?category=<slug> pages go empty. prisma/seed.ts already
 * calls the two in the right order; a standalone shiksha run must be followed by
 * `npm run content:education`. The durable fix is to add these codes to that script's
 * `notIn` list.
 *
 * It deliberately does NOT create batches. The Shiksha Mission script does, because Class 1–4
 * fits four staggered slots in a centre's day; nine more classes do not, and inventing a
 * timetable (or a trainer for it) is not this script's call. Applications do not need a batch
 * (Application.batchId is nullable, and the apply wizard offers "let the Foundation allocate a
 * batch"), so admissions still work — the Foundation adds batches from Admin → Batches.
 *
 *   npx tsx scripts/apply-education-categories.ts
 *   npm run content:education
 */
import "dotenv/config";
import path from "node:path";
import { db } from "../src/lib/db";
import { slugify } from "../src/lib/utils";
import {
  EDUCATION_CATEGORIES,
  classAgeBand,
  educationCertificateEligibility,
  educationCourseDescription,
  educationEligibility,
} from "../prisma/seed-data/education-categories";

export interface ApplyEducationCategoriesOptions {
  quiet?: boolean;
}

export async function applyEducationCategories(
  opts: ApplyEducationCategoriesOptions = {}
): Promise<{ categories: number; courses: number; centersLinked: number }> {
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };

  // 1. The three categories and their courses
  const courseIds: string[] = [];
  for (const cat of EDUCATION_CATEGORIES) {
    const category = await db.courseCategory.upsert({
      where: { slug: slugify(cat.name) },
      create: {
        name: cat.name,
        slug: slugify(cat.name),
        icon: cat.icon,
        description: cat.description,
        sortOrder: cat.sortOrder,
      },
      // Same fields the Shiksha Mission script refreshes, plus the icon: the menu resolves it
      // through DynamicIcon's allow-list, so it has to stay a name that list knows.
      update: { icon: cat.icon, description: cat.description, sortOrder: cat.sortOrder },
    });
    log(`category: ${category.name} (sortOrder ${category.sortOrder})`);

    for (const course of cat.courses) {
      const band = course.classNumber === null ? null : classAgeBand(course.classNumber);
      const row = await db.course.upsert({
        where: { code: course.code },
        create: {
          code: course.code,
          slug: slugify(course.name),
          name: course.name,
          categoryId: category.id,
          shortDescription: course.shortDescription,
          description: educationCourseDescription(cat, course),
          icon: course.icon,
          durationText: course.durationText,
          durationWeeks: course.durationWeeks,
          level: "BEGINNER",
          mode: "OFFLINE",
          eligibility: educationEligibility(course),
          minAge: band?.minAge ?? null,
          maxAge: band?.maxAge ?? null,
          totalClasses: course.totalClasses,
          courseFee: 0,
          registrationFee: 0,
          examFee: 0,
          certificateFee: 0,
          scholarshipAvailable: false,
          certificateEligibility: educationCertificateEligibility(course),
          minAttendancePct: 75,
          passingMarksPct: 40,
          requiredDocuments: ["photo", "id_proof"],
          status: "ACTIVE",
          // Left off the home page's featured rail on purpose: that rail shows six courses and
          // is Class 1–4 today. The Foundation features any of these from Admin → Courses.
          isFeatured: false,
          sortOrder: course.sortOrder,
          seoTitle: `${course.name} – ${cat.name}`,
          seoDescription: course.shortDescription,
        },
        update: {
          categoryId: category.id,
          shortDescription: course.shortDescription,
          description: educationCourseDescription(cat, course),
          eligibility: educationEligibility(course),
          minAge: band?.minAge ?? null,
          maxAge: band?.maxAge ?? null,
          durationText: course.durationText,
          durationWeeks: course.durationWeeks,
          totalClasses: course.totalClasses,
          status: "ACTIVE",
          sortOrder: course.sortOrder,
        },
      });
      courseIds.push(row.id);
      log(`course: ${row.code} ${row.name}`);
    }
  }

  // 2. Offer every new course at every centre, as Class 1–4 is offered
  const centers = await db.center.findMany({ where: { deletedAt: null }, select: { id: true } });
  let centersLinked = 0;
  for (const center of centers) {
    for (const courseId of courseIds) {
      await db.centerCourse.upsert({
        where: { centerId_courseId: { centerId: center.id, courseId } },
        create: { centerId: center.id, courseId },
        update: { isActive: true },
      });
    }
    centersLinked++;
  }
  log(`centres offering the new courses: ${centersLinked}`);

  return { categories: EDUCATION_CATEGORIES.length, courses: courseIds.length, centersLinked };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-education-categories.ts"))) {
  applyEducationCategories()
    .then(async (r) => {
      console.log(
        `\nCatalogue applied: ${r.categories} categories, ${r.courses} courses, ${r.centersLinked} centres.` +
          `\nThe header menu is cached for 60s, so it shows the new categories within a minute (immediately after any CMS or category edit revalidates it).`
      );
      await db.$disconnect();
    })
    .catch(async (e: unknown) => {
      console.error(e);
      await db.$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
