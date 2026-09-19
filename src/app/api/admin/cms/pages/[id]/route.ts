import { apiHandler, parseBody } from "@/lib/api/handler";
import { cmsPageSchema, deleteCmsPage, getCmsPage, updateCmsPage } from "@/server/cms-admin";

export const GET = apiHandler<{ id: string }>({ permission: "cms.view" }, async ({ params }) => getCmsPage(params.id));

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, cmsPageSchema);
  return updateCmsPage(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteCmsPage(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
