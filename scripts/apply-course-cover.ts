/**
 * Points every active course at the Foundation's branded cover photo.
 *
 * Before this, four courses carried generated gradient-and-text PNGs and the other nine carried
 * nothing at all, so the catalogue showed three different kinds of artwork side by side. One real
 * photograph is more coherent than that mix, and an admin can still set a per-course image from
 * Admin → Courses afterwards — this only fills the default.
 *
 *   npx tsx scripts/apply-course-cover.ts
 *   npx tsx scripts/apply-course-cover.ts --only-empty   # leave existing artwork alone
 *   npx tsx scripts/apply-course-cover.ts --clear        # undo: blank the cover on every course
 */
import "dotenv/config";
import path from "node:path";
import { db } from "../src/lib/db";

/** Served from /public. Keep in step with the file on disk. */
export const COURSE_COVER = "/media/course-cover.jpg";

export interface ApplyCourseCoverOptions {
  /** Only fill courses that have no image, leaving any existing artwork untouched. */
  onlyEmpty?: boolean;
  /** Remove the cover again, restoring the generated placeholders. */
  clear?: boolean;
  quiet?: boolean;
}

export async function applyCourseCover(opts: ApplyCourseCoverOptions = {}): Promise<{ updated: number }> {
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };

  if (opts.clear) {
    const res = await db.course.updateMany({ where: { image: COURSE_COVER }, data: { image: null } });
    log(`cleared the shared cover from ${res.count} course(s)`);
    return { updated: res.count };
  }

  const res = await db.course.updateMany({
    where: {
      deletedAt: null,
      ...(opts.onlyEmpty ? { OR: [{ image: null }, { image: "" }] } : {}),
    },
    data: { image: COURSE_COVER },
  });
  log(`course cover set on ${res.count} course(s) → ${COURSE_COVER}`);
  return { updated: res.count };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "apply-course-cover.ts"))) {
  applyCourseCover({ onlyEmpty: process.argv.includes("--only-empty"), clear: process.argv.includes("--clear") })
    .then(async () => {
      await db.$disconnect();
    })
    .catch(async (e: unknown) => {
      console.error(e);
      await db.$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
