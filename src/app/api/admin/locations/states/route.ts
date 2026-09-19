import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { createState, listStates, locationListSchema, stateInputSchema } from "@/server/locations";

export const GET = apiHandler({ permission: "locations.view" }, async ({ req }) => listStates(parseQuery(req, locationListSchema)));

export const POST = apiHandler({ permission: "locations.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, stateInputSchema);
  return createState(body, { user: user!, ip, userAgent });
});
