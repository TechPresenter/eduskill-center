import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, FileText, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { calcAge, formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";
import { getApplicationDetail } from "@/server/applications";
import { getAdminLookups } from "@/server/admissions";
import { DECIDABLE_STATUSES } from "@/server/scholarship-programs";
import { formatSchedule } from "@/server/batches";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Avatar, KeyValue, Timeline } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { DocumentActions } from "@/components/admin/students/document-actions";
import { StatusActions } from "@/components/admin/applications/status-actions";
import { ChangeBatchButton, ChangeCourseCenterButton } from "@/components/admin/applications/course-batch-actions";
import { DiscountButton, InstallmentPlanButton, InstallmentsToggle } from "@/components/admin/applications/fee-actions";
import { ScholarshipPanel } from "@/components/admin/applications/scholarship-panel";

export const metadata = { title: "Application" };

const PRE_APPROVAL = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "WAITLISTED"];
const BATCH_CHANGEABLE = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "WAITLISTED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"];
const FEE_EDITABLE = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "WAITLISTED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED"];
const PAYABLE = ["APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED"];

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("applications.view");
  const { id } = await params;
  const app = await getApplicationDetail(id).catch(() => null);
  if (!app) notFound();

  const can = {
    update: hasPermission(user, "applications.update"),
    approve: hasPermission(user, "applications.approve"),
    reject: hasPermission(user, "applications.reject"),
    confirm: hasPermission(user, "admissions.approve"),
    pay: hasPermission(user, "payments.create"),
    scholarship: hasPermission(user, "scholarships.approve"),
  };

  const actorIds = [
    ...new Set(
      [...app.statusHistory.map((h) => h.changedById), app.reviewedById, app.scholarshipAward?.approvedById ?? null, ...app.studentDocuments.map((d) => d.verifiedById)].filter((x): x is string => !!x)
    ),
  ];
  const [lookups, actors, notifications, docTypes, studentLocation] = await Promise.all([
    getAdminLookups(),
    actorIds.length ? db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } }) : Promise.resolve([]),
    db.notification.findMany({ where: { userId: app.student.user.id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, channel: true, title: true, status: true, createdAt: true, sentAt: true, readAt: true, templateKey: true } }),
    db.documentType.findMany({ where: { appliesTo: "STUDENT" }, select: { key: true, name: true } }),
    db.student.findUnique({ where: { id: app.studentId }, select: { state: { select: { name: true } }, district: { select: { name: true } }, block: { select: { name: true } } } }),
  ]);
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const docName = new Map(docTypes.map((d) => [d.key, d.name]));

  const s = app.student;
  const due = Math.max(0, app.payableAmount - app.paidAmount);
  const age = calcAge(s.dob);
  const location = [s.villageTown, studentLocation?.block?.name, studentLocation?.district?.name, studentLocation?.state?.name].filter(Boolean).join(", ");
  const batchLabel = app.batch ? `${app.batch.name} (${app.batch.code})` : null;
  const missingNames = app.missingDocuments.map((m) => m.name);
  const requiredKeys = new Set(app.requiredDocuments.map((r) => r.key));
  const latestByType = new Map<string, (typeof app.studentDocuments)[number]>();
  for (const d of app.studentDocuments) if (!latestByType.has(d.type)) latestByType.set(d.type, d);
  const otherDocs = app.studentDocuments.filter((d) => !requiredKeys.has(d.type));
  const decidable = (DECIDABLE_STATUSES as string[]).includes(app.status) && app.originalFee > 0;
  const centerLocation = [app.center.block?.name, app.center.district?.name, app.center.state?.name].filter(Boolean).join(", ");

  const historyTone = (to: string): "orange" | "navy" | "success" | "danger" | "neutral" => {
    if (["REJECTED", "CANCELLED"].includes(to)) return "danger";
    if (["APPROVED", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "COMPLETED"].includes(to)) return "success";
    if (["DOCUMENTS_REQUIRED", "WAITLISTED", "PAYMENT_PENDING"].includes(to)) return "orange";
    if (to === "DRAFT") return "neutral";
    return "navy";
  };

  const docRow = (d: (typeof app.studentDocuments)[number]) => (
    <TR key={d.id}>
      <TD primary className="font-medium">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            {docName.get(d.type) ?? titleCase(d.type)}
            {requiredKeys.has(d.type) && <Badge className="ml-2">Required</Badge>}
          </span>
          <span className="shrink-0 md:hidden">
            <StatusBadge status={d.status} />
          </span>
        </span>
      </TD>
      <TD label="File">
        <span className="block truncate text-xs text-muted md:max-w-56">{d.name}</span>
        <span className="text-[11px] text-muted">{formatDate(d.createdAt)}</span>
      </TD>
      <TD label="Verified">
        <span className="hidden md:inline">
          <StatusBadge status={d.status} />
        </span>
        {d.verifiedById && (
          <span className="block text-[11px] text-muted">
            {actorName.get(d.verifiedById) ?? "Staff"} · {formatDate(d.verifiedAt)}
          </span>
        )}
        {d.remarks && <span className="block text-[11px] text-muted md:max-w-56">{d.remarks}</span>}
        {!d.verifiedById && !d.remarks && <span className="text-[11px] text-muted md:hidden">Not verified yet</span>}
      </TD>
      <TD actions>
        <DocumentActions endpoint={`/api/admin/applications/${app.id}/documents/${d.id}`} url={d.url} name={d.name} status={d.status} canDecide={can.update} />
      </TD>
    </TR>
  );

  return (
    <div>
      <PageHeader
        backHref="/admin/applications"
        mobileTitle={app.applicationNo}
        breadcrumbs={[{ label: "Applications", href: "/admin/applications" }, { label: app.applicationNo }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{app.applicationNo}</span>
            <StatusBadge status={app.status} className="text-sm" />
            {app.waitlistPosition && app.status === "WAITLISTED" && <Badge tone="warning">Waitlist #{app.waitlistPosition}</Badge>}
          </span>
        }
        description={`${s.name} · ${app.course.name} · ${app.center.name} · submitted ${formatDate(app.submittedAt ?? app.createdAt)}`}
        actions={
          <>
            <ButtonLink href={`/admin/students/${s.id}`} variant="outline" size="sm">
              View student
            </ButtonLink>
            {app.admission && (
              <ButtonLink href={`/admin/admissions/${app.admission.id}`} variant="navy" size="sm">
                Admission {app.admission.admissionNo}
              </ButtonLink>
            )}
          </>
        }
      />

      {/* The app bar shows only the application number on phones – keep the status visible in the page. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
        <StatusBadge status={app.status} />
        {app.waitlistPosition && app.status === "WAITLISTED" && <Badge tone="warning">Waitlist #{app.waitlistPosition}</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Applicant" />
            <CardBody>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar name={s.name} src={s.photoUrl} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-navy">
                    <Link href={`/admin/students/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    {s.studentId ? <span className="font-mono text-navy">{s.studentId}</span> : <Badge tone="warning">No Student ID yet</Badge>}
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
                    <KeyValue label="Date of birth" value={s.dob ? `${formatDate(s.dob)}${age !== null ? ` (${age} yrs)` : ""}` : "—"} />
                    <KeyValue label="Gender" value={titleCase(s.gender) || "—"} />
                    <KeyValue label="Guardian" value={s.guardianName ? `${s.guardianName}${s.guardianRelation ? ` (${s.guardianRelation})` : ""}` : "—"} />
                    <KeyValue label="Qualification" value={s.qualification ?? "—"} />
                    <KeyValue label="Family income" value={s.familyIncome ?? "—"} />
                    <KeyValue label="Area" value={titleCase(s.areaType) || "—"} />
                    <KeyValue label="Profile" value={s.profileCompleted ? <Badge tone="success">Complete</Badge> : <Badge tone="warning">Incomplete</Badge>} />
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Course, center & batch"
              action={
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <ChangeCourseCenterButton applicationId={app.id} centerId={app.centerId} courseId={app.courseId} centers={lookups.centers} courses={lookups.courses} allowed={can.update && PRE_APPROVAL.includes(app.status)} reason={!can.update ? "You do not have permission to edit applications" : "Center or course can only be changed before approval"} />
                  <ChangeBatchButton applicationId={app.id} currentBatchId={app.batchId} allowed={can.update && BATCH_CHANGEABLE.includes(app.status)} reason={!can.update ? "You do not have permission to edit applications" : app.admission ? "Change the batch from the admission record" : "Batch cannot be changed in this status"} />
                </div>
              }
            />
            <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Course</p>
                <p className="font-semibold text-ink">{app.course.name}</p>
                <p className="text-xs text-muted">
                  {app.course.code} · {app.course.durationText} · {titleCase(app.course.level)} · {titleCase(app.course.mode)}
                </p>
                <p className="text-xs text-muted">
                  Min attendance {app.course.minAttendancePct}% · Passing {app.course.passingMarksPct}%
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Training center</p>
                <p className="font-semibold text-ink">{app.center.name}</p>
                <p className="text-xs text-muted">
                  {app.center.code} · <StatusBadge status={app.center.status} />
                </p>
                <p className="text-xs text-muted">{centerLocation}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Batch</p>
                {app.batch ? (
                  <>
                    <p className="font-semibold text-ink">{app.batch.name}</p>
                    <p className="text-xs text-muted">
                      {app.batch.code} · <StatusBadge status={app.batch.status} />
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(app.batch.startDate)} – {formatDate(app.batch.endDate)}
                    </p>
                    <p className="text-xs text-muted">{formatSchedule(app.batch)}</p>
                  </>
                ) : (
                  <p className="text-sm text-amber-700">Not allocated yet – required before admission is confirmed.</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" description={`${app.requiredDocuments.length} required for this course · ${app.studentDocuments.length} uploaded by the student`} />
            {app.requiredDocuments.length === 0 && app.studentDocuments.length === 0 ? (
              <CardBody>
                <EmptyState icon={<FileText className="h-7 w-7" />} title="No documents" description="This course does not require documents and the student has not uploaded any." className="py-8" />
              </CardBody>
            ) : (
              <TableWrap className="rounded-none border-0">
                <THead>
                  <tr>
                    <TH>Document</TH>
                    <TH>File</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {app.requiredDocuments.map((r) => {
                    const d = latestByType.get(r.key);
                    if (d && d.status !== "REJECTED") return docRow(d);
                    return (
                      <TR key={r.key} className="bg-warning-light/40">
                        <TD primary className="font-medium">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              {r.name} <Badge className="ml-2">Required</Badge>
                            </span>
                            <span className="shrink-0 md:hidden">
                              <Badge tone="danger">Missing</Badge>
                            </span>
                          </span>
                        </TD>
                        <TD label="File" className="text-xs text-muted">
                          {d ? `Rejected upload: ${d.name}` : "Not uploaded"}
                        </TD>
                        <TD label="Verified">
                          <span className="hidden md:inline">
                            <Badge tone="danger">Missing</Badge>
                          </span>
                          {d?.remarks && <span className="block text-[11px] text-muted md:max-w-56">{d.remarks}</span>}
                        </TD>
                        <TD actions>{d ? <DocumentActions endpoint={`/api/admin/applications/${app.id}/documents/${d.id}`} url={d.url} name={d.name} status={d.status} canDecide={can.update} /> : <span className="text-xs text-muted">Ask the student to upload</span>}</TD>
                      </TR>
                    );
                  })}
                  {otherDocs.map(docRow)}
                </TBody>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Fee"
              description={app.originalFee === 0 ? "This course is free of charge." : `${formatINR(app.paidAmount)} received of ${formatINR(app.payableAmount)} payable`}
              action={<DiscountButton applicationId={app.id} originalFee={app.originalFee} scholarshipAmount={app.scholarshipAmount} discountAmount={app.discountAmount} allowed={can.update && FEE_EDITABLE.includes(app.status) && app.originalFee > 0} reason={!can.update ? "You do not have permission to edit applications" : "Discount cannot be changed after admission"} />}
            />
            <CardBody className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Original", value: app.originalFee, cls: "text-ink" },
                  { label: "Scholarship", value: -app.scholarshipAmount, cls: "text-green-700" },
                  { label: "Discount", value: -app.discountAmount, cls: "text-green-700" },
                  { label: "Payable", value: app.payableAmount, cls: "text-navy" },
                  { label: "Paid", value: app.paidAmount, cls: "text-green-700" },
                  { label: "Due", value: due, cls: due > 0 ? "text-amber-700" : "text-green-700" },
                ].map((x) => (
                  <div key={x.label} className="rounded-xl bg-surface p-3">
                    <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{x.label}</p>
                    <p className={`mt-0.5 text-base font-bold tabular-nums ${x.cls}`}>{x.value < 0 ? `− ${formatINR(-x.value)}` : formatINR(x.value)}</p>
                  </div>
                ))}
              </div>
              {app.fees.length > 0 && (
                <p className="text-xs text-muted">
                  Fee lines: {app.fees.map((f) => `${f.description} ${formatINR(f.amount)}`).join(" · ")}
                </p>
              )}

              <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-start sm:justify-between [&>*]:min-w-0">
                <InstallmentsToggle applicationId={app.id} value={app.installmentsAllowed} allowed={can.update && FEE_EDITABLE.includes(app.status) && app.originalFee > 0} />
                <InstallmentPlanButton applicationId={app.id} due={due} existing={app.installments} allowed={can.pay && PAYABLE.includes(app.status)} />
              </div>
              {app.installments.length > 0 && (
                <TableWrap>
                  <THead>
                    <tr>
                      <TH>#</TH>
                      <TH className="text-right">Amount</TH>
                      <TH>Due date</TH>
                      <TH>Status</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {app.installments.map((i) => (
                      <TR key={i.id}>
                        <TD primary>
                          <span className="flex items-center justify-between gap-2">
                            <span>
                              <span className="md:hidden">Installment </span>
                              {i.installmentNo}
                            </span>
                            <span className="md:hidden">
                              <StatusBadge status={i.status === "PENDING" && new Date(i.dueDate) < new Date() ? "OVERDUE" : i.status} />
                            </span>
                          </span>
                        </TD>
                        <TD label="Amount" className="text-right tabular-nums">
                          {formatINR(i.amount)}
                        </TD>
                        <TD label="Due date" className="md:whitespace-nowrap">
                          {formatDate(i.dueDate)}
                        </TD>
                        <TD mobile="hidden">
                          <StatusBadge status={i.status === "PENDING" && new Date(i.dueDate) < new Date() ? "OVERDUE" : i.status} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
              )}

              <div>
                <p className="mb-2 text-sm font-semibold text-navy">Payments</p>
                <TableWrap>
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
                    {app.payments.length === 0 && <EmptyRow colSpan={6}>No payments yet.</EmptyRow>}
                    {app.payments.map((pm) => (
                      <TR key={pm.id}>
                        <TD primary>
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <Link href={`/admin/payments/${pm.id}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                                {pm.paymentNo}
                              </Link>
                              {pm.receiptNo && <span className="block text-[11px] font-normal text-muted">Receipt {pm.receiptNo}</span>}
                              {pm.referenceNo && <span className="block text-[11px] font-normal text-muted">Ref {pm.referenceNo}</span>}
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
                            href={`/api/admin/payments/${pm.id}/document`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center text-xs font-semibold text-orange hover:underline md:min-h-0"
                          >
                            {pm.status === "COMPLETED" ? "Receipt" : "Invoice"}
                          </a>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Timeline" description="Every status change with who made it." />
            <CardBody>
              {app.statusHistory.length === 0 ? (
                <p className="text-sm text-muted">No history recorded.</p>
              ) : (
                <Timeline
                  items={[...app.statusHistory].reverse().map((h) => ({
                    title: (
                      <span>
                        {h.fromStatus ? `${titleCase(h.fromStatus)} → ` : ""}
                        {titleCase(h.toStatus)}
                      </span>
                    ),
                    description: (
                      <span>
                        {h.changedById ? (actorName.get(h.changedById) ?? "Staff") : "System"}
                        {h.note ? ` · ${h.note}` : ""}
                      </span>
                    ),
                    meta: formatDateTime(h.createdAt),
                    tone: historyTone(h.toStatus),
                  }))}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Workflow actions lead on phones instead of sitting ~2000px below the fold. */}
        <div className="order-first space-y-5 xl:order-none">
          <Card>
            <CardHeader title="Status & actions" description={app.reviewedById ? `Last handled by ${actorName.get(app.reviewedById) ?? "staff"}` : undefined} />
            <CardBody>
              <StatusActions
                applicationId={app.id}
                applicationNo={app.applicationNo}
                status={app.status}
                allowedTransitions={app.allowedTransitions}
                payableAmount={app.payableAmount}
                paidAmount={app.paidAmount}
                currentBatchId={app.batchId}
                currentBatchLabel={batchLabel}
                installmentsAllowed={app.installmentsAllowed}
                missingDocuments={missingNames}
                admission={app.admission ? { id: app.admission.id, admissionNo: app.admission.admissionNo } : null}
                can={can}
              />
              {(app.reviewNotes || app.rejectionReason || app.documentsRequestNote) && (
                <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                  {app.rejectionReason && (
                    <div>
                      <dt className="text-[11px] font-medium text-muted uppercase">Rejection reason</dt>
                      <dd className="text-danger">{app.rejectionReason}</dd>
                    </div>
                  )}
                  {app.documentsRequestNote && (
                    <div>
                      <dt className="text-[11px] font-medium text-muted uppercase">Last document request</dt>
                      <dd className="text-muted">{app.documentsRequestNote}</dd>
                    </div>
                  )}
                  {app.reviewNotes && (
                    <div>
                      <dt className="text-[11px] font-medium text-muted uppercase">Review notes</dt>
                      <dd className="text-muted">{app.reviewNotes}</dd>
                    </div>
                  )}
                </dl>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Scholarship" description={app.course.scholarshipAvailable ? "Available for this course" : "Not offered for this course"} />
            <CardBody>
              <ScholarshipPanel
                applicationId={app.id}
                originalFee={app.originalFee}
                discountAmount={app.discountAmount}
                programs={lookups.programs}
                award={
                  app.scholarshipAward
                    ? {
                        status: app.scholarshipAward.status,
                        scholarshipAmount: app.scholarshipAward.scholarshipAmount,
                        payableFee: app.scholarshipAward.payableFee,
                        programName: app.scholarshipAward.program?.name ?? null,
                        remarks: app.scholarshipAward.remarks,
                        approvedByName: app.scholarshipAward.approvedById ? (actorName.get(app.scholarshipAward.approvedById) ?? null) : null,
                        approvedAt: app.scholarshipAward.approvedAt,
                      }
                    : null
                }
                requested={app.scholarshipRequested}
                reason={app.scholarshipReason}
                decidable={decidable}
                canDecide={can.scholarship}
                courseAllows={app.course.scholarshipAvailable}
              />
            </CardBody>
          </Card>

          {app.admission && (
            <Card>
              <CardHeader title="Admission" />
              <CardBody className="space-y-3">
                <KeyValue
                  label="Admission No"
                  value={
                    <Link href={`/admin/admissions/${app.admission.id}`} className="font-mono text-navy hover:underline">
                      {app.admission.admissionNo}
                    </Link>
                  }
                />
                <KeyValue label="Status" value={<StatusBadge status={app.admission.status} />} />
                <KeyValue label="Admitted" value={formatDate(app.admission.admittedAt)} />
                {app.admission.progress && <KeyValue label="Attendance" value={`${Number(app.admission.progress.attendancePct)}% (${app.admission.progress.classesAttended}/${app.admission.progress.classesHeld} classes)`} />}
                {app.admission.certificate && (
                  <KeyValue
                    label="Certificate"
                    value={
                      <Link href={`/verify-certificate/${app.admission.certificate.certificateNo}`} target="_blank" className="font-mono text-navy hover:underline">
                        {app.admission.certificate.certificateNo}
                      </Link>
                    }
                  />
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Notifications sent" description="Latest 10 messages to this student" />
            <CardBody className="p-0">
              {notifications.length === 0 ? (
                <EmptyState icon={<Bell className="h-6 w-6" />} title="Nothing sent yet" className="border-0 bg-transparent py-8" />
              ) : (
                <ul className="divide-y divide-line">
                  {notifications.map((n) => (
                    <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{n.title}</p>
                        <p className="text-xs text-muted">
                          {titleCase(n.channel)} · {formatDateTime(n.sentAt ?? n.createdAt)}
                          {n.readAt ? " · read" : ""}
                        </p>
                      </div>
                      <StatusBadge status={n.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
