import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { assessmentResultsSheet, enterAssessmentResults, resultsSchema } from "@/server/coursework";
import { assertActiveTrainer, trainerOf } from "@/server/trainer-scope";

/** GET /api/trainer/assessments/[id]/results → roster with existing marks/grades. */
export const GET = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ user, params }) => {
  trainerOf(user);
  if (!isUuid(params.id)) throw Errors.notFound("Assessment");
  return assessmentResultsSheet(params.id, user!);
});

/** PUT (or POST) /api/trainer/assessments/[id]/results { results: [{ studentId, marks, remarks }] } → upsert + progress recompute. */
export const PUT = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ req, user, params, ip, userAgent }) => {
  assertActiveTrainer(user);
  if (!isUuid(params.id)) throw Errors.notFound("Assessment");
  const body = await parseBody(req, resultsSchema);
  return enterAssessmentResults(params.id, body, user!, { ip, userAgent });
});

export const POST = PUT;
