/**
 * Makes Project EduSkill Shiksha Mission the live catalogue:
 *
 *  - creates the "Normal Education (Class 1–4)" course category and the four class courses
 *    (Class 1–4, each with Hindi / English / Mathematics / EVS),
 *  - adds the Shiksha Mission programme entry to the website's Programs list,
 *  - offers all four classes at every active training centre,
 *  - deactivates the older skill/computer demo courses so they leave the public catalogue
 *    (they are only hidden — existing batches, admissions and records are untouched, and a
 *    Super Admin can re-activate any of them from Admin → Courses).
 *
 *   npx tsx scripts/apply-shiksha-mission.ts
 *   npx tsx scripts/apply-shiksha-mission.ts --keep-old   # leave the old courses active
 */
import "dotenv/config";
import path from "node:path";
import { db } from "../src/lib/db";
import { slugify } from "../src/lib/utils";
import { generateBatchCode } from "../src/lib/ids";
import {
  SHIKSHA_CATEGORY,
  SHIKSHA_CLASSES,
  SHIKSHA_PROGRAM,
  shikshaDescription,
  shikshaSyllabus,
} from "../prisma/seed-data/shiksha-mission";

/** Monday–Saturday; centres are closed on Sunday. */
const CLASS_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Staggered slots so one room can run all four classes in a day. */
const CLASS_SLOTS = [
  { startTime: "08:00", endTime: "10:00" },
  { startTime: "10:00", endTime: "12:00" },
  { startTime: "14:00", endTime: "16:00" },
  { startTime: "16:00", endTime: "18:00" },
];

/** The Indian academic year (April–March) that today falls in. */
function academicYearWindow(today = new Date()) {
  const y = today.getUTCMonth() >= 3 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  return {
    start: new Date(Date.UTC(y, 3, 1)),
    end: new Date(Date.UTC(y + 1, 2, 31)),
    label: `${y}–${String(y + 1).slice(2)}`,
  };
}

/** A class of 25–40 children, scaled to what the centre can seat. */
function batchCapacity(centerCapacity: number) {
  if (!centerCapacity) return 30;
  return Math.max(25, Math.min(40, Math.round(centerCapacity / 4)));
}

export interface ApplyShikshaOptions {
  /** Leave the pre-existing skill/computer courses ACTIVE instead of hiding them. */
  keepOld?: boolean;
  quiet?: boolean;
}

