import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { centerInputSchema } from "@/lib/validation/centers";
import { centerListSchema, createCenter, listCentersAdmin } from "@/server/centers";

export const GET = apiHandler({ permission: "centers.view" }, async ({ req }) => listCentersAdmin(parseQuery(req, centerListSchema)));

export const POST = apiHandler({ permission: "centers.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, centerInputSchema);
  return createCenter(body, { user: user!, ip, userAgent });
});
