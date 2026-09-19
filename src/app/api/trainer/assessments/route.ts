import { z } from "zod";
import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { uuid } from "@/lib/validation/common";
import { assertBatchAccess } from "@/server/attendance";
import { assessmentSchema, createAssessment, listAssessments } from "@/server/coursework";
import { assertActiveTrainer, trainerOf } from "@/server/trainer-scope";

/** GET /api/trainer/assessments?batchId= */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ req, user }) => {
  trainerOf(user);
  const q = parseQuery(req, z.object({ batchId: uuid }));
  await assertBatchAccess(user!, q.batchId, "progress.view");
  return listAssessments(q.batchId);
});

/** POST /api/trainer/assessments */
export const POST = apiHandler({ roles: ["TRAINER"] }, async ({ req, user, ip, userAgent }) => {
  assertActiveTrainer(user);
  const body = await parseBody(req, assessmentSchema);
  return createAssessment(body, user!, { ip, userAgent });
});
