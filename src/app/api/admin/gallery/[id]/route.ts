import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteGalleryItem, galleryUpdateSchema, updateGalleryItem } from "@/server/content";

export const PUT = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, galleryUpdateSchema);
  return updateGalleryItem(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "cms.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteGalleryItem(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
