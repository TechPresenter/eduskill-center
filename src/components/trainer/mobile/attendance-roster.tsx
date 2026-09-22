"use client";

import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Avatar } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

/** One student on the attendance sheet (GET /api/trainer/attendance). */
export interface AttendanceStudent {
  admissionId: string;
  studentId: string;
  studentCode: string | null;
  name: string;
  photoUrl: string | null;
  admissionStatus: string;
  status: AttendanceStatus | null;
  remarks: string | null;
}

/** Editable mark per student, owned by the caller so the save button can read it. */
export interface AttendanceMark {
  status: AttendanceStatus | null;
  remarks: string;
}

/**
 * The four states, in the order a trainer calls a register. `active` is the filled treatment;
 * `idle` keeps a tinted resting state so the row still reads as four distinct choices at arm's length
 * on a cheap screen in daylight.
 */
export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string; short: string; active: string; idle: string }[] = [
  { value: "PRESENT", label: "Present", short: "P", active: "border-success bg-success text-white", idle: "border-line bg-white text-ink hover:border-success/50 hover:bg-success-light/60" },
  { value: "ABSENT", label: "Absent", short: "A", active: "border-danger bg-danger text-white", idle: "border-line bg-white text-ink hover:border-danger/50 hover:bg-danger-light/60" },
  { value: "LATE", label: "Late", short: "L", active: "border-warning bg-warning text-white", idle: "border-line bg-white text-ink hover:border-warning/60 hover:bg-warning-light/60" },
  { value: "LEAVE", label: "Leave", short: "LV", active: "border-info bg-info text-white", idle: "border-line bg-white text-ink hover:border-info/50 hover:bg-info-light/60" },
];

export interface AttendanceRosterProps {
  students: AttendanceStudent[];
  marks: Record<string, AttendanceMark>;
  /** Whole sheet read-only (inactive trainer, completed or cancelled batch). */
  readOnly: boolean;
  onStatus: (studentId: string, status: AttendanceStatus) => void;
  onRemarks: (studentId: string, remarks: string) => void;
  className?: string;
}

/**
 * Phone-first attendance register. Each student is a card: 40px photo, name, ID, then a four-way
 * status control that fills the card's width on a phone (each target ≥44px tall, the full label
 * visible from `sm`) and shrinks to a compact row on desktop. Remarks stay behind a disclosure so the
 * common case — tap four hundred "P"s — is one tap per student and nothing else.
 *
 * State lives with the caller, so the same marks feed the sticky Save bar without a second source of truth.
 */
export function AttendanceRoster({ students, marks, readOnly, onStatus, onRemarks, className }: AttendanceRosterProps) {
  const [remarkOpen, setRemarkOpen] = React.useState<Record<string, boolean>>({});

  return (
    <ul className={cn("divide-y divide-line", className)} aria-label="Attendance sheet">
      {students.map((s, i) => {
        const m = marks[s.studentId];
        const completed = s.admissionStatus === "COMPLETED";
        const rowDisabled = readOnly || completed;
        const showRemark = !!remarkOpen[s.studentId] || !!m?.remarks;
        return (
          <li key={s.admissionId} className="px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-5 shrink-0 text-right text-caption text-muted tabular-nums">{i + 1}</span>
                <Avatar name={s.name} src={s.photoUrl} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-ink">{s.name}</p>
                  <p className="flex flex-wrap items-center gap-2 text-caption text-muted">
                    <span className="font-mono">{s.studentCode ?? "ID pending"}</span>
                    {s.admissionStatus !== "ACTIVE" && <StatusBadge status={s.admissionStatus} />}
                  </p>
                </div>
              </div>

              <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="grid grid-cols-4 gap-2 xl:w-auto xl:shrink-0">
                {ATTENDANCE_STATUSES.map((st) => {
                  const active = m?.status === st.value;
                  return (
                    <button
                      key={st.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={rowDisabled}
                      onClick={() => onStatus(s.studentId, st.value)}
                      className={cn(
                        "inline-flex min-h-11 items-center justify-center rounded-md border px-2 text-body-sm font-bold ring-focus transition duration-micro active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:min-w-20 sm:font-semibold",
                        active ? st.active : st.idle
                      )}
                    >
                      <span className="sm:hidden">{st.short}</span>
                      <span className="hidden sm:inline">{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {showRemark ? (
              <div className="mt-2.5">
                <Field label={<span className="sr-only">Remarks for {s.name}</span>} htmlFor={`remark-${s.studentId}`}>
                  <Input
                    id={`remark-${s.studentId}`}
                    value={m?.remarks ?? ""}
                    onChange={(e) => onRemarks(s.studentId, e.target.value)}
                    placeholder="Remark (optional)"
                    maxLength={300}
                    disabled={rowDisabled}
                  />
                </Field>
              </div>
            ) : (
              !rowDisabled && (
                <button
                  type="button"
                  onClick={() => setRemarkOpen((o) => ({ ...o, [s.studentId]: true }))}
                  className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-body-sm font-semibold text-navy tap-highlight-none hover:underline"
                >
                  <MessageSquarePlus className="h-4 w-4" aria-hidden /> Add remark
                </button>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
