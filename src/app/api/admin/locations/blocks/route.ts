import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { bulkBlockSchema, createBlocks, listBlocks, locationListSchema } from "@/server/locations";

export const GET = apiHandler({ permission: "locations.view" }, async ({ req }) => listBlocks(parseQuery(req, locationListSchema)));

/** Bulk add: { districtId, names: string[] } */
export const POST = apiHandler({ permission: "locations.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, bulkBlockSchema);
  return createBlocks(body, { user: user!, ip, userAgent });
});
