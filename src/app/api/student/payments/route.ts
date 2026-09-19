import { apiHandler } from "@/lib/api/handler";
import { listStudentFeeSummaries, listStudentPayments } from "@/server/student-portal";

/** GET /api/student/payments – fee summaries per application and the student's payment history. */
export const GET = apiHandler({ roles: ["STUDENT"] }, async ({ user }) => {
  const studentId = user!.student!.id;
  const [applications, payments] = await Promise.all([listStudentFeeSummaries(studentId), listStudentPayments(studentId)]);
  return { applications, payments };
});
