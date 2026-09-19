import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { studentAttendance } from "@/server/attendance";

const schema = z.object({ studentId: z.string().uuid(), batchId: z.string().uuid().optional() });

/** Attendance records and per-batch summary for one student. */
export const GET = apiHandler({ permission: "attendance.view" }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const student = await db.student.findFirst({ where: { id: q.studentId, deletedAt: null }, select: { id: true, name: true, studentId: true, mobile: true, photoUrl: true } });
  if (!student) throw Errors.notFound("Student");
  const data = await studentAttendance(q.studentId, q.batchId);
  return { student, ...data };
});
