import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Award, CreditCard, Download } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api/errors";
import { getApplicationDetail } from "@/server/applications";
import { formatSchedule } from "@/server/batches";
import { formatDate, formatDateTime, formatINR, isUuid, titleCase } from "@/lib/utils";
import { PageHeader, Timeline, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { canPayNow, CANCELLABLE_STATUSES, dueAmount, HISTORY_TONES, statusMessage } from "@/components/student/application-status";
import { ApplicationActions } from "@/components/student/application-actions";
import { DocumentsChecklist, type ChecklistDoc } from "@/components/student/documents-checklist";
import { ApplicationTracker } from "@/components/student/mobile";

export const metadata: Metadata = { title: "Application" };

export default async function StudentApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  let app: Awaited<ReturnType<typeof getApplicationDetail>>;
  try {
    app = await getApplicationDetail(id, { studentId: user.student.id });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const due = dueAmount(app);
  const msg = statusMessage({ ...app, missingDocuments: app.missingDocuments });
  const payNow = canPayNow(app);
  const canCancel = CANCELLABLE_STATUSES.includes(app.status);
  const docsEditable = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "WAITLISTED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"].includes(app.status);

  // Latest document per type (student-wide, since documents belong to the student).
  const latestByType = new Map<string, ChecklistDoc>();
  for (const d of app.studentDocuments) {
    if (!latestByType.has(d.type)) latestByType.set(d.type, { id: d.id, type: d.type, name: d.name, url: d.url, status: d.status, remarks: d.remarks, createdAt: d.createdAt.toISOString() });
  }
  const requiredKeys = new Set(app.requiredDocuments.map((r) => r.key));
  const otherDocs = [...latestByType.values()].filter((d) => !requiredKeys.has(d.type));

  const timeline = app.statusHistory.map((h) => ({
    title: titleCase(h.toStatus),
    description: h.note ?? undefined,
    meta: formatDateTime(h.createdAt),
    tone: HISTORY_TONES[h.toStatus] ?? "navy",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "My Applications", href: "/student/applications" }, { label: app.applicationNo }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{app.applicationNo}</span>
            <StatusBadge status={app.status} className="text-sm" />
          </span>
        }
        description={`${app.course.name} at ${app.center.name} · Applied ${formatDate(app.createdAt)}`}
        actions={payNow ? <ButtonLink href={`/student/payments/${app.id}`} leftIcon={<CreditCard className="h-4 w-4" />}>Pay {formatINR(due)}</ButtonLink> : undefined}
        mobileTitle={app.applicationNo}
        backHref="/student/applications"
      />

      <ApplicationTracker application={app} />

      <Alert tone={msg.tone} title={msg.title}>
        {msg.body}
      </Alert>

      {payNow && (
        <ButtonLink href={`/student/payments/${app.id}`} fullWidth className="lg:hidden" leftIcon={<CreditCard className="h-4 w-4" />}>
          Pay {formatINR(due)}
        </ButtonLink>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Course / center / batch */}
          <Card>
            <CardHeader title="Course, center & batch" />
            <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <KeyValue label="Course" value={<span>{app.course.name} <span className="text-xs text-muted">({app.course.durationText}, {titleCase(app.course.mode)})</span></span>} />
              <KeyValue label="Training center" value={<span>{app.center.name} <span className="font-mono text-xs text-muted">({app.center.code})</span><br /><span className="text-xs font-normal text-muted">{app.center.address}, {app.center.district.name}, {app.center.state.name} – {app.center.pincode}{app.center.phone ? ` · ${app.center.phone}` : ""}</span></span>} />
              <KeyValue label="Batch" value={app.batch ? <span>{app.batch.name} <span className="font-mono text-xs text-muted">({app.batch.code})</span><br /><span className="text-xs font-normal text-muted">{formatSchedule(app.batch)} · {formatDate(app.batch.startDate)} – {formatDate(app.batch.endDate)}{app.batch.room ? ` · Room ${app.batch.room}` : ""}</span></span> : <span className="text-muted">To be allocated by the Foundation</span>} />
              <KeyValue label="Submitted on" value={app.submittedAt ? formatDateTime(app.submittedAt) : "Not submitted yet"} />
            </CardBody>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader title="Documents" description={app.missingDocuments.length ? `${app.missingDocuments.length} required document${app.missingDocuments.length === 1 ? "" : "s"} missing` : "All required documents uploaded"} action={<Link href="/student/documents" className="text-sm font-semibold text-orange hover:underline">Manage all documents</Link>} />
            <CardBody>
              {app.status === "DOCUMENTS_REQUIRED" && app.documentsRequestNote && (
                <Alert tone="warning" className="mb-4" title="Requested by the Foundation">
                  {app.documentsRequestNote}
                </Alert>
              )}
              <DocumentsChecklist applicationId={app.id} required={app.requiredDocuments.map((r) => ({ key: r.key, name: r.name, description: r.description }))} uploaded={Object.fromEntries(latestByType)} other={otherDocs} editable={docsEditable} />
            </CardBody>
          </Card>

          {/* Admission */}
          {app.admission && (
            <Card>
              <CardHeader title="Admission" description="Your seat is confirmed" action={<StatusBadge status={app.admission.status} />} />
              <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <KeyValue label="Admission number" value={<span className="font-mono">{app.admission.admissionNo}</span>} />
                <KeyValue label="Student ID" value={app.student.studentId ? <span className="font-mono">{app.student.studentId}</span> : "Being issued"} />
                <KeyValue label="Batch" value={app.batch ? `${app.batch.name} · ${formatSchedule(app.batch)}` : "—"} />
                <KeyValue label="Admitted on" value={formatDate(app.admission.admittedAt)} />
                {app.admission.certificate && (
                  <div className="sm:col-span-2">
                    <Alert tone="success" title={`Certificate ${app.admission.certificate.certificateNo}`} action={<ButtonLink href={`/api/student/certificates/${app.admission.certificate.id}/download`} size="sm" variant="navy" leftIcon={<Download className="h-4 w-4" />}>Download</ButtonLink>}>
                      Issued {formatDate(app.admission.certificate.issuedAt)} · <Link href="/student/certificates" className="font-semibold underline">View certificates</Link>
                    </Alert>
                  </div>
                )}
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <ButtonLink href="/student/timetable" variant="outline" size="sm">Timetable</ButtonLink>
                  <ButtonLink href="/student/progress" variant="outline" size="sm" leftIcon={<Award className="h-4 w-4" />}>Progress</ButtonLink>
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Fees */}
          <Card>
            <CardHeader title="Fees" action={app.installmentsAllowed ? <span className="text-xs font-semibold text-green-700">Installments allowed</span> : undefined} />
            <CardBody className="space-y-2 text-sm">
              {app.fees.map((f) => (
                <div key={f.id} className="flex justify-between text-muted">
                  <span>{f.description}</span>
                  <span className="tabular-nums">{formatINR(f.amount)}</span>
                </div>
              ))}
              <FeeRow label="Original fee" value={app.originalFee} strong />
              {app.scholarshipAmount > 0 && <FeeRow label="Scholarship" value={-app.scholarshipAmount} tone="success" />}
              {app.discountAmount > 0 && <FeeRow label="Discount" value={-app.discountAmount} tone="success" />}
              <FeeRow label="Payable" value={app.payableAmount} strong />
              <FeeRow label="Paid" value={app.paidAmount} tone="success" />
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-navy">
                <span>Due</span>
                <span className="tabular-nums">{formatINR(due)}</span>
              </div>
              {app.installments.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-lg bg-surface p-3 text-xs">
                  {app.installments.map((i) => (
                    <li key={i.id} className="flex justify-between">
                      <span>
                        Installment {i.installmentNo} · due {formatDate(i.dueDate)}
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {formatINR(i.amount)} <StatusBadge status={i.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {payNow && (
                <ButtonLink href={`/student/payments/${app.id}`} fullWidth className="mt-3" leftIcon={<CreditCard className="h-4 w-4" />}>
                  Pay now
                </ButtonLink>
              )}
              {app.payments.length > 0 && (
                <p className="pt-1 text-xs text-muted">
                  {app.payments.length} payment{app.payments.length === 1 ? "" : "s"} · <Link href="/student/payments" className="font-semibold text-orange hover:underline">View history & receipts</Link>
                </p>
              )}
            </CardBody>
          </Card>

          {/* Scholarship */}
          {(app.scholarshipRequested || app.scholarshipAward) && (
            <Card>
              <CardHeader title="Scholarship" action={app.scholarshipAward ? <StatusBadge status={app.scholarshipAward.status} /> : <StatusBadge status="PENDING" />} />
              <CardBody className="space-y-2 text-sm">
                {app.scholarshipAward ? (
                  <>
                    <p>
                      {app.scholarshipAward.status === "APPROVED" ? "Scholarship approved" : app.scholarshipAward.status === "REJECTED" ? "Scholarship not approved" : "Scholarship under consideration"}
                      {app.scholarshipAward.program ? ` · ${app.scholarshipAward.program.name}` : ""}
                    </p>
                    <div className="flex justify-between text-muted">
                      <span>Amount</span>
                      <span className="font-semibold text-ink tabular-nums">{formatINR(app.scholarshipAward.scholarshipAmount)}</span>
                    </div>
                    {app.scholarshipAward.remarks && <p className="text-xs text-muted">Remarks: {app.scholarshipAward.remarks}</p>}
                  </>
                ) : (
                  <p className="text-muted">You requested scholarship support. The Foundation will decide during review and update the payable fee.</p>
                )}
                {app.scholarshipReason && <p className="text-xs text-muted">Your reason: “{app.scholarshipReason}”</p>}
              </CardBody>
            </Card>
          )}

          {/* Actions */}
          <ApplicationActions applicationId={app.id} status={app.status} missingCount={app.missingDocuments.length} canCancel={canCancel} />

          {/* Timeline */}
          <Card>
            <CardHeader title="Status history" />
            <CardBody>{timeline.length ? <Timeline items={timeline} /> : <p className="text-sm text-muted">No updates yet.</p>}</CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeeRow({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: "success" }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-ink" : tone === "success" ? "text-green-700" : "text-ink"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value < 0 ? `− ${formatINR(-value)}` : formatINR(value)}</span>
    </div>
  );
}
