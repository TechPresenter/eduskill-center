import { apiHandler, parseBody } from "@/lib/api/handler";
import { applyStartSchema } from "@/lib/validation/students";
import { startApplication } from "@/server/applications";
import { listStudentApplications } from "@/server/student-portal";

/** GET /api/student/applications – the student's own applications. */
export const GET = apiHandler({ roles: ["STUDENT"] }, async ({ user }) => {
  return { items: await listStudentApplications(user!.student!.id) };
});

/** POST /api/student/applications – start a new (DRAFT) application from the apply wizard. */
export const POST = apiHandler({ roles: ["STUDENT"], rateLimit: { limit: 20, windowSec: 3600, keyBy: "user", name: "apply" } }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, applyStartSchema);
  const app = await startApplication(
    {
      studentId: user!.student!.id,
      centerId: body.centerId,
      courseId: body.courseId,
      batchId: body.batchId || null,
      scholarshipRequested: !!body.scholarshipRequested,
      scholarshipReason: body.scholarshipReason || null,
    },
    { ip, userAgent }
  );
  return { id: app.id, applicationNo: app.applicationNo, status: app.status };
});
