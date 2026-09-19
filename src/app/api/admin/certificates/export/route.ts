import { apiHandler, parseQuery } from "@/lib/api/handler";
import { certificateListSchema, listCertificates } from "@/server/certificates";
import { collectAll, csvResponse } from "@/server/admissions";
import { formatDate } from "@/lib/utils";

export const GET = apiHandler({ permission: "certificates.export" }, async ({ req }) => {
  const q = parseQuery(req, certificateListSchema);
  const rows = await collectAll(listCertificates, q);
  return csvResponse(
    `certificates-${formatDate(new Date(), "yyyy-MM-dd")}.csv`,
    ["Certificate No", "Status", "Student", "Student ID", "Course", "Center", "Center code", "Batch", "Admission No", "Duration", "Completed on", "Issued on", "Grade", "Verifications", "Revoked on", "Revoked reason"],
    rows.map((c) => [
      c.certificateNo,
      c.status,
      c.studentName,
      c.student.studentId,
      c.courseName,
      c.centerName,
      c.centerCode,
      c.admission.batch.code,
      c.admission.admissionNo,
      c.durationText,
      c.completionDate,
      c.issuedAt,
      c.grade,
      c.verificationCount,
      c.revokedAt,
      c.revokedReason,
    ])
  );
});
