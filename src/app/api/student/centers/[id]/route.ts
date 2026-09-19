import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { getCenterForApply } from "@/server/student-portal";

/** GET /api/student/centers/[id] – one active center (prefill for ?centerId= in the apply wizard). */
export const GET = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ params }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Training center");
  return getCenterForApply(params.id);
});
