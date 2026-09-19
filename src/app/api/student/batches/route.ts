import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { availableBatches, formatSchedule } from "@/server/batches";

const schema = z.object({ centerId: z.string().uuid("Select a center"), courseId: z.string().uuid("Select a course") });

/** GET /api/student/batches?centerId&courseId – open batches with live seat availability. */
export const GET = apiHandler({ roles: ["STUDENT"] }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const batches = await availableBatches(q.centerId, q.courseId);
  return { batches: batches.map((b) => ({ ...b, schedule: formatSchedule(b) })) };
});
