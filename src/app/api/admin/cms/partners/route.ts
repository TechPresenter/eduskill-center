import { apiHandler, parseBody } from "@/lib/api/handler";
import { createPartner, listPartners, partnerSchema } from "@/server/cms-admin";

export const GET = apiHandler({ permission: "cms.view" }, async () => listPartners());

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, partnerSchema);
  return createPartner(body, { user: user!, ip, userAgent });
});
