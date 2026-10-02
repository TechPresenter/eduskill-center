import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { deleteEmailTemplate, templateInput, updateEmailTemplate } from "@/server/email";

export const PUT = apiHandler<{ id: string }>({ permission: "email.templates" }, async ({ req, params, user, ip, userAgent }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Email template");
  const body = await parseBody(req, templateInput);
  return updateEmailTemplate(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "email.templates" }, async ({ params, user, ip, userAgent }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Email template");
  await deleteEmailTemplate(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
