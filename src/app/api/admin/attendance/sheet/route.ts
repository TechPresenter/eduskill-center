import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { attendanceSheet } from "@/server/attendance";

const schema = z.object({ batchId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD") });

/** Roster of a batch for a date with any existing marks. */
export const GET = apiHandler({ permission: "attendance.view" }, async ({ req }) => {
  const q = parseQuery(req, schema);
  return attendanceSheet(q.batchId, q.date);
});
