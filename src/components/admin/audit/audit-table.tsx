"use client";

import * as React from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/input";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { JsonDiff } from "@/components/admin/shared/json-diff";
import { KeyValue } from "@/components/ui/misc";
import { formatDateTime, titleCase } from "@/lib/utils";

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

const ACTION_TONE = (action: string): "success" | "danger" | "warning" | "info" | "neutral" | "navy" => {
  if (/delete|reject|revoke|cancel|deactivate|suspend|unverify/.test(action)) return "danger";
  if (/create|approve|verify|activate|issue|complete|import/.test(action)) return "success";
  if (/login|logout|export/.test(action)) return "neutral";
  if (/password|permission|role/.test(action)) return "warning";
  return "info";
};

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [selected, setSelected] = React.useState<AuditRow | null>(null);
  const [showUnchanged, setShowUnchanged] = React.useState(false);
  const hasValues = (r: AuditRow) => r.oldValue !== null && r.oldValue !== undefined ? true : r.newValue !== null && r.newValue !== undefined;

  return (
    <>
      <TableWrap>
        <THead>
          <tr>
            <TH>When</TH>
            <TH>Actor</TH>
            <TH>Action</TH>
            <TH>Module</TH>
            <TH>Record</TH>
            <TH>Description</TH>
            <TH>IP</TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && <EmptyRow colSpan={7}>No audit entries match these filters.</EmptyRow>}
          {rows.map((r) => (
            <TR
              key={r.id}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              aria-label={`Open audit entry: ${r.description}`}
              onClick={() => setSelected(r)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(r);
                }
              }}
            >
              <TD mobile="full">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={ACTION_TONE(r.action)}>{r.action}</Badge>
                  <span className="text-xs font-semibold tracking-wide text-muted uppercase md:hidden">{titleCase(r.module)}</span>
                </span>
                <span className="mt-1 block text-sm font-normal text-ink md:hidden">{r.description}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted md:hidden">
                  {formatDateTime(r.createdAt)} · {r.actorName ?? "System"}
                </span>
                {hasValues(r) && <span className="mt-1 block text-xs font-semibold text-orange md:hidden">Tap to view changes</span>}
                <span className="hidden text-muted md:block md:whitespace-nowrap">{formatDateTime(r.createdAt)}</span>
              </TD>
              <TD label="Actor" mobile="hidden">
                <span className="block font-medium">{r.actorName ?? "System"}</span>
                <span className="block text-xs text-muted">{titleCase(r.actorRole ?? "")}</span>
              </TD>
              <TD label="Action" mobile="hidden">
                <Badge tone={ACTION_TONE(r.action)}>{r.action}</Badge>
              </TD>
              <TD label="Module" mobile="hidden" className="text-xs">
                {titleCase(r.module)}
              </TD>
              <TD label="Record" className="text-xs">
                {r.recordType ?? <span className="text-muted">—</span>}
                {r.recordId && <span className="block max-w-[10rem] truncate font-mono text-xs text-muted">{r.recordId}</span>}
              </TD>
              <TD label="Description" mobile="hidden" className="max-w-md">
                <span className="line-clamp-2">{r.description}</span>
                {hasValues(r) && <span className="mt-0.5 block text-xs font-semibold text-orange">View changes</span>}
              </TD>
              <TD label="IP" className="font-mono text-xs text-muted">
                {r.ip ?? "—"}
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title="Audit entry" description={selected?.description} size="xl" height="full">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KeyValue label="When" value={formatDateTime(selected.createdAt)} />
              <KeyValue label="Actor" value={`${selected.actorName ?? "System"} (${titleCase(selected.actorRole ?? "system")})`} />
              <KeyValue label="Action" value={<Badge tone={ACTION_TONE(selected.action)}>{selected.action}</Badge>} />
              <KeyValue label="Module" value={titleCase(selected.module)} />
              <KeyValue label="Record" value={selected.recordType ? `${selected.recordType}${selected.recordId ? ` · ${selected.recordId}` : ""}` : "—"} />
              <KeyValue label="IP" value={selected.ip ?? "—"} />
              <div className="col-span-2 sm:col-span-3">
                <KeyValue label="User agent" value={<span className="break-all text-xs">{selected.userAgent ?? "—"}</span>} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-navy">Recorded values</h3>
                <Checkbox checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} label={<span className="text-xs">Show unchanged fields</span>} className="items-center" />
              </div>
              <JsonDiff oldValue={selected.oldValue} newValue={selected.newValue} showUnchanged={showUnchanged} />
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
