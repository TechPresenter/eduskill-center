"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, CheckCircle2, Download, FileSearch, History, KeyRound, LogIn, Pencil, Plus, Trash2, UserRound, XCircle } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { KeyValue } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { JsonDiff } from "@/components/admin/shared/json-diff";
import { CopyButton } from "@/components/admin/shared/copy-button";
import { AppListRow, IconTile, ListSection, type TileTone } from "@/components/admin/content/app-list";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";

export interface AuditRow {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorRole: string | null;
  userId: string | null;
  action: string;
  module: string;
  recordType: string | null;
  recordId: string | null;
  description: string;
  oldValue: unknown;
  newValue: unknown;
  ip: string | null;
  userAgent: string | null;
}

type Tone = "success" | "danger" | "warning" | "info" | "neutral";

const ACTION_TONE = (action: string): Tone => {
  if (/delete|reject|revoke|cancel|deactivate|suspend|unverify/i.test(action)) return "danger";
  if (/create|approve|verify|activate|issue|complete|import/i.test(action)) return "success";
  if (/login|logout|export/i.test(action)) return "neutral";
  if (/password|permission|role/i.test(action)) return "warning";
  return "info";
};

/** The glyph for an action family (returned as an element so no component is created during render). */
const actionIcon = (action: string): React.ReactNode => {
  if (/delete|remove/i.test(action)) return <Trash2 />;
  if (/reject|revoke|cancel|suspend|deactivate/i.test(action)) return <XCircle />;
  if (/approve|verify|activate|issue|complete/i.test(action)) return <CheckCircle2 />;
  if (/create|import|add/i.test(action)) return <Plus />;
  if (/login|logout/i.test(action)) return <LogIn />;
  if (/export/i.test(action)) return <Download />;
  if (/password|permission|role/i.test(action)) return <KeyRound />;
  if (/update|edit|change|status/i.test(action)) return <Pencil />;
  return <Activity />;
};

const TILE: Record<Tone, TileTone> = { success: "success", danger: "danger", warning: "warning", info: "info", neutral: "neutral" };

const hasValues = (r: AuditRow) => (r.oldValue !== null && r.oldValue !== undefined) || (r.newValue !== null && r.newValue !== undefined);
const timeOf = (iso: string) => formatDate(iso, "hh:mm a");

/** "Today" / "Yesterday" / "12 Sep 2026" — a day heading for the phone timeline. Same formatter as every other admin date. */
function dayLabel(iso: string) {
  const key = formatDate(iso, "yyyy-MM-dd");
  const now = new Date();
  if (key === formatDate(now, "yyyy-MM-dd")) return "Today";
  if (key === formatDate(new Date(now.getTime() - 86400000), "yyyy-MM-dd")) return "Yesterday";
  return formatDate(iso);
}

function ActionTile({ action, size = "md" }: { action: string; size?: "sm" | "md" }) {
  return (
    <IconTile tone={TILE[ACTION_TONE(action)]} size={size}>
      {actionIcon(action)}
    </IconTile>
  );
}

