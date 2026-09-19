import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { assignmentSubmissions } from "@/server/coursework";
import { trainerOf } from "@/server/trainer-scope";

/** GET /api/trainer/assignments/[id]/submissions → batch roster with each student's submission. */
export const GET = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ user, params }) => {
  trainerOf(user);
  if (!isUuid(params.id)) throw Errors.notFound("Assignment");
  return assignmentSubmissions(params.id, user!);
});
