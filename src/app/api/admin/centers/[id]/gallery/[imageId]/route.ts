import { apiHandler } from "@/lib/api/handler";
import { removeGalleryImage } from "@/server/centers";

export const DELETE = apiHandler<{ id: string; imageId: string }>({ permission: "centers.update" }, async ({ params, user, ip, userAgent }) => {
  await removeGalleryImage(params.imageId, { user: user!, ip, userAgent });
  return { deleted: true };
});
