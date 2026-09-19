import { z } from "zod";
import { db } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { optionalDate } from "@/lib/api/query";
import { batchAttendanceReport, studentAttendance } from "@/server/attendance";
import { csvResponse } from "@/server/admissions";
import { formatDate } from "@/lib/utils";

const schema = z
  .object({ batchId: z.string().uuid().optional(), studentId: z.string().uuid().optional(), from: optionalDate, to: optionalDate, mode: z.enum(["summary", "daily", "records"]).optional() })
  .refine((v) => v.batchId || v.studentId, { message: "batchId or studentId is required", path: ["batchId"] });

/**
 * CSV export. Batch: per-student summary (default) or day-by-day totals (`mode=daily`) or raw records (`mode=records`).
 * Student: all attendance records of the student.
 */
export const GET = apiHandler({ permission: "attendance.export" }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const stamp = formatDate(new Date(), "yyyy-MM-dd");
  if (q.studentId) {
    const student = await db.student.findFirst({ where: { id: q.studentId }, select: { name: true, studentId: true } });
    if (!student) throw Errors.notFound("Student");
    const { records } = await studentAttendance(q.studentId, q.batchId);
    return csvResponse(
      `attendance-${student.studentId ?? student.name}-${stamp}.csv`,
      ["Date", "Batch", "Batch code", "Course", "Status", "Remarks"],
      records.map((r) => [r.date, r.batch.name, r.batch.code, r.batch.course.name, r.status, r.remarks])
    );
  }
  const batch = await db.batch.findFirst({ where: { id: q.batchId!, deletedAt: null }, select: { code: true } });
  if (!batch) throw Errors.notFound("Batch");
  const to = q.to ? new Date(q.to.getTime() + 86400000) : undefined;
  if (q.mode === "records") {
    const records = await db.attendance.findMany({
      where: { batchId: q.batchId!, ...(q.from || to ? { date: { gte: q.from, lt: to } } : {}) },
      orderBy: [{ date: "asc" }, { student: { name: "asc" } }],
      include: { student: { select: { name: true, studentId: true } } },
    });
    return csvResponse(`attendance-${batch.code}-records-${stamp}.csv`, ["Date", "Student", "Student ID", "Status", "Remarks"], records.map((r) => [r.date, r.student.name, r.student.studentId, r.status, r.remarks]));
  }
  const report = await batchAttendanceReport(q.batchId!, { from: q.from, to });
  if (q.mode === "daily") {
    return csvResponse(
      `attendance-${batch.code}-daily-${stamp}.csv`,
      ["Date", "Present", "Absent", "Late", "Leave", "Total marked"],
      report.daily.map((d) => [d.date, d.present, d.absent, d.late, d.leave, d.present + d.absent + d.late + d.leave])
    );
  }
  return csvResponse(
    `attendance-${batch.code}-${stamp}.csv`,
    ["Student", "Student ID", "Classes held", "Present", "Late", "Absent", "Leave", "Attendance %"],
    report.rows.map((r) => [r.name, r.studentCode, r.held, r.present, r.late, r.absent, r.leave, r.pct])
  );
});
