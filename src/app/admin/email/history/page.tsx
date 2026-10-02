import Link from "next/link";
import { Mail, MailCheck, MailX, Paperclip, PenLine, SearchX, Send } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { composerConfig, historySchema, listEmails, startOfIstDay } from "@/server/email";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { Pager } from "@/components/admin/pickers/pager";
import { AppList, AppListRow, IconTile, StatStrip, type TileTone } from "@/components/admin/content/app-list";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";
import { scopeHistoryQuery } from "@/components/admin/email/history-query";

export const metadata = { title: "Sent Emails" };

const STATUS_TILE: Record<string, TileTone> = { SENT: "success", FAILED: "danger", SENDING: "warning" };
const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = { SENT: MailCheck, FAILED: MailX, SENDING: Mail };

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000);


function recipientsLine(to: string[], cc: string[], bcc: string[]) {
  const first = to[0] ?? cc[0] ?? "—";
  const more = to.length + cc.length + bcc.length - 1;
  return more > 0 ? `${first} +${more} more` : first;
}

export default async function EmailHistoryPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin(["email.view", "email.send"]);
  const canViewAll = hasPermission(user, "email.view");
  const canSend = hasPermission(user, "email.send");
  const sp = flattenSearchParams(await searchParams);
  const q = scopeHistoryQuery({ ...parseListQuery(historySchema, sp), scope: "sent" }, user);

  const since = daysAgo(7);
  const startOfDay = startOfIstDay();
  const own = canViewAll ? {} : { sentById: user.id };
  const [data, counts, sentToday, config] = await Promise.all([
    listEmails(q, { user }),
    db.emailMessage.groupBy({ by: ["status"], where: { deletedAt: null, isTest: false, status: { in: ["SENT", "FAILED"] }, sentAt: { gte: since }, ...own }, _count: { _all: true } }),
    db.emailMessage.count({ where: { sentById: user.id, sentAt: { gte: startOfDay }, status: { in: ["SENT", "SENDING"] } } }),
    composerConfig(),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  const base = "/admin/email/history";
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const isEmpty = data.meta.total === 0 && !filtered;
  const hrefFor = (id: string) => `${base}/${id}`;

  return (
    <AdminListPage
      header={{
        title: "Sent emails",
        mobileTitle: "Sent emails",
        description: canViewAll
          ? `${formatNumber(data.meta.total)} email${data.meta.total === 1 ? "" : "s"} in this view, sent by administrators through the Foundation's mail account.`
          : `${formatNumber(data.meta.total)} email${data.meta.total === 1 ? "" : "s"} you sent.`,
        actions: canSend ? (
          <ButtonLink href="/admin/email" leftIcon={<PenLine className="h-4 w-4" />}>
            Compose
          </ButtonLink>
        ) : undefined,
      }}
      fab={canSend ? { href: "/admin/email", label: "Compose email", icon: <PenLine className="h-6 w-6" aria-hidden /> } : undefined}
      tabs={
        <StatStrip
          items={[
            { label: canViewAll ? "Sent" : "Sent by you", value: formatNumber(countOf("SENT")), tone: "success", hint: "last 7 days" },
            { label: "Failed", value: formatNumber(countOf("FAILED")), tone: countOf("FAILED") ? "danger" : "muted", hint: countOf("FAILED") ? "Review" : "last 7 days", href: countOf("FAILED") ? withParams(base, {}, { status: "FAILED" }) : undefined },
            { label: "Your sends today", value: `${formatNumber(sentToday)} / ${formatNumber(config.dailyLimit)}`, tone: sentToday >= config.dailyLimit ? "danger" : "navy", hint: "daily limit" },
          ]}
        />
      }
      filters={
        isEmpty ? undefined : (
          <FilterBar
            fields={[
              { type: "search", placeholder: "Subject, exact recipient address or Message-ID" },
              {
                type: "select",
                name: "status",
                label: "Status",
                options: [
                  { value: "SENT", label: "Sent" },
                  { value: "FAILED", label: "Failed" },
                  { value: "SENDING", label: "Sending" },
                ],
              },
              ...(canViewAll ? [{ type: "select" as const, name: "mine", label: "Sent by", placeholder: "Anyone", options: [{ value: "true", label: "Me" }] }] : []),
              { type: "date-range", label: "Date" },
            ]}
          />
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {!canViewAll && (
        <Alert tone="info">You see the emails you sent yourself. The full history of every administrator needs the “Send Email → View” permission.</Alert>
      )}
      {isEmpty ? (
        <EmptyState
          icon={<Send className="h-7 w-7" />}
          title="No emails sent yet"
          description="Every email sent from Compose — and every test — is listed here with its recipients, delivery result and Message-ID."
          action={canSend ? <ButtonLink href="/admin/email" variant="navy" size="md">Write an email</ButtonLink> : undefined}
        />
      ) : data.items.length === 0 ? (
        <EmptyState size="sm" icon={<SearchX className="h-6 w-6" />} title="No emails match" description="Try another status, date range or search term." action={<ButtonLink href={base} variant="outline" size="sm">Clear filters</ButtonLink>} />
      ) : (
        <>
          {/* Phones: one row per email; the status colours the tile. */}
          <AppList aria-label="Sent emails" className="md:hidden">
            {data.items.map((m) => {
              const Icon = STATUS_ICON[m.status] ?? Mail;
              return (
                <AppListRow
                  key={m.id}
                  href={hrefFor(m.id)}
                  leading={
                    <IconTile tone={STATUS_TILE[m.status] ?? "neutral"}>
                      <Icon />
                    </IconTile>
                  }
                  title={m.subject}
                  subtitle={`${recipientsLine(m.toAddresses, m.ccAddresses, m.bccAddresses)} · ${m.sentBy ?? m.createdBy}`}
                  clamp={1}
                  meta={
                    <>
                      <StatusBadge status={m.status} />
                      {m.isTest && <Badge tone="info">Test</Badge>}
                      {m.attachments.length > 0 && (
                        <Badge tone="neutral">
                          <Paperclip className="h-3 w-3" aria-hidden />
                          {m.attachments.length}
                          <span className="sr-only"> attachment{m.attachments.length === 1 ? "" : "s"}</span>
                        </Badge>
                      )}
                      {m.error && <span className="w-full truncate text-caption text-danger">{m.error}</span>}
                    </>
                  }
                  trailing={<span className="tabular-nums">{formatDate(m.sentAt ?? m.createdAt, "dd MMM, hh:mm a")}</span>}
                />
              );
            })}
          </AppList>

          {/* md+: table. */}
          <div className="hidden md:block">
            <TableWrap cards={false}>
              <THead>
                <tr>
                  <TH>Date &amp; time</TH>
                  <TH>Recipients</TH>
                  <TH>Subject</TH>
                  <TH>Sender</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Files</TH>
                </tr>
              </THead>
              <TBody>
                {data.items.map((m) => {
                  const href = hrefFor(m.id);
                  return (
                    <TR key={m.id}>
                      <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(m.sentAt ?? m.createdAt)}</TD>
                      <TD className="max-w-[16rem]">
                        <span className="block truncate text-ink" title={m.toAddresses.join(", ")}>
                          {recipientsLine(m.toAddresses, [], [])}
                        </span>
                        {(m.ccAddresses.length > 0 || m.bccAddresses.length > 0) && (
                          <span className="block text-caption text-muted">
                            {m.ccAddresses.length ? `${m.ccAddresses.length} Cc` : ""}
                            {m.ccAddresses.length && m.bccAddresses.length ? " · " : ""}
                            {m.bccAddresses.length ? `${m.bccAddresses.length} Bcc` : ""}
                          </span>
                        )}
                      </TD>
                      <TD className="max-w-md">
                        {href ? (
                          <Link href={href} className="ring-focus block rounded-xs font-medium text-ink hover:text-navy hover:underline">
                            {m.subject}
                          </Link>
                        ) : (
                          <span className="block font-medium text-ink">{m.subject}</span>
                        )}
                        {m.messageId && (
                          <span className="block max-w-[22rem] truncate font-mono text-caption text-muted" title={m.messageId}>
                            {m.messageId}
                          </span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-ink">{m.sentBy ?? m.createdBy}</TD>
                      <TD>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={m.status} />
                          {m.isTest && <Badge tone="info">Test</Badge>}
                        </span>
                        {m.error && (
                          <span className="mt-1 block max-w-[14rem] truncate text-caption text-danger" title={m.error}>
                            {m.error}
                          </span>
                        )}
                      </TD>
                      <TD className="text-right text-muted tabular-nums">
                        {m.attachments.length > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3.5 w-3.5" aria-hidden />
                            {m.attachments.length}
                            <span className="sr-only"> attachment{m.attachments.length === 1 ? "" : "s"}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </TD>
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
