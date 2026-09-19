import Link from "next/link";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/badge";
import type { ProgressNumbers } from "@/server/admissions";

interface Props {
  progress: ProgressNumbers | null;
  admissionStatus: string;
  batchStatus: string;
  minAttendancePct: number;
  passingMarksPct: number;
  certificate: { id: string; certificateNo: string; status: string; issuedAt: string | Date } | null;
}

/** Server-safe checklist explaining why a student is (not) eligible for a certificate. */
export function EligibilityChecklist({ progress, admissionStatus, batchStatus, minAttendancePct, passingMarksPct, certificate }: Props) {
  const trainingOver = admissionStatus === "COMPLETED" || batchStatus === "COMPLETED" || !!progress?.isCompleted;
  const attendanceOk = !!progress && progress.attendancePct >= minAttendancePct;
  const hasAssessments = !!progress && progress.assessmentAvgPct > 0;
  const assessmentOk = !progress ? false : !hasAssessments || progress.assessmentAvgPct >= passingMarksPct;
  const items: { label: string; detail: string; ok: boolean; pending?: boolean }[] = [
    { label: "Training completed", detail: trainingOver ? "Marked complete" : `Admission ${admissionStatus.toLowerCase().replace("_", " ")} · batch ${batchStatus.toLowerCase()}`, ok: trainingOver },
    { label: `Attendance ≥ ${minAttendancePct}%`, detail: progress ? `${progress.attendancePct}% (${progress.classesAttended}/${progress.classesHeld} classes)` : "Not computed", ok: attendanceOk },
    { label: `Assessment average ≥ ${passingMarksPct}%`, detail: !progress ? "Not computed" : hasAssessments ? `${progress.assessmentAvgPct}%` : "No graded assessments – not required", ok: assessmentOk, pending: !!progress && !hasAssessments },
  ];
  const eligible = !!progress?.certificateEligible;
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-2 text-sm">
            {it.ok ? it.pending ? <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
            <span>
              <span className="font-medium text-ink">{it.label}</span>
              <span className="block text-xs text-muted">{it.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {certificate ? (
        <div className="rounded-xl bg-success-light/60 p-3 text-sm">
          <p className="font-semibold text-green-800">Certificate issued {formatDate(certificate.issuedAt)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <Link href={`/verify-certificate/${certificate.certificateNo}`} target="_blank" className="font-mono text-navy hover:underline">
              {certificate.certificateNo}
            </Link>
            <StatusBadge status={certificate.status} />
            <a href={`/api/admin/certificates/${certificate.id}/download`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-orange hover:underline">
              Download PDF
            </a>
          </p>
        </div>
      ) : eligible ? (
        <Badge tone="success">Eligible for certificate</Badge>
      ) : (
        <Badge tone="warning">Not eligible yet</Badge>
      )}
    </div>
  );
}
