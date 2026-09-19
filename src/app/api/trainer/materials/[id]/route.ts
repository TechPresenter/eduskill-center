import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { deleteMaterial } from "@/server/coursework";
import { assertActiveTrainer } from "@/server/trainer-scope";

/** DELETE /api/trainer/materials/[id] → only my own uploads. */
export const DELETE = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ user, params, ip, userAgent }) => {
  assertActiveTrainer(user);
  if (!isUuid(params.id)) throw Errors.notFound("Study material");
  await deleteMaterial(params.id, user!, { ip, userAgent });
  return { deleted: true };
});
