import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listUserNotifications, markAllNotificationsRead } from "@/server/notifications-user";

const schema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), unread: z.enum(["true", "false"]).optional() });

/** The signed-in staff member's own in-app inbox. */
export const GET = apiHandler({ roles: ["SUPER_ADMIN", "STAFF"] }, async ({ req, user }) => {
  const q = parseQuery(req, schema);
  return listUserNotifications(user!.id, { page: q.page, limit: q.limit, unreadOnly: q.unread === "true" });
});

/** Marks every unread in-app notification as read. */
export const POST = apiHandler({ roles: ["SUPER_ADMIN", "STAFF"] }, async ({ user }) => ({ marked: await markAllNotificationsRead(user!.id) }));
