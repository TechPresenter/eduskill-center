import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listUserNotifications } from "@/server/notifications-user";

const query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.union([z.literal("true"), z.literal("false")]).optional(),
});

/** GET /api/trainer/notifications?page=&limit=&unread=true */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ req, user }) => {
  const q = parseQuery(req, query);
  return listUserNotifications(user!.id, { page: q.page, limit: q.limit, unreadOnly: q.unread === "true" });
});
