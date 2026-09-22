import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";
import { getAdmissionDetail, getAdminLookups } from "@/server/admissions";
import { formatSchedule } from "@/server/batches";
import { PageHeader, Avatar, KeyValue, Timeline } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { ProgressBar, RingProgress } from "@/components/ui/stats";
import { AdmissionActions } from "@/components/admin/admissions/admission-actions";
import { EligibilityChecklist } from "@/components/admin/progress/eligibility-checklist";
import { withBasePath } from "@/lib/base-path";
import { RecordIdentity } from "@/components/admin/locations/list-kit";

export const metadata = { title: "Admission" };

export default async function AdmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("admissions.view");
  const { id } = await params;
  const a = await getAdmissionDetail(id).catch(() => null);
  if (!a) notFound();
  const lookups = await getAdminLookups();
  const can = { update: hasPermission(user, "admissions.update"), progress: hasPermission(user, "progress.update"), issue: hasPermission(user, "certificates.issue") };
  const s = a.student;
  const app = a.application;
  const due = Math.max(0, app.payableAmount - app.paidAmount);
  const location = [s.villageTown, s.block?.name, s.district?.name, s.state?.name].filter(Boolean).join(", ");
  const p = a.progress;
  const effectiveTrainer = a.trainer ?? a.batch.trainer;

  return (
    <div>
      {/* Identity and status first on phones, where the app bar only has room for a code. */}
      <RecordIdentity
        lead={<Avatar name={s.name} src={s.photoUrl} size={48} />}
        title={s.name}
        meta={<span className="font-mono font-semibold text-navy">{a.admissionNo}</span>}
        badges={
          <>
            <StatusBadge status={a.status} />
            {p?.certificateEligible && !a.certificate && <Badge tone="navy">Certificate eligible</Badge>}
            {a.certificate && <Badge tone="success">Certified</Badge>}
          </>
        }
      />
      <PageHeader
        backHref="/admin/admissions"
        mobileTitle={a.admissionNo}
        breadcrumbs={[{ label: "Admissions", href: "/admin/admissions" }, { label: a.admissionNo }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{a.admissionNo}</span>
            <StatusBadge status={a.status} className="text-body-sm" />
          </span>
        }
        description={`${s.name} · ${a.course.name} · ${a.center.name} · admitted ${formatDate(a.admittedAt)}${a.approvedByName ? ` by ${a.approvedByName}` : ""}`}
        actions={
          <AdmissionActions
            admissionId={a.id}
            admissionNo={a.admissionNo}
            studentName={s.name}
            status={a.status}
            currentBatchId={a.batchId}
            trainerId={a.trainerId}
            trainers={lookups.trainers}
            certificateEligible={!!p?.certificateEligible}
            certificate={a.certificate ? { id: a.certificate.id, certificateNo: a.certificate.certificateNo } : null}
            can={can}
          />
        }
      />


      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Student" />
            <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={s.name} src={s.photoUrl} size={64} />
              <div className="min-w-0 flex-1">
                <p className="text-h3 text-navy">
                  <Link href={`/admin/students/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted">
                  <span className="font-mono text-navy">{s.studentId ?? "No Student ID"}</span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {s.mobile}
                  </span>
                  {location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {location}
                    </span>
                  )}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                  <KeyValue label="Email" value={s.user.email ?? s.email ?? "—"} />
                  <KeyValue label="Guardian" value={s.guardianName ?? "—"} />
                  <KeyValue label="Qualification" value={s.qualification ?? "—"} />
                  <KeyValue label="Account" value={<StatusBadge status={s.user.status} />} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Course, center, batch & trainer" />
            <CardBody className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-caption font-medium tracking-wide text-muted uppercase">Course</p>
                <p className="font-semibold text-ink">{a.course.name}</p>
                <p className="text-caption text-muted">
                  {a.course.code} · {a.course.durationText}
                </p>
                <p className="text-caption text-muted">
                  Min attendance {a.course.minAttendancePct}% · Passing {a.course.passingMarksPct}%
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-caption font-medium tracking-wide text-muted uppercase">Center</p>
                <p className="font-semibold text-ink">{a.center.name}</p>
                <p className="text-caption text-muted">{a.center.code}</p>
                <p className="text-caption text-muted">{[a.center.block?.name, a.center.district?.name, a.center.state?.name].filter(Boolean).join(", ")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-caption font-medium tracking-wide text-muted uppercase">Batch</p>
                <p className="font-semibold text-ink">{a.batch.name}</p>
                <p className="text-caption text-muted">
                  {a.batch.code} · <StatusBadge status={a.batch.status} />
                </p>
                <p className="text-caption text-muted">
                  {formatDate(a.batch.startDate)} – {formatDate(a.batch.endDate)}
                </p>
                <p className="text-caption text-muted">{formatSchedule(a.batch)}{a.batch.room ? ` · ${a.batch.room}` : ""}</p>
              </div>
              <div className="space-y-1">
                <p className="text-caption font-medium tracking-wide text-muted uppercase">Trainer</p>
                {effectiveTrainer ? (
                  <>
                    <p className="font-semibold text-ink">{effectiveTrainer.user.name}</p>
                    <p className="text-caption text-muted">
                      {effectiveTrainer.trainerId} · {titleCase(effectiveTrainer.level)} level
                    </p>
                    {a.trainer && a.trainer.id !== a.batch.trainerId && <Badge tone="info">Overrides batch trainer</Badge>}
                  </>
                ) : (
                  <p className="text-body-sm text-warning-dark">No trainer assigned</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Progress" description={p ? `Last updated ${formatDateTime(p.updatedAt)}` : "Not computed yet"} />
            <CardBody>
              {p ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
                  <div className="flex flex-col items-center gap-2">
                    <RingProgress value={p.completionPct} size={120} label="Complete" />
                    {p.isCompleted ? <Badge tone="navy">Completed {formatDate(p.completedAt)}</Badge> : <Badge>In training</Badge>}
                  </div>
                  <div className="space-y-4">
                    <ProgressBar value={p.attendancePct} label={`Attendance – ${p.classesAttended} of ${p.classesHeld} classes held${p.totalClasses ? ` (${p.totalClasses} planned)` : ""}`} tone={p.attendancePct >= a.course.minAttendancePct ? "success" : "warning"} />
                    <ProgressBar value={p.assessmentAvgPct} label={`Assessment average${p.finalMarksPct !== null ? ` · final ${p.finalMarksPct}%` : ""}`} tone={p.assessmentAvgPct >= a.course.passingMarksPct ? "success" : p.assessmentAvgPct === 0 ? "navy" : "warning"} />
                    <ProgressBar value={p.assignmentsTotal ? (p.assignmentsCompleted / p.assignmentsTotal) * 100 : 0} label={`Assignments – ${p.assignmentsCompleted} of ${p.assignmentsTotal} submitted`} tone="navy" />
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
                      {[
                        { label: "Held", value: a.attendance.held, cls: "text-ink" },
                        { label: "Present", value: a.attendance.present, cls: "text-success-dark" },
                        { label: "Late", value: a.attendance.late, cls: "text-warning-dark" },
                        { label: "Absent", value: a.attendance.absent, cls: "text-danger" },
                        { label: "Leave", value: a.attendance.leave, cls: "text-info-dark" },
                      ].map((x) => (
                        <div key={x.label} className="rounded-md bg-surface p-3 text-center">
                          <p className={`text-h3 tabular-nums ${x.cls}`}>{x.value}</p>
                          <p className="text-caption font-medium text-muted uppercase">{x.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-body-sm text-muted">Use “Recompute progress” to compute attendance and assessment metrics.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Fee & payments" description={app.originalFee === 0 ? "Free course" : `${formatINR(app.paidAmount)} received of ${formatINR(app.payableAmount)} payable${due > 0 ? ` · ${formatINR(due)} due` : ""}`} action={<Link href={`/admin/applications/${app.id}`} className="text-body-sm font-semibold text-navy hover:underline">Application {app.applicationNo}</Link>} />
            <TableWrap className="rounded-none border-0">
              <THead>
                <tr>
                  <TH>Payment</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Method</TH>
                  <TH>Status</TH>
                  <TH>Date</TH>
                  <TH>Document</TH>
                </tr>
              </THead>
              <TBody>
                {app.payments.length === 0 && <EmptyRow colSpan={6}>No payments recorded.</EmptyRow>}
                {app.payments.map((pm) => (
                  <TR key={pm.id}>
                    <TD primary>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <Link href={`/admin/payments/${pm.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                            {pm.paymentNo}
                          </Link>
                          {pm.receiptNo && <span className="block text-caption font-normal text-muted">Receipt {pm.receiptNo}</span>}
                        </span>
                        <span className="shrink-0 text-right md:hidden">
                          <span className="block tabular-nums">{formatINR(pm.amount)}</span>
                          <StatusBadge status={pm.status} className="mt-1" />
                        </span>
                      </span>
                    </TD>
                    <TD mobile="hidden" className="text-right tabular-nums">
                      {formatINR(pm.amount)}
                    </TD>
                    <TD label="Method">{titleCase(pm.method)}</TD>
                    <TD mobile="hidden">
                      <StatusBadge status={pm.status} />
                    </TD>
                    <TD label="Date" className="text-muted md:whitespace-nowrap">
                      {formatDateTime(pm.paidAt ?? pm.createdAt)}
                    </TD>
                    <TD actions>
                      <a
                        href={withBasePath(`/api/admin/payments/${pm.id}/document`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center text-caption font-semibold text-orange hover:underline md:min-h-0"
                      >
                        {pm.status === "COMPLETED" ? "Receipt" : "Invoice"}
                      </a>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </Card>
        </div>

        {/* Eligibility and the workflow actions lead on phones. */}
        <div className="order-first space-y-6 xl:order-none">
          <Card>
            <CardHeader title="Certificate eligibility" />
            <CardBody>
              <EligibilityChecklist
                progress={p}
                admissionStatus={a.status}
                batchStatus={a.batch.status}
                minAttendancePct={a.course.minAttendancePct}
                passingMarksPct={a.course.passingMarksPct}
                certificate={a.certificate ? { id: a.certificate.id, certificateNo: a.certificate.certificateNo, status: a.certificate.status, issuedAt: a.certificate.issuedAt } : null}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-3">
              <KeyValue label="Admitted" value={formatDateTime(a.admittedAt)} />
              <KeyValue label="Approved by" value={a.approvedByName ?? "System"} />
              <KeyValue label="Completed" value={a.completedAt ? formatDateTime(a.completedAt) : "—"} />
              {app.scholarshipAward && <KeyValue label="Scholarship" value={`${titleCase(app.scholarshipAward.status)} · ${formatINR(app.scholarshipAward.scholarshipAmount)}${app.scholarshipAward.program ? ` · ${app.scholarshipAward.program.name}` : ""}`} />}
              {a.notes && <KeyValue label="Notes" value={<span className="whitespace-pre-line">{a.notes}</span>} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Application history" />
            <CardBody>
              <Timeline
                items={[...app.statusHistory].reverse().map((h) => ({
                  title: `${h.fromStatus ? `${titleCase(h.fromStatus)} → ` : ""}${titleCase(h.toStatus)}`,
                  description: `${h.changedById ? (a.actors[h.changedById] ?? "Staff") : "System"}${h.note ? ` · ${h.note}` : ""}`,
                  meta: formatDateTime(h.createdAt),
                  tone: ["REJECTED", "CANCELLED"].includes(h.toStatus) ? "danger" : ["ADMISSION_CONFIRMED", "COMPLETED", "APPROVED", "PAYMENT_COMPLETED"].includes(h.toStatus) ? "success" : "navy",
                }))}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
