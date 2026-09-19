import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getAdmissionDetail } from "@/server/admissions";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Avatar, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ProgressBar, RingProgress, StatsCard } from "@/components/ui/stats";
import { EligibilityChecklist } from "@/components/admin/progress/eligibility-checklist";
import { ProgressRowActions } from "@/components/admin/progress/progress-actions";

export const metadata = { title: "Progress" };

export default async function ProgressDetailPage({ params }: { params: Promise<{ admissionId: string }> }) {
  const user = await requireAdmin("progress.view");
  const { admissionId } = await params;
  const a = await getAdmissionDetail(admissionId).catch(() => null);
  if (!a) notFound();
  const canUpdate = hasPermission(user, "progress.update");
  const p = a.progress;
  const s = a.student;

  return (
    <div>
      <PageHeader
        backHref="/admin/progress"
        mobileTitle={s.name}
        breadcrumbs={[{ label: "Student Progress", href: "/admin/progress" }, { label: s.name }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={s.name} src={s.photoUrl} size={56} />
            <span>
              {s.name}
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
                <span className="font-mono text-navy">{s.studentId ?? a.admissionNo}</span>
                <StatusBadge status={a.status} />
              </span>
            </span>
          </span>
        }
        description={`${a.course.name} · ${a.batch.name} (${a.batch.code}) · ${a.center.name}`}
        actions={
          <div className="grid w-full grid-cols-2 gap-2 *:w-full [&_button]:w-full sm:flex sm:w-auto sm:*:w-auto sm:[&_button]:w-auto">
            <ButtonLink href={`/admin/admissions/${a.id}`} variant="outline" size="sm">
              Admission record
            </ButtonLink>
            <ProgressRowActions admissionId={a.id} studentName={s.name} status={a.status} allowed={canUpdate} />
          </div>
        }
      />

      {/* The app bar shows only the student name on phones – keep the ID, status and avatar in the page. */}
      <div className="mb-4 flex items-center gap-3 lg:hidden">
        <Avatar name={s.name} src={s.photoUrl} size={44} />
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm font-semibold text-navy">{s.studentId ?? a.admissionNo}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
          </span>
        </span>
      </div>

      {!p ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Progress has not been computed for this admission yet. Use “Recompute” to calculate attendance, assessment and completion metrics.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <Card>
              <CardHeader title="Overview" description={`Last computed ${formatDateTime(p.updatedAt)}`} />
              <CardBody className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center gap-3">
                  <RingProgress value={p.completionPct} size={140} label="Course" />
                  {p.isCompleted ? <Badge tone="navy">Completed {formatDate(p.completedAt)}</Badge> : <Badge tone="info">In training</Badge>}
                </div>
                <div className="space-y-5">
                  <ProgressBar value={p.attendancePct} label={`Attendance – ${p.classesAttended} of ${p.classesHeld} classes held`} tone={p.attendancePct >= a.course.minAttendancePct ? "success" : "warning"} />
                  <ProgressBar value={p.assessmentAvgPct} label={p.assessmentAvgPct > 0 ? `Assessment average${p.finalMarksPct !== null ? ` (final exam ${p.finalMarksPct}%)` : ""}` : "Assessment average – no graded assessments yet"} tone={p.assessmentAvgPct === 0 ? "navy" : p.assessmentAvgPct >= a.course.passingMarksPct ? "success" : "warning"} />
                  <ProgressBar value={p.assignmentsTotal ? (p.assignmentsCompleted / p.assignmentsTotal) * 100 : 0} label={`Assignments – ${p.assignmentsCompleted} of ${p.assignmentsTotal} submitted`} tone="orange" />
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatsCard label="Classes planned" value={p.totalClasses || a.course.totalClasses || "—"} tone="navy" />
              <StatsCard label="Classes held" value={p.classesHeld} tone="info" />
              <StatsCard label="Present / late" value={`${a.attendance.present} / ${a.attendance.late}`} tone="success" />
              <StatsCard label="Absent / leave" value={`${a.attendance.absent} / ${a.attendance.leave}`} tone="warning" />
            </div>

            <Card>
              <CardHeader title="Course requirements" />
              <CardBody className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                <KeyValue label="Minimum attendance" value={`${a.course.minAttendancePct}%`} />
                <KeyValue label="Passing marks" value={`${a.course.passingMarksPct}%`} />
                <KeyValue label="Duration" value={a.course.durationText} />
                <KeyValue label="Batch" value={`${formatDate(a.batch.startDate)} – ${formatDate(a.batch.endDate)}`} />
                <KeyValue label="Batch status" value={<StatusBadge status={a.batch.status} />} />
                <KeyValue label="Trainer" value={(a.trainer ?? a.batch.trainer)?.user.name ?? "—"} />
                <KeyValue label="Admitted" value={formatDate(a.admittedAt)} />
                <KeyValue label="Completed" value={a.completedAt ? formatDate(a.completedAt) : "—"} />
              </CardBody>
            </Card>
          </div>

          <div className="order-first space-y-5 xl:order-none">
            <Card>
              <CardHeader title="Certificate eligibility" />
              <CardBody className="space-y-4">
                <EligibilityChecklist
                  progress={p}
                  admissionStatus={a.status}
                  batchStatus={a.batch.status}
                  minAttendancePct={a.course.minAttendancePct}
                  passingMarksPct={a.course.passingMarksPct}
                  certificate={a.certificate ? { id: a.certificate.id, certificateNo: a.certificate.certificateNo, status: a.certificate.status, issuedAt: a.certificate.issuedAt } : null}
                />
                {!a.certificate && p.certificateEligible && (
                  <Link href="/admin/certificates?tab=eligible" className="inline-flex text-sm font-semibold text-navy hover:underline">
                    Issue from the Certificates module →
                  </Link>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Links" />
              <CardBody className="divide-y divide-line/70 text-sm">
                {[
                  { href: `/admin/students/${s.id}`, label: "Student profile" },
                  { href: `/admin/applications/${a.applicationId}`, label: `Application ${a.application.applicationNo}` },
                  { href: `/admin/attendance?tab=student&studentId=${s.id}`, label: "Attendance record" },
                  { href: `/admin/attendance?tab=reports&centerId=${a.centerId}&batchId=${a.batchId}`, label: "Batch attendance report" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="flex min-h-12 items-center font-semibold text-navy tap-highlight-none hover:underline sm:min-h-0 sm:py-1.5">
                    {l.label}
                  </Link>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
