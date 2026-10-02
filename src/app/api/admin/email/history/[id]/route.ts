import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { getEmail } from "@/server/email";

/** One email with its rendered preview. Drafts are readable by their author only; sent mail needs email.view. */
export const GET = apiHandler<{ id: string }>({ permission: ["email.view", "email.send"] }, async ({ params, user, ip, userAgent }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Email");
  return getEmail(params.id, { user: user!, ip, userAgent });
});
