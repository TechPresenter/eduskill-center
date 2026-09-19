import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { gradeSchema, gradeSubmission } from "@/server/coursework";
import { assertActiveTrainer } from "@/server/trainer-scope";

/** POST /api/trainer/submissions/[id]/grade { marks, feedback } → GRADED + progress recompute. */
export const POST = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ req, user, params, ip, userAgent }) => {
  assertActiveTrainer(user);
  if (!isUuid(params.id)) throw Errors.notFound("Submission");
  const body = await parseBody(req, gradeSchema);
  return gradeSubmission(params.id, body, user!, { ip, userAgent });
});
