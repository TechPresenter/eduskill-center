import { apiHandler, parseBody } from "@/lib/api/handler";
import { blockInputSchema, deleteBlock, updateBlock } from "@/server/locations";

export const PUT = apiHandler<{ id: string }>({ permission: "locations.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, blockInputSchema.partial());
  return updateBlock(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "locations.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteBlock(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
