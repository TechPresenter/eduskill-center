"use client";

import { ChevronRight, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/stats";

/** One row of GET /api/trainer/students. */
export interface TrainerStudentRow {
  admissionId: string;
  admissionNo: string;
  status: string;
  admittedAt: string;
  student: { id: string; name: string; studentId: string | null; photoUrl: string | null; mobile: string; gender: string | null };
  batch: { id: string; code: string; name: string; status: string; course: { name: string } };
  attendancePct: number;
  classesHeld: number;
  classesAttended: number;
  assignmentsTotal: number;
  assignmentsCompleted: number;
  assessmentAvgPct: number;
  completionPct: number;
}

export function attendanceTone(p: number): "success" | "warning" | "danger" {
  return p >= 75 ? "success" : p >= 60 ? "warning" : "danger";
}

/** Attendance against the 75% rule is the one number a trainer must read without opening anything. */
export function attendanceTextClass(p: number) {
  return p >= 75 ? "text-success-dark" : p >= 60 ? "text-amber-700" : "text-danger";
}

/**
 * One student, as a card: photo, name, batch, admission status, and the two numbers that decide a
 * follow-up call — attendance and assignments. The header opens the quick-profile sheet; the phone
 * link beside it is its own 44px target so a trainer can ring a guardian from the classroom without
 * opening anything. The progress bars sit outside the button, because a `role="progressbar"` nested
 * inside a control is announced as part of its label.
 */
export function StudentCard({ row: r, onOpen, className }: { row: TrainerStudentRow; onOpen: () => void; className?: string }) {
  return (
    <li className={cn("card overflow-hidden", className)}>
      <div className="flex items-stretch">
        <button type="button" onClick={onOpen} className="flex min-h-16 min-w-0 flex-1 items-start gap-3 p-4 text-left tap-highlight-none active:bg-surface/70">
          <Avatar name={r.student.name} src={r.student.photoUrl} size={44} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-body font-semibold text-ink">{r.student.name}</span>
              <StatusBadge status={r.status} />
            </span>
            <span className="mt-0.5 block truncate font-mono text-caption text-muted">{r.student.studentId ?? "ID pending"}</span>
            <span className="mt-0.5 block truncate text-caption text-muted">
              {r.batch.name} · {r.batch.course.name}
            </span>
          </span>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted" aria-hidden />
        </button>
        <a
          href={`tel:${r.student.mobile}`}
          aria-label={`Call ${r.student.name} on ${r.student.mobile}`}
          className="flex w-12 shrink-0 items-center justify-center border-l border-line text-navy tap-highlight-none active:bg-surface"
        >
          <Phone className="h-5 w-5" aria-hidden />
        </a>
      </div>
      <div className="space-y-2 border-t border-line px-4 py-3">
        <ProgressBar value={r.attendancePct} tone={attendanceTone(r.attendancePct)} label={`Attendance ${Math.round(r.attendancePct)}% (${r.classesAttended}/${r.classesHeld})`} />
        <ProgressBar value={r.assignmentsCompleted} max={r.assignmentsTotal || 1} tone="navy" label={`Assignments ${r.assignmentsCompleted}/${r.assignmentsTotal}`} />
      </div>
    </li>
  );
}
