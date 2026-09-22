import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listUserNotifications, unreadByCategory } from "@/server/notifications-user";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/categories";

const query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.union([z.literal("true"), z.literal("false")]).optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
});

/**
 * GET /api/trainer/notifications?page=&limit=&unread=true&category=Training
 * My in-app inbox, plus unread counts per category for the chip row (same filter the student inbox uses).
 */
export const GET = apiHandler({ roles: ["TRAINER"] }, async ({ req, user }) => {
  const q = parseQuery(req, query);
  const [list, byCategory] = await Promise.all([
    listUserNotifications(user!.id, { page: q.page, limit: q.limit, unreadOnly: q.unread === "true", category: q.category }),
    unreadByCategory(user!.id),
  ]);
  return { ...list, unreadByCategory: byCategory };
});
