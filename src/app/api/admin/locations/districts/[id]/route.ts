import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteDistrict, districtInputSchema, updateDistrict } from "@/server/locations";

export const PUT = apiHandler<{ id: string }>({ permission: "locations.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, districtInputSchema.partial());
  return updateDistrict(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "locations.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteDistrict(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
