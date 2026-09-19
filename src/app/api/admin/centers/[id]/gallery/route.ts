import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { addGalleryImage, getCenterAdmin } from "@/server/centers";

const schema = z.object({ url: z.string().trim().min(1).max(500).regex(/^\/api\/files\//, "Upload the image first"), caption: z.string().trim().max(160).optional().nullable() });

export const POST = apiHandler<{ id: string }>({ permission: "centers.update" }, async ({ req, params, user, ip, userAgent }) => {
  await getCenterAdmin(params.id);
  const body = await parseBody(req, schema);
  return addGalleryImage(params.id, body.url, body.caption || null, { user: user!, ip, userAgent });
});
