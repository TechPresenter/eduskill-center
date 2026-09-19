import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { getCourseForApply } from "@/server/student-portal";

/** GET /api/student/courses/[id] – course details with fee breakdown and required documents for the apply wizard. */
export const GET = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ params }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Course");
  return getCourseForApply(params.id);
});
