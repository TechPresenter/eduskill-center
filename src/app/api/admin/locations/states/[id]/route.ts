import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteState, stateInputSchema, updateState } from "@/server/locations";

export const PUT = apiHandler<{ id: string }>({ permission: "locations.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, stateInputSchema.partial());
  return updateState(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "locations.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteState(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
