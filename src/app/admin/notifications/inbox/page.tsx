import { requireAdmin } from "@/lib/auth/guards";
import { listUserNotifications } from "@/server/notifications-user";
import { PageHeader } from "@/components/ui/misc";
import { InboxList } from "@/components/admin/notifications/inbox-list";
import { Pager } from "@/components/admin/content/pager";
import { flattenSearchParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin();
  const sp = flattenSearchParams(await searchParams);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await listUserNotifications(user.id, { page, limit: 20 });

  return (
    <div>
      <PageHeader title="Inbox" description={data.unread ? `${data.unread} unread notification${data.unread === 1 ? "" : "s"} addressed to you.` : "Announcements and system notifications addressed to you."} />
      <InboxList items={data.items} unread={data.unread} />
      <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/notifications/inbox" params={sp} />
    </div>
  );
}
