import { Megaphone } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatNumber, titleCase, truncate } from "@/lib/utils";
import { listAnnouncements } from "@/server/notifications-admin";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { AnnouncementForm, AnnouncementRowActions } from "@/components/admin/notifications/announcement-form";
import { Pager } from "@/components/admin/pickers/pager";
import { AppList, AppListRow, IconTile } from "@/components/admin/content/app-list";
import { flattenSearchParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("notifications.view");
  const sp = flattenSearchParams(await searchParams);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await listAnnouncements({ page, limit: 20 });
  const canSend = hasPermission(user, "notifications.send");
  const audienceOf = (a: (typeof data.items)[number]) => [titleCase(a.audience), a.center?.name, a.batch?.name].filter(Boolean).join(" · ");

  return (
    <AdminListPage
      header={{
        title: "Announcements",
        mobileTitle: "Announcements",
        description: `${formatNumber(data.meta.total)} announcement${data.meta.total === 1 ? "" : "s"}. Published announcements are pushed to the in-app inbox of every user in the audience.`,
        // Phones use the FAB below; the header button is the desktop affordance.
        actions: canSend ? (
          <div className="hidden lg:block">
            <AnnouncementForm />
          </div>
        ) : undefined,
      }}
      pagination={data.meta.total === 0 ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/notifications/announcements" params={sp} />}
    >
      {data.meta.total === 0 ? (
        <EmptyState icon={<Megaphone className="h-7 w-7" />} title="No announcements yet" description="Announce holidays, schedule changes or new batches to students, trainers or a whole center." action={canSend ? <AnnouncementForm /> : undefined} />
      ) : (
        <>
          {/* Phones: app list. */}
          <AppList aria-label="Announcements" className="md:hidden">
            {data.items.map((a) => (
              <AppListRow
                key={a.id}
                leading={
                  <IconTile tone={a.isPublished ? "orange" : "neutral"}>
                    <Megaphone />
                  </IconTile>
                }
                title={a.title}
                subtitle={truncate(a.body, 110)}
                meta={
                  <>
                    {a.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
                    <span className="min-w-0 text-caption break-words text-muted">To {audienceOf(a)}</span>
                  </>
                }
                trailing={canSend && !a.isPublished ? undefined : <span className="tabular-nums">{formatDate(a.createdAt, "dd MMM")}</span>}
                actions={canSend ? <AnnouncementRowActions id={a.id} isPublished={a.isPublished} title={a.title} compact /> : undefined}
              />
            ))}
          </AppList>

          {/* md+: table. */}
          <div className="hidden md:block">
            <TableWrap cards={false}>
              <THead>
                <tr>
                  <TH>Announcement</TH>
                  <TH>Audience</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  {canSend && (
                    <TH>
                      <span className="sr-only">Actions</span>
                    </TH>
                  )}
                </tr>
              </THead>
              <TBody>
                {data.items.length === 0 && <EmptyRow colSpan={canSend ? 5 : 4}>No announcements on this page.</EmptyRow>}
                {data.items.map((a) => (
                  <TR key={a.id}>
                    <TD className="max-w-lg">
                      <span className="flex items-start gap-3">
                        <IconTile size="sm" tone={a.isPublished ? "orange" : "neutral"}>
                          <Megaphone />
                        </IconTile>
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink">{a.title}</span>
                          <span className="block text-body-sm whitespace-pre-line text-muted">{truncate(a.body, 160)}</span>
                        </span>
                      </span>
                    </TD>
                    <TD>
                      <Badge tone="navy">{titleCase(a.audience)}</Badge>
                      {a.center && <span className="mt-1 block text-caption text-muted">{a.center.name}</span>}
                      {a.batch && <span className="block text-caption text-muted">{a.batch.name}</span>}
                    </TD>
                    <TD>{a.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}</TD>
                    <TD className="whitespace-nowrap text-muted tabular-nums">
                      <span className="block">{formatDateTime(a.createdAt)}</span>
                      {a.createdBy && <span className="text-caption">by {a.createdBy}</span>}
                    </TD>
                    {canSend && (
                      <TD className="text-right">
                        <AnnouncementRowActions id={a.id} isPublished={a.isPublished} title={a.title} />
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}
      {canSend && <AnnouncementForm variant="fab" />}
    </AdminListPage>
  );
}
