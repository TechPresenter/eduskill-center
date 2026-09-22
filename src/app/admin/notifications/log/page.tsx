import Link from "next/link";
import { Bell, Mail, MessageCircle, MessageSquare, Send, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatNumber, titleCase, truncate } from "@/lib/utils";
import { DEFAULT_TEMPLATES } from "@/lib/notifications";
import { listSentLog, sentLogSchema, NOTIFY_EVENTS, TEMPLATE_CHANNELS } from "@/server/notifications-admin";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { Pager } from "@/components/admin/pickers/pager";
import { ResendButton } from "@/components/admin/notifications/resend-button";
import { AppList, AppListRow, IconTile, StatStrip, type TileTone } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Sent Notifications" };

const CHANNEL_TONE: Record<string, "navy" | "info" | "success" | "orange"> = { EMAIL: "navy", SMS: "info", WHATSAPP: "success", IN_APP: "orange" };
const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = { EMAIL: Mail, SMS: MessageSquare, WHATSAPP: MessageCircle, IN_APP: Bell };
const STATUS_TILE: Record<string, TileTone> = { FAILED: "danger", PENDING: "warning", SENT: "success", READ: "lavender" };
const channelLabel = (c: string) => (c === "IN_APP" ? "In-app" : titleCase(c));
const eventName = (e: string | null) => (e ? (DEFAULT_TEMPLATES[e as keyof typeof DEFAULT_TEMPLATES]?.name ?? e) : null);

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000);

/** Where a recipient row links to: their record list for students and trainers, nothing for staff/guests. */
function recipientHref(user: { name: string; role: string } | null) {
  if (!user) return null;
  if (user.role === "STUDENT") return `/admin/students?q=${encodeURIComponent(user.name)}`;
  if (user.role === "TRAINER") return `/admin/trainers?q=${encodeURIComponent(user.name)}`;
  return null;
}

