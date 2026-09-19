import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { submitApplication } from "@/server/applications";

/** POST /api/student/applications/[id]/submit – DRAFT → SUBMITTED (requires all documents). */
export const POST = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ params, user, ip, userAgent }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Application");
  const app = await submitApplication(params.id, user!.student!.id, { ip, userAgent });
  return { id: app.id, applicationNo: app.applicationNo, status: app.status, submittedAt: app.submittedAt };
});
