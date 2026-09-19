import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { cmsPageListSchema, cmsPageSchema, createCmsPage, listCmsPages } from "@/server/cms-admin";

export const GET = apiHandler({ permission: "cms.view" }, async ({ req }) => listCmsPages(parseQuery(req, cmsPageListSchema)));

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, cmsPageSchema);
  return createCmsPage(body, { user: user!, ip, userAgent });
});
