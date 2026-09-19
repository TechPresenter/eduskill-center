import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { assignmentUpdateSchema, deleteAssignment, updateAssignment } from "@/server/coursework";
import { assertActiveTrainer } from "@/server/trainer-scope";

export const PATCH = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ req, user, params, ip, userAgent }) => {
  assertActiveTrainer(user);
  if (!isUuid(params.id)) throw Errors.notFound("Assignment");
  const body = await parseBody(req, assignmentUpdateSchema);
  return updateAssignment(params.id, body, user!, { ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ user, params, ip, userAgent }) => {
  assertActiveTrainer(user);
  if (!isUuid(params.id)) throw Errors.notFound("Assignment");
  await deleteAssignment(params.id, user!, { ip, userAgent });
  return { deleted: true };
});
