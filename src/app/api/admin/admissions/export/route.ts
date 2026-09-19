import { apiHandler, parseQuery } from "@/lib/api/handler";
import { admissionListSchema, collectAll, csvResponse, listAdmissions } from "@/server/admissions";
import { formatDate } from "@/lib/utils";

export const GET = apiHandler({ permission: "admissions.export" }, async ({ req }) => {
  const q = parseQuery(req, admissionListSchema);
  const rows = await collectAll(listAdmissions, q);
  return csvResponse(
    `admissions-${formatDate(new Date(), "yyyy-MM-dd")}.csv`,
    ["Admission No", "Application No", "Student", "Student ID", "Mobile", "Course", "Center", "Center code", "Batch", "Trainer", "Status", "Admitted", "Completed", "Classes held", "Classes attended", "Attendance %", "Assessment avg %", "Completion %", "Certificate eligible", "Certificate No"],
    rows.map((a) => [
      a.admissionNo,
      a.application.applicationNo,
      a.student.name,
      a.student.studentId,
      a.student.mobile,
      a.course.name,
      a.center.name,
      a.center.code,
      a.batch.code,
      a.trainer?.user.name,
      a.status,
      a.admittedAt,
      a.completedAt,
      a.progress?.classesHeld,
      a.progress?.classesAttended,
      a.progress?.attendancePct,
      a.progress?.assessmentAvgPct,
      a.progress?.completionPct,
      a.progress?.certificateEligible,
      a.certificate?.certificateNo,
    ])
  );
});
