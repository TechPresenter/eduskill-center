"use client";

import { Landmark } from "lucide-react";
import { CopyButton } from "@/components/admin/shared/copy-button";

/**
 * Renders the `payments.bankDetails` setting as a labelled list the donor can copy from.
 *
 * The setting is a free-text textarea the Foundation edits in Admin → Settings → Payments, so the
 * parsing is deliberately forgiving: a line reading `Label: value` (or `Label<tab>value`) becomes a
 * labelled row with a copy button, and anything else is kept as a plain note underneath.
 */
export function BankDetails({ value, className }: { value: string; className?: string }) {
  const lines = value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: { label: string; value: string }[] = [];
  const notes: string[] = [];
  for (const line of lines) {
    const m = line.match(/^([^:\t]{2,40})[:\t]\s*(.+)$/);
    if (m) rows.push({ label: m[1]!.trim(), value: m[2]!.trim() });
    else notes.push(line);
  }

  if (rows.length === 0 && notes.length === 0) return null;

  return (
    <div className={className}>
      <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-muted uppercase">
        <Landmark className="h-4 w-4 text-navy" aria-hidden />
        Bank transfer details
      </h3>
      {rows.length > 0 && (
        <dl className="mt-4 divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{r.label}</dt>
                <dd className="mt-0.5 font-medium break-words text-navy">{r.value}</dd>
              </div>
              <CopyButton text={r.value} label="Copy" />
            </div>
          ))}
        </dl>
      )}
      {notes.length > 0 && <p className="mt-3 text-sm whitespace-pre-line text-muted">{notes.join("\n")}</p>}
      <p className="mt-4 text-xs text-muted">
        Please quote your donation number as the transfer reference so we can match your donation and send the receipt.
      </p>
    </div>
  );
}
