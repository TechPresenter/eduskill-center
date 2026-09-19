import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { optionalUuid } from "@/lib/api/query";

const schema = z.object({ centerId: optionalUuid, courseId: optionalUuid });

/**
 * Picker data for trainer assignment:
 *   no params              → active/pending centers
 *   ?centerId=…            → courses offered at that center + open batches there
 *   ?centerId=…&courseId=… → open batches for that center & course
 */
export const GET = apiHandler({ permission: "trainers.view" }, async ({ req }) => {
  const q = parseQuery(req, schema);
  if (!q.centerId) {
    const centers = await db.center.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "PENDING"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, status: true, district: { select: { name: true } }, state: { select: { name: true } } },
    });
    return { centers };
  }
  const [courses, batches] = await Promise.all([
    db.centerCourse.findMany({ where: { centerId: q.centerId, isActive: true, course: { deletedAt: null } }, include: { course: { select: { id: true, name: true, code: true } } }, orderBy: { course: { name: "asc" } } }),
    db.batch.findMany({
      where: { centerId: q.centerId, courseId: q.courseId, deletedAt: null, status: { in: ["UPCOMING", "ONGOING"] } },
      orderBy: [{ status: "asc" }, { startDate: "asc" }],
      select: { id: true, name: true, code: true, status: true, courseId: true, startDate: true, days: true, startTime: true, endTime: true, trainer: { select: { trainerId: true, user: { select: { name: true } } } } },
    }),
  ]);
  return { courses: courses.map((c) => c.course), batches };
});