export default async function SentLogPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("notifications.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(sentLogSchema, sp);
  const [data, counts] = await Promise.all([listSentLog(q), db.notification.groupBy({ by: ["status"], where: { createdAt: { gte: daysAgo(7) } }, _count: { _all: true } })]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const canSend = hasPermission(user, "notifications.send");
  const base = "/admin/notifications/log";
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{ title: "Sent log", mobileTitle: "Sent log", description: `${formatNumber(data.meta.total)} notification${data.meta.total === 1 ? "" : "s"} in the current view across email, SMS, WhatsApp and in-app.` }}
      tabs={
        <StatStrip
          items={[
            { label: "Sent", value: formatNumber(countOf("SENT") + countOf("READ")), tone: "success", hint: "last 7 days" },
            { label: "Pending", value: formatNumber(countOf("PENDING")), tone: countOf("PENDING") ? "warning" : "muted", hint: "last 7 days" },
            { label: "Failed", value: formatNumber(countOf("FAILED")), tone: countOf("FAILED") ? "danger" : "muted", hint: "Review", href: withParams(base, {}, { status: "FAILED" }) },
          ]}
        />
      }
      filters={
        isEmpty ? undefined : (
          <FilterBar
            fields={[
              { type: "search", placeholder: "Title, recipient address or user name" },
              { type: "select", name: "channel", label: "Channel", options: TEMPLATE_CHANNELS.map((c) => ({ value: c, label: channelLabel(c) })) },
              { type: "select", name: "status", label: "Status", options: ["PENDING", "SENT", "FAILED", "READ"].map((s) => ({ value: s, label: titleCase(s) })) },
              { type: "select", name: "event", label: "Event", options: NOTIFY_EVENTS.map((e) => ({ value: e, label: DEFAULT_TEMPLATES[e].name })) },
              { type: "date-range", label: "Sent between" },
            ]}
          />
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {isEmpty ? (
        <EmptyState icon={<Send className="h-7 w-7" />} title="Nothing sent yet" description="Every email, SMS, WhatsApp and in-app notification the platform sends is logged here, with its delivery result." />
      ) : data.items.length === 0 ? (
        <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No notifications match" description="Try another channel, status or date range." action={<ButtonLink href={base} variant="outline" size="sm">Clear filters</ButtonLink>} />
      ) : (
        <>
          {/* Phones: one row per message; the status colours the channel tile. */}
          <AppList aria-label="Sent notifications" className="md:hidden">
            {data.items.map((n) => {
              const Icon = CHANNEL_ICON[n.channel] ?? Bell;
              const who = n.user ? n.user.name : "Guest";
              return (
                <AppListRow
                  key={n.id}
                  leading={
                    <IconTile tone={STATUS_TILE[n.status] ?? "neutral"}>
                      <Icon />
                    </IconTile>
                  }
                  title={n.title}
                  subtitle={`${who} · ${n.recipient ?? (n.channel === "IN_APP" ? "In-app inbox" : "—")}`}
                  clamp={1}
                  meta={
                    <>
                      <StatusBadge status={n.status} />
                      <Badge tone={CHANNEL_TONE[n.channel] ?? "neutral"}>{channelLabel(n.channel)}</Badge>
                      {n.error && <span className="w-full truncate text-caption text-danger">{n.error}</span>}
                    </>
                  }
                  trailing={<span className="tabular-nums">{formatDate(n.createdAt, "dd MMM")}</span>}
                  actions={n.canResend && canSend ? <ResendButton id={n.id} channel={channelLabel(n.channel)} compact /> : undefined}
                />
              );
            })}
          </AppList>

          {/* md+: table. */}
          <div className="hidden md:block">
            <TableWrap cards={false}>
              <THead>
                <tr>
                  <TH>Sent</TH>
                  <TH>Channel</TH>
                  <TH>Recipient</TH>
                  <TH>Message</TH>
                  <TH>Event</TH>
                  <TH>Status</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {data.items.map((n) => {
                  const href = recipientHref(n.user);
                  return (
                    <TR key={n.id}>
                      <TD className="whitespace-nowrap text-muted tabular-nums">
                        <span className="block">{formatDateTime(n.createdAt)}</span>
                        {n.sentAt && n.status !== "PENDING" && <span className="text-caption">delivered {formatDateTime(n.sentAt)}</span>}
                      </TD>
                      <TD>
                        <Badge tone={CHANNEL_TONE[n.channel] ?? "neutral"}>{channelLabel(n.channel)}</Badge>
                      </TD>
                      <TD>
                        {n.user ? (
                          href ? (
                            <Link href={href} className="ring-focus block rounded-md font-medium text-ink hover:text-navy">
                              {n.user.name} <span className="text-caption font-normal text-muted">· {titleCase(n.user.role)}</span>
                            </Link>
                          ) : (
                            <span className="block font-medium text-ink">
                              {n.user.name} <span className="text-caption font-normal text-muted">· {titleCase(n.user.role)}</span>
                            </span>
                          )
                        ) : (
                          <span className="block text-ink">Guest</span>
                        )}
                        <span className="block max-w-[14rem] truncate text-caption text-muted">{n.recipient ?? (n.channel === "IN_APP" ? "In-app inbox" : "—")}</span>
                      </TD>
                      <TD className="max-w-md">
                        <span className="block font-medium text-ink">{n.title}</span>
                        <span className="block text-caption text-muted">{truncate(n.body, 120)}</span>
                      </TD>
                      <TD className="text-caption text-muted">{eventName(n.event) ?? "—"}</TD>
                      <TD>
                        <StatusBadge status={n.status} />
                        {n.error && (
                          <span className="mt-1 block max-w-[14rem] truncate text-caption text-danger" title={n.error}>
                            {n.error}
                          </span>
                        )}
                      </TD>
                      <TD className="text-right">{n.canResend && canSend ? <ResendButton id={n.id} channel={channelLabel(n.channel)} /> : null}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}
    </AdminListPage>
  );
}