/**
 * The audit trail. Phones read it as a timeline grouped by day — one row per entry with a coloured
 * action tile, the description, who did it and when. From `md` it is a dense table. Either way a tap
 * opens the entry in a sheet with the before/after diff, "changed only" by default.
 */
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [selected, setSelected] = React.useState<AuditRow | null>(null);
  const [view, setView] = React.useState<"changed" | "all">("changed");

  if (rows.length === 0) {
    return <EmptyState icon={<FileSearch className="h-7 w-7" />} title="No audit entries match" description="Every admin action is recorded here. Widen the date range or clear a filter to see more." />;
  }

  const days: { label: string; rows: AuditRow[] }[] = [];
  for (const r of rows) {
    const label = dayLabel(r.createdAt);
    const last = days[days.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else days.push({ label, rows: [r] });
  }

  const openRow = (r: AuditRow) => {
    setView("changed");
    setSelected(r);
  };

  return (
    <>
      {/* Phones: timeline grouped by day. */}
      <div className="space-y-5 md:hidden">
        {days.map((d, i) => (
          <ListSection key={`${d.label}-${i}`} id={`audit-day-${i}`} title={d.label} count={d.rows.length}>
            <ul aria-labelledby={`audit-day-${i}`} className="card animate-fade-in divide-y divide-line overflow-hidden motion-reduce:animate-none">
              {d.rows.map((r) => (
                <AppListRow
                  key={r.id}
                  onClick={() => openRow(r)}
                  aria-label={`Open audit entry: ${r.description}`}
                  leading={<ActionTile action={r.action} />}
                  title={r.description}
                  subtitle={`${r.actorName ?? "System"} · ${titleCase(r.module)}`}
                  clamp={1}
                  meta={hasValues(r) ? <span className="text-caption font-semibold text-orange">View changes</span> : undefined}
                  trailing={<span className="tabular-nums">{timeOf(r.createdAt)}</span>}
                  chevron={false}
                />
              ))}
            </ul>
          </ListSection>
        ))}
      </div>

      {/* md+: table. */}
      <div className="hidden md:block">
        <TableWrap cards={false}>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Description</TH>
              <TH>Record</TH>
              <TH>IP</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR
                key={r.id}
                className="cursor-pointer transition-colors duration-micro hover:bg-surface/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange motion-reduce:transition-none"
                tabIndex={0}
                role="button"
                aria-label={`Open audit entry: ${r.description}`}
                onClick={() => openRow(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openRow(r);
                  }
                }}
              >
                <TD className="whitespace-nowrap text-muted tabular-nums">
                  <span className="block text-ink">{formatDate(r.createdAt)}</span>
                  <span className="text-caption">{timeOf(r.createdAt)}</span>
                </TD>
                <TD>
                  <span className="block font-medium">{r.actorName ?? "System"}</span>
                  <span className="block text-caption text-muted">{titleCase(r.actorRole ?? "system")}</span>
                </TD>
                <TD>
                  <span className="flex items-center gap-2">
                    <ActionTile action={r.action} size="sm" />
                    <span className="min-w-0">
                      <Badge tone={ACTION_TONE(r.action)}>{r.action}</Badge>
                      <span className="mt-0.5 block text-caption text-muted">{titleCase(r.module)}</span>
                    </span>
                  </span>
                </TD>
                <TD className="max-w-md">
                  <span className="line-clamp-2">{r.description}</span>
                  {hasValues(r) && <span className="mt-0.5 block text-caption font-semibold text-orange">View changes</span>}
                </TD>
                <TD className="text-caption">
                  {r.recordType ?? <span className="text-muted">—</span>}
                  {r.recordId && <span className="block max-w-[10rem] truncate font-mono text-muted">{r.recordId}</span>}
                </TD>
                <TD className="font-mono text-caption text-muted">{r.ip ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      </div>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title="Audit entry" description={selected ? formatDateTime(selected.createdAt) : undefined} size="xl" height="full">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-card bg-surface p-4">
              <ActionTile action={selected.action} />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold break-words text-ink">{selected.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={ACTION_TONE(selected.action)}>{selected.action}</Badge>
                  <Badge tone="navy">{titleCase(selected.module)}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KeyValue label="Actor" value={`${selected.actorName ?? "System"} (${titleCase(selected.actorRole ?? "system")})`} />
              <KeyValue label="When" value={<span className="tabular-nums">{formatDateTime(selected.createdAt)}</span>} />
              <KeyValue label="IP" value={<span className="font-mono">{selected.ip ?? "—"}</span>} />
              <div className="col-span-2 sm:col-span-3">
                <KeyValue
                  label="Record"
                  value={
                    selected.recordType ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span>{selected.recordType}</span>
                        {selected.recordId && (
                          <>
                            <span className="font-mono text-caption break-all text-muted">{selected.recordId}</span>
                            <CopyButton text={selected.recordId} />
                          </>
                        )}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
              <div className="col-span-2 sm:col-span-3">
                <KeyValue label="Device" value={<span className="text-caption break-all">{selected.userAgent ?? "—"}</span>} />
              </div>
            </div>

            {/* Jump to related history. */}
            <div className="flex flex-col gap-2 sm:flex-row">
              {selected.userId && (
                <Link href={`/admin/audit-logs?userId=${selected.userId}`} onClick={() => setSelected(null)} className={buttonClasses({ variant: "outline", size: "sm", className: "gap-2" })}>
                  <UserRound className="h-4 w-4" aria-hidden /> Everything by {selected.actorName ?? "this user"}
                </Link>
              )}
              {selected.recordId && (
                <Link href={`/admin/audit-logs?recordId=${encodeURIComponent(selected.recordId)}`} onClick={() => setSelected(null)} className={buttonClasses({ variant: "outline", size: "sm", className: "gap-2" })}>
                  <History className="h-4 w-4" aria-hidden /> History of this record
                </Link>
              )}
            </div>

            <section aria-labelledby="audit-values" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="audit-values" className="text-h4 text-navy">
                  Recorded values
                </h3>
                {hasValues(selected) && (
                  <SegmentedControl
                    value={view}
                    onChange={(v) => setView(v as "changed" | "all")}
                    items={[
                      { value: "changed", label: "Changes" },
                      { value: "all", label: "All fields" },
                    ]}
                  />
                )}
              </div>
              {hasValues(selected) ? (
                <JsonDiff oldValue={selected.oldValue} newValue={selected.newValue} showUnchanged={view === "all"} />
              ) : (
                <p className="rounded-card border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-body-sm text-muted">This action did not record any before/after values.</p>
              )}
            </section>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
