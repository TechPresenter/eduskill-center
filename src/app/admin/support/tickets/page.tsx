import Link from "next/link";
import { LifeBuoy, MessageSquare, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/utils";
import { listTicketsAdmin, ticketListSchema } from "@/server/support";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { Pager } from "@/components/admin/pickers/pager";
import { AppList, AppListRow, IconTile, type TileTone } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Support Tickets" };

const STATUS_TABS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };
const STATUS_TILE: Record<string, TileTone> = { OPEN: "orange", IN_PROGRESS: "info", RESOLVED: "success", CLOSED: "neutral" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireAdmin("support.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(ticketListSchema, sp);
  const [data, counts] = await Promise.all([listTicketsAdmin(q), db.supportTicket.groupBy({ by: ["status"], _count: { _all: true } })]);
  const assigneeIds = [...new Set(data.items.map((t) => t.assignedToId).filter((v): v is string => !!v))];
  const assignees = assigneeIds.length ? await db.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } }) : [];
  const assigneeName = new Map(assignees.map((a) => [a.id, a.name]));
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((n, c) => n + c._count._all, 0);
  const base = "/admin/support/tickets";

  return (
    <AdminListPage
      header={{ title: "Support tickets", mobileTitle: "Support", description: `${formatNumber(data.meta.total)} ticket${data.meta.total === 1 ? "" : "s"} in the current view, raised by students and trainers from their portals.` }}
      tabs={all === 0 ? undefined : <QueryTabs param="status" keep={["priority", "role", "q"]} items={[{ value: "", label: "All", count: all }, ...STATUS_TABS.map((s) => ({ value: s, label: titleCase(s), count: countOf(s) }))]} />}
      filters={
        all === 0 ? undefined : (
          <FilterBar
            preserve={["status"]}
            fields={[
              { type: "search", placeholder: "Ticket no, subject or user name" },
              { type: "select", name: "priority", label: "Priority", options: ["HIGH", "MEDIUM", "LOW"].map((p) => ({ value: p, label: titleCase(p) })) },
              {
                type: "select",
                name: "role",
                label: "Raised by",
                options: [
                  { value: "STUDENT", label: "Students" },
                  { value: "TRAINER", label: "Trainers" },
                ],
              },
            ]}
          />
        )
      }
      pagination={all === 0 ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {all === 0 ? (
        <EmptyState icon={<LifeBuoy className="h-7 w-7" />} title="No support tickets" description="Tickets raised from the student and trainer portals appear here, with the full conversation." />
      ) : data.items.length === 0 ? (
        <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No tickets match" description="Try another status, priority or search word." action={<ButtonLink href={base} variant="outline" size="sm">Clear filters</ButtonLink>} />
      ) : (
        <>
          {/* Phones: conversation list. */}
          <AppList aria-label="Support tickets" className="md:hidden">
            {data.items.map((t) => (
              <AppListRow
                key={t.id}
                href={`${base}/${t.id}`}
                highlight={t.status === "OPEN"}
                leading={
                  <IconTile tone={STATUS_TILE[t.status] ?? "lavender"}>
                    <LifeBuoy />
                  </IconTile>
                }
                title={t.subject}
                subtitle={`${t.user.name} · ${titleCase(t.user.role)} · ${t.ticketNo}`}
                clamp={1}
                meta={
                  <>
                    <StatusBadge status={t.status} />
                    <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{titleCase(t.priority)}</Badge>
                    <span className="inline-flex items-center gap-1 text-caption text-muted tabular-nums">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden /> {t._count.messages}
                    </span>
                  </>
                }
                trailing={<span className="tabular-nums">{formatDate(t.updatedAt, "dd MMM")}</span>}
              />
            ))}
          </AppList>

          {/* md+: table. */}
          <div className="hidden md:block">
            <TableWrap cards={false}>
              <THead>
                <tr>
                  <TH>Ticket</TH>
                  <TH>Subject</TH>
                  <TH>Raised by</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH className="text-center">Messages</TH>
                  <TH>Assigned to</TH>
                  <TH>Updated</TH>
                </tr>
              </THead>
              <TBody>
                {data.items.map((t) => (
                  <TR key={t.id} className={t.status === "OPEN" ? "bg-orange-light/30" : undefined}>
                    <TD>
                      <Link href={`${base}/${t.id}`} className="ring-focus rounded-md font-mono text-caption font-semibold text-navy hover:underline">
                        {t.ticketNo}
                      </Link>
                    </TD>
                    <TD className="max-w-md">
                      <Link href={`${base}/${t.id}`} className="ring-focus block rounded-md font-medium text-ink hover:text-navy">
                        {t.subject}
                      </Link>
                      {t.category && <span className="text-caption text-muted">{t.category}</span>}
                    </TD>
                    <TD>
                      <span className="block">{t.user.name}</span>
                      <span className="text-caption text-muted">{titleCase(t.user.role)}</span>
                    </TD>
                    <TD>
                      <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{titleCase(t.priority)}</Badge>
                    </TD>
                    <TD>
                      <StatusBadge status={t.status} />
                    </TD>
                    <TD className="text-center tabular-nums">{t._count.messages}</TD>
                    <TD className="text-caption">{t.assignedToId ? (assigneeName.get(t.assignedToId) ?? "Staff") : <span className="text-muted">Unassigned</span>}</TD>
                    <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(t.updatedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}
    </AdminListPage>
  );
}
