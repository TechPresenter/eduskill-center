import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { createDistrict, districtInputSchema, listDistricts, locationListSchema } from "@/server/locations";

export const GET = apiHandler({ permission: "locations.view" }, async ({ req }) => listDistricts(parseQuery(req, locationListSchema)));

export const POST = apiHandler({ permission: "locations.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, districtInputSchema);
  return createDistrict(body, { user: user!, ip, userAgent });
});
