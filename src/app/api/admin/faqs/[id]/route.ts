import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteFaq, faqSchema, updateFaq } from "@/server/content";

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, faqSchema);
  return updateFaq(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteFaq(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
