import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { createEvent, eventListSchema, eventSchema, listEvents } from "@/server/content";

export const GET = apiHandler({ permission: "cms.view" }, async ({ req }) => listEvents(parseQuery(req, eventListSchema)));

export const POST = apiHandler({ permission: "cms.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, eventSchema);
  return createEvent(body, { user: user!, ip, userAgent });
});
