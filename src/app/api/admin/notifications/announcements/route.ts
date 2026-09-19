import { z } from "zod";
import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { announcementSchema, createAnnouncement, listAnnouncements } from "@/server/notifications-admin";

const listSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });

export const GET = apiHandler({ permission: "notifications.view" }, async ({ req }) => listAnnouncements(parseQuery(req, listSchema)));

/** Creates an announcement; when `publish` is true, IN_APP notifications are pushed to the audience. */
export const POST = apiHandler({ permission: "notifications.send" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, announcementSchema);
  return createAnnouncement(body, { user: user!, ip, userAgent });
});
