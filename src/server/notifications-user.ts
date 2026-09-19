import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { Errors } from "@/lib/api/errors";
import { NOTIFICATION_CATEGORIES, categoryOf, eventsInCategory, type NotificationCategory } from "@/lib/notifications/categories";

/** In-app notification inbox helpers (any logged-in user; always scoped to the user). */

/**
 * `templateKey` is stored as `${event}:${channel}`, so a category filter is a simple `in` list.
 * Rows without a templateKey (admin-composed / legacy) fall into "System" like `categoryOf()` says.
 */
function categoryFilter(category: NotificationCategory): Prisma.NotificationWhereInput {
  const keys = eventsInCategory(category).map((e) => `${e}:IN_APP`);
  if (category === "System") return { OR: [{ templateKey: { in: keys } }, { templateKey: null }] };
  return { templateKey: { in: keys } };
}

export async function listUserNotifications(userId: string, opts: { page?: number; limit?: number; unreadOnly?: boolean; category?: NotificationCategory } = {}) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const where: Prisma.NotificationWhereInput = {
    userId,
    channel: "IN_APP",
    ...(opts.unreadOnly ? { readAt: null } : {}),
    ...(opts.category ? categoryFilter(opts.category) : {}),
  };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, channel: "IN_APP", readAt: null } }),
  ]);
  return { items, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }, unread };
}

/** Unread counts per inbox category, for the chip badges. One groupBy over the user's own rows. */
export async function unreadByCategory(userId: string): Promise<Record<NotificationCategory, number>> {
  const rows = await db.notification.groupBy({ by: ["templateKey"], where: { userId, channel: "IN_APP", readAt: null }, _count: { _all: true } });
  const out = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, 0])) as Record<NotificationCategory, number>;
  for (const r of rows) out[categoryOf(r.templateKey)] += r._count._all;
  return out;
}

export async function markNotificationRead(userId: string, id: string) {
  const n = await db.notification.findFirst({ where: { id, userId } });
  if (!n) throw Errors.notFound("Notification");
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date(), status: "READ" } });
}

export async function markAllNotificationsRead(userId: string) {
  const r = await db.notification.updateMany({ where: { userId, channel: "IN_APP", readAt: null }, data: { readAt: new Date(), status: "READ" } });
  return r.count;
}
