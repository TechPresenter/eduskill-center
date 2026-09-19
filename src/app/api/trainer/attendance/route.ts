import { z } from "zod";
import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { uuid } from "@/lib/validation/common";
import { assertBatchAccess, attendanceSheet, markAttendance } from "@/server/attendance";
import { assertActiveTrainer, isoDay, trainerOf, utcToday } from "@/server/trainer-scope";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const sheetQuery = z.object({ batchId: uuid, date: day.optional() });

/** GET /api/trainer/attendance?batchId=&date=YYYY-MM-DD → roster with any existing marks for that day. */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ req, user }) => {
  trainerOf(user);
  const q = parseQuery(req, sheetQuery);
  await assertBatchAccess(user!, q.batchId, "attendance.view");
  return attendanceSheet(q.batchId, q.date ?? isoDay(utcToday()));
});

const markSchema = z.object({
  batchId: uuid,
  date: day,
  records: z
    .array(
      z.object({
        studentId: uuid,
        status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]),
        remarks: z.string().trim().max(300).optional().nullable(),
      })
    )
    .min(1, "Mark at least one student")
    .max(500),
});

/** POST /api/trainer/attendance { batchId, date, records[] } → upserts marks and recomputes progress. */
export const POST = apiHandler({ roles: ["TRAINER"] }, async ({ req, user, ip, userAgent }) => {
  assertActiveTrainer(user);
  const body = await parseBody(req, markSchema);
  return markAttendance(body, user!, { ip, userAgent });
});
