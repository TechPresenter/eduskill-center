import { apiHandler, parseQuery } from "@/lib/api/handler";
import { applicationListSchema, listApplications } from "@/server/applications";
import { collectAll, csvResponse } from "@/server/admissions";
import { formatDate } from "@/lib/utils";

export const GET = apiHandler({ permission: "applications.export" }, async ({ req }) => {
  const q = parseQuery(req, applicationListSchema);
  const rows = await collectAll(listApplications, q);
  return csvResponse(
    `applications-${formatDate(new Date(), "yyyy-MM-dd")}.csv`,
    ["Application No", "Status", "Student", "Student ID", "Mobile", "Course", "Course code", "Center", "Center code", "State", "District", "Batch", "Original fee", "Scholarship", "Discount", "Payable", "Paid", "Due", "Scholarship requested", "Installments allowed", "Submitted", "Created"],
    rows.map((a) => [
      a.applicationNo,
      a.status,
      a.student.name,
      a.student.studentId,
      a.student.mobile,
      a.course.name,
      a.course.code,
      a.center.name,
      a.center.code,
      a.center.state.name,
      a.center.district.name,
      a.batch?.code,
      a.originalFee,
      a.scholarshipAmount,
      a.discountAmount,
      a.payableAmount,
      a.paidAmount,
      Math.max(0, a.payableAmount - a.paidAmount),
      a.scholarshipRequested,
      a.installmentsAllowed,
      a.submittedAt,
      a.createdAt,
    ])
  );
});
