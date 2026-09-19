"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export interface AttendanceRow {
  id: string;
  /** ISO date string (serialised by the page so this stays a client component). */
  date: string;
  status: string;
  remarks: string | null;
  courseName: string;
  batchName: string;
}

/** One attendance entry as a phone card. */
export function AttendanceRowCard({ record: r }: { record: AttendanceRow }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-navy">{formatDate(r.date, "EEE, dd MMM")}</p>
        <p className="truncate text-[13px] text-muted">
          {r.courseName} · {r.batchName}
        </p>
        {r.remarks && <p className="mt-0.5 text-[12px] text-muted">{r.remarks}</p>}
      </div>
      <StatusBadge status={r.status} />
    </li>
  );
}

/**
 * Attendance history for phones: cards grouped under a sticky month header, latest `initial`
 * entries first with a "Show all" button so long histories stay light.
 */
export function AttendanceRecordsList({ records, initial = 30 }: { records: AttendanceRow[]; initial?: number }) {
  const [all, setAll] = React.useState(false);
  const visible = all ? records : records.slice(0, initial);
  const hidden = records.length - visible.length;

  const groups: { month: string; rows: AttendanceRow[] }[] = [];
  for (const r of visible) {
    const month = formatDate(r.date, "MMMM yyyy");
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.rows.push(r);
    else groups.push({ month, rows: [r] });
  }

  if (records.length === 0) return <p className="px-4 py-6 text-center text-[13px] text-muted">No attendance marked yet.</p>;

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <section key={g.month} aria-label={g.month}>
          <h4 className="sticky top-14 z-10 -mx-4 bg-surface/95 px-4 py-1.5 text-[12px] font-bold tracking-wide text-muted uppercase backdrop-blur">{g.month}</h4>
          <ul className="card divide-y divide-line overflow-hidden">
            {g.rows.map((r) => (
              <AttendanceRowCard key={r.id} record={r} />
            ))}
          </ul>
        </section>
      ))}
      {hidden > 0 && (
        <Button variant="outline" fullWidth onClick={() => setAll(true)}>
          Show all {records.length} entries
        </Button>
      )}
    </div>
  );
}
