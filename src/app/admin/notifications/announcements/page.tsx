import { Megaphone } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatNumber, titleCase, truncate } from "@/lib/utils";
import { listAnnouncements } from "@/server/notifications-admin";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AnnouncementForm, AnnouncementRowActions } from "@/components/admin/notifications/announcement-form";
import { Pager } from "@/components/admin/content/pager";
import { flattenSearchParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("notifications.view");
  const sp = flattenSearchParams(await searchParams);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await listAnnouncements({ page, limit: 20 });
  const canSend = hasPermission(user, "notifications.send");

  return (
    <div>
      <PageHeader title="Announcements" description={`${formatNumber(data.meta.total)} announcement${data.meta.total === 1 ? "" : "s"}. Published announcements are pushed to the in-app inbox of every user in the audience.`} actions={canSend ? <AnnouncementForm /> : undefined} />

      {data.meta.total === 0 ? (
        <EmptyState icon={<Megaphone className="h-7 w-7" />} title="No announcements yet" description="Announce holidays, schedule changes or new batches to students, trainers or a whole center." action={canSend ? <AnnouncementForm /> : undefined} />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Announcement</TH>
                <TH>Audience</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                {canSend && <TH>Actions</TH>}
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={canSend ? 5 : 4}>No announcements on this page.</EmptyRow>}
              {data.items.map((a) => (
                <TR key={a.id}>
                  <TD className="max-w-lg">
                    <span className="block font-semibold text-ink">{a.title}</span>
                    <span className="block text-xs whitespace-pre-line text-muted">{truncate(a.body, 160)}</span>
                  </TD>
                  <TD>
                    <Badge tone="navy">{titleCase(a.audience)}</Badge>
                    {a.center && <span className="mt-1 block text-xs text-muted">{a.center.name}</span>}
                    {a.batch && <span className="block text-xs text-muted">{a.batch.name}</span>}
                  </TD>
                  <TD>{a.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}</TD>
                  <TD className="whitespace-nowrap text-muted">
                    <span className="block">{formatDateTime(a.createdAt)}</span>
                    {a.createdBy && <span className="text-[11px]">by {a.createdBy}</span>}
                  </TD>
                  {canSend && (
                    <TD>
                      <AnnouncementRowActions id={a.id} isPublished={a.isPublished} title={a.title} />
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </TableWrap>
          <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/notifications/announcements" params={sp} />
        </>
      )}
    </div>
  );
}
