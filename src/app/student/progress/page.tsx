import type { Metadata } from "next";
import { Award, CheckCircle2, Circle, Download, TrendingUp } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { studentAdmissions } from "@/server/student-portal";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar, RingProgress } from "@/components/ui/stats";

export const metadata: Metadata = { title: "Progress" };

export default async function StudentProgressPage() {
  const user = await requireStudent();
  const admissions = await studentAdmissions(user.student.id);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Progress" description="Attendance, assignments and assessments for each course you are admitted to, and your certificate eligibility." />
      {admissions.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-7 w-7" />} title="No training in progress" description="Progress tracking starts once your admission is confirmed." action={<ButtonLink href="/student/applications" variant="outline">My applications</ButtonLink>} />
      ) : (
        <div className="space-y-6">
          {admissions.map((a) => {
            const p = a.progress;
            const attendancePct = p?.attendancePct ?? 0;
            const attendanceOk = attendancePct >= a.course.minAttendancePct;
            const hasAssessments = (p?.assessmentAvgPct ?? 0) > 0 || (p?.finalMarksPct ?? null) !== null;
            const assessmentOk = !hasAssessments || (p?.assessmentAvgPct ?? 0) >= a.course.passingMarksPct;
            const trainingDone = a.status === "COMPLETED" || a.batch.status === "COMPLETED" || !!p?.isCompleted;
            const eligible = !!p?.certificateEligible;
            return (
              <Card key={a.id}>
                <CardHeader title={a.course.name} description={`${a.batch.name} (${a.batch.code}) · ${a.center.name} · Admission ${a.admissionNo}`} action={<StatusBadge status={a.status} />} />
                <CardBody>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-surface p-5">
                      <RingProgress value={p?.completionPct ?? 0} size={128} stroke={10} label="Complete" />
                      <p className="text-center text-caption text-muted">
                        {p?.classesHeld ?? 0} of {p?.totalClasses || a.course.totalClasses || "—"} classes held
                        {p?.completedAt ? ` · completed ${formatDate(p.completedAt)}` : ""}
                      </p>
                    </div>
                    <div className="space-y-4 lg:col-span-2">
                      <ProgressBar label={`Attendance · ${p?.classesAttended ?? 0}/${p?.classesHeld ?? 0} classes`} value={attendancePct} tone={attendanceOk ? "success" : "warning"} />
                      <ProgressBar label={`Assignments · ${p?.assignmentsCompleted ?? 0}/${p?.assignmentsTotal ?? 0} completed`} value={p?.assignmentsTotal ? ((p.assignmentsCompleted / p.assignmentsTotal) * 100) : 0} tone="navy" />
                      <ProgressBar label={`Assessment average${hasAssessments ? "" : " · not evaluated yet"}`} value={p?.assessmentAvgPct ?? 0} tone={assessmentOk ? "success" : "danger"} />
                      <div className="grid grid-cols-2 gap-3 text-body-sm sm:grid-cols-4">
                        <Mini label="Attendance" value={`${Math.round(attendancePct)}%`} hint={`min ${a.course.minAttendancePct}%`} />
                        <Mini label="Assessment avg" value={hasAssessments ? `${Math.round(p?.assessmentAvgPct ?? 0)}%` : "—"} hint={`pass ${a.course.passingMarksPct}%`} />
                        <Mini label="Final marks" value={p?.finalMarksPct !== null && p?.finalMarksPct !== undefined ? `${Math.round(p.finalMarksPct)}%` : "—"} hint="final assessment" />
                        <Mini label="Trainer" value={a.batch.trainer?.user.name ?? a.trainer?.user.name ?? "—"} hint={a.course.durationText} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-line p-4">
                      <p className="mb-2 text-caption font-semibold tracking-wide text-muted uppercase">Certificate eligibility</p>
                      <ul className="space-y-2 text-body-sm">
                        <Check ok={attendanceOk} label={`Attendance at least ${a.course.minAttendancePct}%`} detail={`${Math.round(attendancePct)}% so far`} />
                        <Check ok={assessmentOk && hasAssessments} pending={!hasAssessments} label={`Assessments at least ${a.course.passingMarksPct}%`} detail={hasAssessments ? `${Math.round(p?.assessmentAvgPct ?? 0)}% average` : "Awaiting evaluation"} />
                        <Check ok={trainingDone} label="Training completed" detail={trainingDone ? "Completed" : `Batch ends ${formatDate(a.batch.endDate)}`} />
                      </ul>
                    </div>
                    <div className={`flex flex-col justify-center rounded-md p-4 ${a.certificate ? "bg-success-light" : eligible ? "bg-info-light" : "bg-surface"}`}>
                      <p className="mb-1 flex items-center gap-2 text-body-sm font-bold text-navy">
                        <Award className="h-4 w-4" /> Certificate status
                      </p>
                      {a.certificate ? (
                        <>
                          <p className="text-body-sm text-green-900">
                            {a.certificate.status === "ISSUED" ? "Issued" : "Revoked"} · <span className="font-mono">{a.certificate.certificateNo}</span> · {formatDate(a.certificate.issuedAt)}
                          </p>
                          {a.certificate.status === "ISSUED" && (
                            <ButtonLink href={`/api/student/certificates/${a.certificate.id}/download`} size="sm" variant="navy" className="mt-3 self-start" leftIcon={<Download className="h-4 w-4" />}>
                              Download certificate
                            </ButtonLink>
                          )}
                        </>
                      ) : eligible ? (
                        <p className="text-body-sm text-blue-900">You are eligible. The Foundation will issue your certificate shortly.</p>
                      ) : (
                        <p className="text-body-sm text-muted">Complete the training with the required attendance and assessment marks to receive your certificate.</p>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-surface px-3 py-2">
      <p className="text-caption font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="truncate font-bold text-navy">{value}</p>
      {hint && <p className="text-caption text-muted">{hint}</p>}
    </div>
  );
}

function Check({ ok, pending, label, detail }: { ok: boolean; pending?: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${pending ? "text-line" : "text-warning"}`} />}
      <span>
        <span className="font-medium text-ink">{label}</span>
        {detail && <span className="block text-caption text-muted">{detail}</span>}
      </span>
    </li>
  );
}
