import { apiHandler, parseBody } from "@/lib/api/handler";
import { centerInputSchema } from "@/lib/validation/centers";
import { deleteCenter, getCenterAdmin, updateCenter } from "@/server/centers";

export const GET = apiHandler<{ id: string }>({ permission: "centers.view" }, async ({ params }) => getCenterAdmin(params.id));

export const PUT = apiHandler<{ id: string }>({ permission: "centers.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, centerInputSchema.partial());
  return updateCenter(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "centers.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteCenter(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
