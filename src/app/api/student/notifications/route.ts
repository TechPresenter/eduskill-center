import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listUserNotifications } from "@/server/notifications-user";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/categories";

const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z.union([z.literal("true"), z.literal("false")]).optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
});

/** GET /api/student/notifications – in-app inbox of the logged-in student ("Load more" + category chips). */
export const GET = apiHandler({ roles: ["STUDENT"] }, async ({ req, user }) => {
  const q = parseQuery(req, schema);
  return listUserNotifications(user!.id, { page: q.page, limit: q.limit, unreadOnly: q.unread === "true", category: q.category });
});
