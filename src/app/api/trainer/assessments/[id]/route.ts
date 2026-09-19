import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { assessmentUpdateSchema, deleteAssessment, updateAssessment } from "@/server/coursework";
import { assertActiveTrainer } from "@/server/trainer-scope";

export const PATCH = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ req, user, params, ip, userAgent }) => {
  assertActiveTrainer(user);
  if (!isUuid(params.id)) throw Errors.notFound("Assessment");
  const body = await parseBody(req, assessmentUpdateSchema);
  return updateAssessment(params.id, body, user!, { ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ user, params, ip, userAgent }) => {
  assertActiveTrainer(user);
  if (!isUuid(params.id)) throw Errors.notFound("Assessment");
  await deleteAssessment(params.id, user!, { ip, userAgent });
  return { deleted: true };
});
