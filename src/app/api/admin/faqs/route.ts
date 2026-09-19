import { apiHandler, parseBody } from "@/lib/api/handler";
import { createFaq, faqSchema, listFaqs } from "@/server/content";

export const GET = apiHandler({ permission: "cms.view" }, async () => listFaqs());

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, faqSchema);
  return createFaq(body, { user: user!, ip, userAgent });
});
