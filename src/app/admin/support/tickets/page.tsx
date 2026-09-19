import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime, formatNumber, titleCase } from "@/lib/utils";
import { listTicketsAdmin, ticketListSchema } from "@/server/support";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { Pager } from "@/components/admin/content/pager";
import { flattenSearchParams, parseListQuery, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Support Tickets" };

const STATUS_TABS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };

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
    <div>
      <PageHeader title="Support tickets" description={`${formatNumber(data.meta.total)} ticket${data.meta.total === 1 ? "" : "s"} in the current view, raised by students and trainers from their portals.`} />

      <QueryTabs param="status" keep={["priority", "role", "q"]} className="mb-4" items={[{ value: "", label: "All", count: all }, ...STATUS_TABS.map((s) => ({ value: s, label: titleCase(s), count: countOf(s) }))]} />

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

      {all === 0 ? (
        <EmptyState icon={<LifeBuoy className="h-7 w-7" />} title="No support tickets" description="Tickets raised from the student and trainer portals appear here." />
      ) : (
        <>
          <TableWrap>
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
              {data.items.length === 0 && <EmptyRow colSpan={8}>No tickets match these filters.</EmptyRow>}
              {data.items.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <Link href={`${base}/${t.id}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                      {t.ticketNo}
                    </Link>
                  </TD>
                  <TD className="max-w-md">
                    <Link href={`${base}/${t.id}`} className="block font-medium text-ink hover:text-navy">
                      {t.subject}
                    </Link>
                    {t.category && <span className="text-xs text-muted">{t.category}</span>}
                  </TD>
                  <TD>
                    <span className="block">{t.user.name}</span>
                    <span className="text-xs text-muted">{titleCase(t.user.role)}</span>
                  </TD>
                  <TD>
                    <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{titleCase(t.priority)}</Badge>
                  </TD>
                  <TD>
                    <StatusBadge status={t.status} />
                  </TD>
                  <TD className="text-center tabular-nums">{t._count.messages}</TD>
                  <TD className="text-xs">{t.assignedToId ? (assigneeName.get(t.assignedToId) ?? "Staff") : <span className="text-muted">Unassigned</span>}</TD>
                  <TD className="whitespace-nowrap text-muted">{formatDateTime(t.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </TableWrap>
          <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
        </>
      )}
    </div>
  );
}
