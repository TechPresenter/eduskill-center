import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { deleteDraft } from "@/server/email";

export const DELETE = apiHandler<{ id: string }>({ permission: "email.send" }, async ({ params, user, ip, userAgent }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Draft");
  await deleteDraft(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
