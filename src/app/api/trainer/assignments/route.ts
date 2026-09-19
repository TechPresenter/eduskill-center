import { z } from "zod";
import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { uuid } from "@/lib/validation/common";
import { assertBatchAccess } from "@/server/attendance";
import { assignmentSchema, createAssignment, listAssignments } from "@/server/coursework";
import { assertActiveTrainer, trainerOf } from "@/server/trainer-scope";

/** GET /api/trainer/assignments?batchId= */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ req, user }) => {
  trainerOf(user);
  const q = parseQuery(req, z.object({ batchId: uuid }));
  await assertBatchAccess(user!, q.batchId, "progress.view");
  return listAssignments(q.batchId);
});

/** POST /api/trainer/assignments */
export const POST = apiHandler({ roles: ["TRAINER"] }, async ({ req, user, ip, userAgent }) => {
  assertActiveTrainer(user);
  const body = await parseBody(req, assignmentSchema);
  return createAssignment(body, user!, { ip, userAgent });
});
