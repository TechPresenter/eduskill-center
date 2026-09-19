import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { optionalDate } from "@/lib/api/query";
import { batchAttendanceReport } from "@/server/attendance";

const schema = z.object({ batchId: z.string().uuid(), from: optionalDate, to: optionalDate });

/** Per-student and per-day attendance summary for a batch, optionally within a date range (`to` is inclusive). */
export const GET = apiHandler({ permission: "attendance.view" }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const batch = await db.batch.findFirst({
    where: { id: q.batchId, deletedAt: null },
    select: { id: true, code: true, name: true, status: true, startDate: true, endDate: true, days: true, course: { select: { name: true, minAttendancePct: true } }, center: { select: { name: true, code: true } } },
  });
  if (!batch) throw Errors.notFound("Batch");
  const to = q.to ? new Date(q.to.getTime() + 86400000) : undefined;
  const report = await batchAttendanceReport(q.batchId, { from: q.from, to });
  return { batch, ...report };
});
