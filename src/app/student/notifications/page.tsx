import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { listUserNotifications, unreadByCategory } from "@/server/notifications-user";
import { asCategory } from "@/lib/notifications/categories";
import { PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/table";
import { NotificationsInbox } from "@/components/student/notifications-inbox";

export const metadata: Metadata = { title: "Notifications" };

export default async function StudentNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; unread?: string; category?: string }> }) {
  const user = await requireStudent();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const unreadOnly = sp.unread === "1";
  const category = asCategory(sp.category);
  const [{ items, meta, unread }, byCategory] = await Promise.all([listUserNotifications(user.id, { page, limit: 25, unreadOnly, category }), unreadByCategory(user.id)]);

  const query = (p: number) => {
    const params = new URLSearchParams({ page: String(p) });
    if (unreadOnly) params.set("unread", "1");
    if (category) params.set("category", category);
    return `/student/notifications?${params.toString()}`;
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You are all caught up."} />
      <NotificationsInbox
        items={items.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          templateKey: n.templateKey,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
          data: n.data && typeof n.data === "object" && !Array.isArray(n.data) ? (n.data as Record<string, unknown>) : null,
        }))}
        unread={unread}
        unreadOnly={unreadOnly}
        category={category}
        unreadByCategory={byCategory}
        page={meta.page}
        totalPages={meta.totalPages}
      />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} hrefFor={query} className="hidden lg:flex" />
    </div>
  );
}
