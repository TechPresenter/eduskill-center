import { apiHandler, parseBody } from "@/lib/api/handler";
import { createEmailTemplate, listEmailTemplates, templateInput } from "@/server/email";

/** Starter layouts plus the Foundation's saved templates (composer picker and the Templates tab). */
export const GET = apiHandler({ permission: ["email.send", "email.templates"] }, async () => listEmailTemplates());

export const POST = apiHandler({ permission: "email.templates" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, templateInput);
  return createEmailTemplate(body, { user: user!, ip, userAgent });
});
