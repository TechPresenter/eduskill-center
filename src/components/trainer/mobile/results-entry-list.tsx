"use client";

import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Avatar } from "@/components/ui/misc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { gradeFor, gradeTone } from "@/components/trainer/grades";

/** One roster row of GET /api/trainer/assessments/[id]/results. */
export interface ResultRow {
  admissionId: string;
  student: { id: string; name: string; studentId: string | null; photoUrl: string | null };
  admissionStatus: string;
  marks: number | null;
  grade: string | null;
  remarks: string | null;
  evaluatedAt: string | null;
}

/** Editable marks + remarks per student (strings so the inputs stay controlled while typing). */
export interface ResultEntry {
  marks: string;
  remarks: string;
}

export interface ResultsEntryListProps {
  rows: ResultRow[];
  entries: Record<string, ResultEntry>;
  /** Field errors keyed by student id (local validation or mapped from the API's `results.<i>.marks`). */
  errors: Record<string, string>;
  maxMarks: number;
  passingMarks: number;
  /** Everything read-only (inactive trainer, cancelled batch). Completed admissions are locked individually. */
  canEdit: boolean;
  onChange: (studentId: string, patch: Partial<ResultEntry>) => void;
  className?: string;
}

/** Live grade for a typed value, or null while empty / invalid. */
export function previewGrade(raw: string, maxMarks: number, passingMarks: number): string | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= maxMarks ? gradeFor(n, maxMarks, passingMarks) : null;
}

/** DOM id of a student's marks input in the phone list (the desktop table uses `dm-<id>`). */
export function marksInputId(studentId: string) {
  return `m-${studentId}`;
}

/**
 * Phone results entry (`lg:hidden`): one card per student with a 48px-tall numeric marks input
 * (`inputMode="decimal"`, Enter / "next" moves to the next student), a live grade badge, an
 * "Add remark" disclosure and the row error under the input. State is owned by the caller so the
 * desktop table can share it.
 */
export function ResultsEntryList({ rows, entries, errors, maxMarks, passingMarks, canEdit, onChange, className }: ResultsEntryListProps) {
  const [remarkOpen, setRemarkOpen] = React.useState<Record<string, boolean>>({});
  const order = React.useMemo(() => rows.map((r) => r.student.id), [rows]);

  const focusNext = (studentId: string) => {
    const i = order.indexOf(studentId);
    for (let j = i + 1; j < order.length; j++) {
      const el = document.getElementById(marksInputId(order[j]!));
      if (el instanceof HTMLInputElement && !el.disabled) {
        el.focus();
        el.select();
        return;
      }
    }
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <ul className={cn("space-y-3 lg:hidden", className)}>
      {rows.map((r, idx) => {
        const sid = r.student.id;
        const e = entries[sid] ?? { marks: "", remarks: "" };
        const grade = previewGrade(e.marks, maxMarks, passingMarks);
        const err = errors[sid];
        const locked = !canEdit || r.admissionStatus === "COMPLETED";
        const showRemark = remarkOpen[sid] || e.remarks.trim() !== "";
        return (
          <li key={r.admissionId} className="card p-4">
            <div className="flex items-start gap-3">
              <Avatar name={r.student.name} src={r.student.photoUrl} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-ink">{r.student.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-caption text-muted">
                  {r.student.studentId ?? "ID pending"}
                  {r.admissionStatus !== "ACTIVE" && <StatusBadge status={r.admissionStatus} />}
                </p>
                {r.evaluatedAt && <p className="mt-0.5 text-caption text-muted">Saved {formatDateTime(r.evaluatedAt)}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Field label={<span className="sr-only">Marks for {r.student.name} (out of {maxMarks})</span>} htmlFor={marksInputId(sid)} autoWire={false}>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id={marksInputId(sid)}
                      type="number"
                      min={0}
                      max={maxMarks}
                      step="0.5"
                      inputMode="decimal"
                      enterKeyHint={idx === rows.length - 1 ? "done" : "next"}
                      value={e.marks}
                      onChange={(ev) => onChange(sid, { marks: ev.target.value })}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          focusNext(sid);
                        }
                      }}
                      invalid={!!err}
                      disabled={locked}
                      aria-describedby={err ? `${marksInputId(sid)}-error` : undefined}
                      className="h-12 w-24 min-w-24 px-2 text-center text-lg font-bold tabular-nums sm:text-lg"
                    />
                    <span className="text-body-sm font-semibold text-muted tabular-nums">/ {maxMarks}</span>
                  </div>
                </Field>
                {grade ? <Badge tone={gradeTone(grade)}>{grade}</Badge> : <span className="text-caption text-muted">No grade yet</span>}
              </div>
            </div>
            {err && (
              <p id={`${marksInputId(sid)}-error`} className="mt-2 text-body-sm font-medium text-danger" role="alert">
                {err}
              </p>
            )}
            <div className="mt-3">
              {showRemark ? (
                <Field label="Remark" htmlFor={`r-${sid}`}>
                  <Input id={`r-${sid}`} value={e.remarks} onChange={(ev) => onChange(sid, { remarks: ev.target.value })} maxLength={500} placeholder="Optional" disabled={locked} />
                </Field>
              ) : (
                !locked && (
                  <button
                    type="button"
                    onClick={() => setRemarkOpen((s) => ({ ...s, [sid]: true }))}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-navy tap-highlight-none hover:underline"
                  >
                    <MessageSquarePlus className="h-4 w-4" aria-hidden /> Add remark
                  </button>
                )
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