export async function applyShikshaMission(opts: ApplyShikshaOptions = {}): Promise<{ courses: number; centersLinked: number; batches: number; deactivated: number }> {
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };

  // 1. Category
  const category = await db.courseCategory.upsert({
    where: { slug: slugify(SHIKSHA_CATEGORY.name) },
    create: {
      name: SHIKSHA_CATEGORY.name,
      slug: slugify(SHIKSHA_CATEGORY.name),
      icon: SHIKSHA_CATEGORY.icon,
      description: SHIKSHA_CATEGORY.description,
      sortOrder: SHIKSHA_CATEGORY.sortOrder,
    },
    update: { description: SHIKSHA_CATEGORY.description, sortOrder: SHIKSHA_CATEGORY.sortOrder },
  });
  log(`category: ${category.name}`);

  // 2. The four classes as courses
  const courseIds: string[] = [];
  for (const [i, c] of SHIKSHA_CLASSES.entries()) {
    const course = await db.course.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        slug: slugify(c.name),
        name: c.name,
        categoryId: category.id,
        shortDescription: c.shortDescription,
        description: shikshaDescription(c),
        icon: "BookOpen",
        durationText: "Full academic year",
        durationWeeks: 40,
        level: "BEGINNER",
        mode: "OFFLINE",
        eligibility: `Children of ${c.name} age (about ${c.minAge}–${c.maxAge} years). Open to all children in the centre's village or panchayat.`,
        minAge: c.minAge,
        maxAge: c.maxAge,
        syllabus: shikshaSyllabus(),
        totalClasses: 200,
        courseFee: 0,
        registrationFee: 0,
        examFee: 0,
        certificateFee: 0,
        scholarshipAvailable: false,
        certificateEligibility: "Minimum 75% attendance and completion of the monthly assessments.",
        minAttendancePct: 75,
        passingMarksPct: 40,
        requiredDocuments: ["photo", "id_proof"],
        status: "ACTIVE",
        isFeatured: true,
        sortOrder: i + 1,
        seoTitle: `${c.name} – EduSkill Shiksha Mission`,
        seoDescription: c.shortDescription,
      },
      update: {
        categoryId: category.id,
        shortDescription: c.shortDescription,
        description: shikshaDescription(c),
        syllabus: shikshaSyllabus(),
        eligibility: `Children of ${c.name} age (about ${c.minAge}–${c.maxAge} years). Open to all children in the centre's village or panchayat.`,
        minAge: c.minAge,
        maxAge: c.maxAge,
        status: "ACTIVE",
        isFeatured: true,
        sortOrder: i + 1,
      },
    });
    courseIds.push(course.id);
    log(`course: ${course.code} ${course.name}`);
  }

  // 3. Programme entry on the website
  await db.program.upsert({
    where: { slug: slugify(SHIKSHA_PROGRAM.title) },
    create: {
      title: SHIKSHA_PROGRAM.title,
      slug: slugify(SHIKSHA_PROGRAM.title),
      icon: SHIKSHA_PROGRAM.icon,
      summary: SHIKSHA_PROGRAM.summary,
      content: SHIKSHA_PROGRAM.content,
      sortOrder: 0,
      isActive: true,
    },
    update: { summary: SHIKSHA_PROGRAM.summary, content: SHIKSHA_PROGRAM.content, icon: SHIKSHA_PROGRAM.icon, sortOrder: 0, isActive: true },
  });
  log(`program: ${SHIKSHA_PROGRAM.title}`);

  // 4. Offer every class at every active centre
  const centers = await db.center.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true, capacity: true, status: true },
  });
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
  log(`centres offering Class 1–4: ${centersLinked}`);

  // 5. One running batch per class at every active centre, so children can be admitted
  //    straight away. Timings are staggered through the day; the Foundation edits them,
  //    assigns a trainer and adds more batches from Admin → Batches.
  const { start, end, label: academicYear } = academicYearWindow();
  let batches = 0;
  for (const center of centers) {
    if (center.status !== "ACTIVE") continue;
    for (const [i, cls] of SHIKSHA_CLASSES.entries()) {
      const courseId = courseIds[i]!;
      const existing = await db.batch.findFirst({
        where: { centerId: center.id, courseId, deletedAt: null, startDate: start },
        select: { id: true },
      });
      if (existing) continue;
      const slot = CLASS_SLOTS[i]!;
      await db.batch.create({
        data: {
          code: await generateBatchCode(center.code),
          name: `${cls.name} – ${academicYear}`,
          centerId: center.id,
          courseId,
          startDate: start,
          endDate: end,
          startTime: slot.startTime,
          endTime: slot.endTime,
          days: CLASS_DAYS,
          capacity: batchCapacity(center.capacity),
          status: "ONGOING",
          notes: `${cls.name} of the EduSkill Shiksha Mission Normal Education Centre.`,
        },
      });
      batches++;
    }
  }
  log(`${academicYear} class batches created: ${batches}`);

  // 6. Hide the older skill/computer courses from the public catalogue
  let deactivated = 0;
  if (!opts.keepOld) {
    const res = await db.course.updateMany({
      where: { code: { notIn: SHIKSHA_CLASSES.map((c) => c.code) }, status: "ACTIVE", deletedAt: null },
      data: { status: "INACTIVE", isFeatured: false },
    });
    deactivated = res.count;
    log(`older courses hidden from the catalogue: ${deactivated} (re-activate any of them from Admin → Courses)`);
  }

  return { courses: courseIds.length, centersLinked, batches, deactivated };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-shiksha-mission.ts"))) {
  applyShikshaMission({ keepOld: process.argv.includes("--keep-old") })
    .then(async (r) => {
      console.log(`\nShiksha Mission applied: ${r.courses} classes, ${r.centersLinked} centres, ${r.batches} batches, ${r.deactivated} old courses hidden.`);
      await db.$disconnect();
    })
    .catch(async (e: unknown) => {
      console.error(e);
      await db.$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
