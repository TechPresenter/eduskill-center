import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { createGalleryItems, galleryCreateSchema, galleryListSchema, listGallery } from "@/server/content";

export const GET = apiHandler({ permission: "cms.view" }, async ({ req }) => listGallery(parseQuery(req, galleryListSchema)));

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, galleryCreateSchema);
  return createGalleryItems(body, { user: user!, ip, userAgent });
});
