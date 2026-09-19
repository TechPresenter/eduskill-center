import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar, RingProgress } from "@/components/ui/stats";

export interface ProgressSummary {
  completionPct: number;
  classesHeld: number;
  classesAttended: number;
  totalClasses: number;
  attendancePct: number;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  assessmentAvgPct: number;
}

export interface ProgressSummaryCardProps {
  courseName: string;
  progress: ProgressSummary;
  minAttendancePct: number;
  /** Omitted when the caller has not loaded the course pass mark – the assessment bar then stays neutral. */
  passingMarksPct?: number;
  href?: string;
  className?: string;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-2.5 py-2">
      <p className="truncate text-[15px] font-bold text-navy tabular-nums">{value}</p>
      <p className="truncate text-[12px] text-muted">{label}</p>
    </div>
  );
}

/**
 * Course-progress card for the phone home: a ring for overall completion plus attendance,
 * assignment and assessment bars, and the raw class / assignment figures underneath.
 */
export function ProgressSummaryCard({ courseName, progress, minAttendancePct, passingMarksPct, href = "/student/progress", className }: ProgressSummaryCardProps) {
  const attendanceOk = progress.attendancePct >= minAttendancePct;
  const hasAssessment = progress.assessmentAvgPct > 0;
  const assignmentPct = progress.assignmentsTotal ? (progress.assignmentsCompleted / progress.assignmentsTotal) * 100 : 0;
  const totalClasses = progress.totalClasses || progress.classesHeld;

  return (
    <section className={cn("card p-4", className)} aria-label="Course progress">
      <Link href={href} className="-m-1 mb-2 flex min-h-11 items-center gap-2 rounded-xl p-1 tap-highlight-none">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-navy">Course progress</span>
          <span className="block truncate text-[12px] text-muted">{courseName}</span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-orange">View</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-orange" aria-hidden />
      </Link>

      <div className="flex items-center gap-4">
        <RingProgress value={progress.completionPct} size={88} stroke={8} label="Complete" className="shrink-0" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <ProgressBar label={`Attendance ${Math.round(progress.attendancePct)}%`} value={progress.attendancePct} tone={attendanceOk ? "success" : "warning"} />
          <ProgressBar label={`Assignments ${progress.assignmentsCompleted}/${progress.assignmentsTotal}`} value={assignmentPct} tone="navy" />
          <ProgressBar
            label={hasAssessment ? `Assessment ${Math.round(progress.assessmentAvgPct)}%` : "Assessment – pending"}
            value={progress.assessmentAvgPct}
            tone={!hasAssessment || passingMarksPct === undefined ? "navy" : progress.assessmentAvgPct >= passingMarksPct ? "success" : "danger"}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Figure label="Classes completed" value={`${progress.classesAttended}/${totalClasses || 0}`} />
        <Figure label={`Attendance (min ${minAttendancePct}%)`} value={`${Math.round(progress.attendancePct)}%`} />
      </div>
    </section>
  );
}
