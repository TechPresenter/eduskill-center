import Link from "next/link";
import { Send } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatNumber, titleCase, truncate } from "@/lib/utils";
import { DEFAULT_TEMPLATES } from "@/lib/notifications";
import { listSentLog, sentLogSchema, NOTIFY_EVENTS, TEMPLATE_CHANNELS } from "@/server/notifications-admin";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatsCard } from "@/components/ui/stats";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { ResendButton } from "@/components/admin/notifications/resend-button";
import { Pager } from "@/components/admin/content/pager";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Sent Notifications" };

const CHANNEL_TONE: Record<string, "navy" | "info" | "success" | "orange"> = { EMAIL: "navy", SMS: "info", WHATSAPP: "success", IN_APP: "orange" };

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000);

export default async function SentLogPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("notifications.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(sentLogSchema, sp);
  const [data, counts] = await Promise.all([listSentLog(q), db.notification.groupBy({ by: ["status"], where: { createdAt: { gte: daysAgo(7) } }, _count: { _all: true } })]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const canSend = hasPermission(user, "notifications.send");
  const base = "/admin/notifications/log";
  const filtered = Object.keys(sp).some((k) => k !== "page");

  return (
    <div>
      <PageHeader title="Sent log" description={`${formatNumber(data.meta.total)} notification${data.meta.total === 1 ? "" : "s"} in the current view across email, SMS, WhatsApp and in-app.`} />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard label="Sent · last 7 days" value={countOf("SENT") + countOf("READ")} tone="success" />
        <StatsCard label="Pending · last 7 days" value={countOf("PENDING")} tone="warning" />
        <StatsCard label="Failed · last 7 days" value={countOf("FAILED")} tone="orange" href={withParams(base, {}, { status: "FAILED" })} hint="Click to review" />
      </div>

      <FilterBar
        fields={[
          { type: "search", placeholder: "Title, recipient address or user name" },
          { type: "select", name: "channel", label: "Channel", options: TEMPLATE_CHANNELS.map((c) => ({ value: c, label: c === "IN_APP" ? "In-app" : titleCase(c) })) },
          { type: "select", name: "status", label: "Status", options: ["PENDING", "SENT", "FAILED", "READ"].map((s) => ({ value: s, label: titleCase(s) })) },
          { type: "select", name: "event", label: "Event", options: NOTIFY_EVENTS.map((e) => ({ value: e, label: DEFAULT_TEMPLATES[e].name })) },
          { type: "date-range", label: "Sent between" },
        ]}
      />

      {data.meta.total === 0 && !filtered ? (
        <EmptyState icon={<Send className="h-7 w-7" />} title="Nothing sent yet" description="Every email, SMS, WhatsApp and in-app notification the platform sends is logged here." />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Sent</TH>
                <TH>Channel</TH>
                <TH>Recipient</TH>
                <TH>Message</TH>
                <TH>Event</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={7}>No notifications match these filters.</EmptyRow>}
              {data.items.map((n) => (
                <TR key={n.id}>
                  <TD className="whitespace-nowrap text-muted">
                    <span className="block">{formatDateTime(n.createdAt)}</span>
                    {n.sentAt && n.status !== "PENDING" && <span className="text-[11px]">delivered {formatDateTime(n.sentAt)}</span>}
                  </TD>
                  <TD>
                    <Badge tone={CHANNEL_TONE[n.channel] ?? "neutral"}>{n.channel === "IN_APP" ? "In-app" : titleCase(n.channel)}</Badge>
                  </TD>
                  <TD>
                    {n.user ? (
                      <Link href={n.user.role === "STUDENT" ? `/admin/students?q=${encodeURIComponent(n.user.name)}` : n.user.role === "TRAINER" ? `/admin/trainers?q=${encodeURIComponent(n.user.name)}` : "#"} className="block font-medium text-ink hover:text-navy">
                        {n.user.name} <span className="text-xs font-normal text-muted">· {titleCase(n.user.role)}</span>
                      </Link>
                    ) : (
                      <span className="block text-sm text-ink">Guest</span>
                    )}
                    <span className="block max-w-[14rem] truncate text-xs text-muted">{n.recipient ?? (n.channel === "IN_APP" ? "In-app inbox" : "—")}</span>
                  </TD>
                  <TD className="max-w-md">
                    <span className="block font-medium text-ink">{n.title}</span>
                    <span className="block text-xs text-muted">{truncate(n.body, 120)}</span>
                  </TD>
                  <TD className="text-xs text-muted">{n.event ? (DEFAULT_TEMPLATES[n.event as keyof typeof DEFAULT_TEMPLATES]?.name ?? n.event) : "—"}</TD>
                  <TD>
                    <StatusBadge status={n.status} />
                    {n.error && <span className="mt-1 block max-w-[14rem] truncate text-[11px] text-danger" title={n.error}>{n.error}</span>}
                  </TD>
                  <TD>{n.canResend && canSend ? <ResendButton id={n.id} channel={titleCase(n.channel)} /> : <span className="text-xs text-muted">—</span>}</TD>
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
