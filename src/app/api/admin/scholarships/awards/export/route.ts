import { apiHandler, parseQuery } from "@/lib/api/handler";
import { awardListSchema, listAwards } from "@/server/scholarship-programs";
import { collectAll, csvResponse } from "@/server/admissions";
import { formatDate } from "@/lib/utils";

export const GET = apiHandler({ permission: "scholarships.view" }, async ({ req }) => {
  const q = parseQuery(req, awardListSchema);
  const rows = await collectAll(listAwards, q);
  return csvResponse(
    `scholarship-awards-${formatDate(new Date(), "yyyy-MM-dd")}.csv`,
    ["Student", "Student ID", "Mobile", "Application No", "Application status", "Course", "Center", "Program", "Program type", "Original fee", "Scholarship", "Payable", "Award status", "Approved by", "Decided on", "Remarks", "Created"],
    rows.map((a) => [
      a.student.name,
      a.student.studentId,
      a.student.mobile,
      a.application.applicationNo,
      a.application.status,
      a.course.name,
      a.application.center.name,
      a.program?.name,
      a.program?.type,
      a.originalFee,
      a.scholarshipAmount,
      a.payableFee,
      a.status,
      a.approvedByName,
      a.approvedAt,
      a.remarks,
      a.createdAt,
    ])
  );
});
