import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, History, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { calcAge, dateInputValue, formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";
import { getStudentAdmin } from "@/server/students";
import { studentAttendance } from "@/server/attendance";
import { PageHeader, Avatar, KeyValue, Timeline } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/stats";
import { TabbedPanels } from "@/components/admin/pickers/query-tabs";
import { StudentHeaderActions } from "@/components/admin/students/student-header-actions";
import { DocumentActions } from "@/components/admin/students/document-actions";
import { withBasePath } from "@/lib/base-path";
import { RecordIdentity } from "@/components/admin/locations/list-kit";

export const metadata = { title: "Student" };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("students.view");
  const { id } = await params;
  const s = await getStudentAdmin(id).catch(() => null);
  if (!s) notFound();
  const canUpdate = hasPermission(user, "students.update");

  const recordIds = [s.id, s.userId, ...s.applications.map((a) => a.id), ...s.admissions.map((a) => a.id), ...s.payments.map((p) => p.id), ...s.certificates.map((c) => c.id)];
  const [attendance, docTypes, activity] = await Promise.all([
    studentAttendance(s.id),
    db.documentType.findMany({ where: { appliesTo: "STUDENT" }, select: { key: true, name: true } }),
    db.auditLog.findMany({ where: { recordId: { in: recordIds } }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const docName = new Map(docTypes.map((d) => [d.key, d.name]));
  const age = calcAge(s.dob);

  const initial = {
    name: s.name,
    guardianName: s.guardianName ?? "",
    guardianRelation: s.guardianRelation ?? "",
    dob: dateInputValue(s.dob),
    gender: s.gender ?? "",
    mobile: s.mobile,
    whatsapp: s.whatsapp ?? "",
    email: s.email ?? "",
    stateId: s.stateId ?? "",
    districtId: s.districtId ?? "",
    blockId: s.blockId ?? "",
    villageTown: s.villageTown ?? "",
    address: s.address ?? "",
    pincode: s.pincode ?? "",
    qualification: s.qualification ?? "",
    institution: s.institution ?? "",
    passingYear: s.passingYear ? String(s.passingYear) : "",
    familyIncome: s.familyIncome ?? "",
    occupation: s.occupation ?? "",
    areaType: s.areaType ?? "",
    trainingRequirement: s.trainingRequirement ?? "",
    scholarshipRequired: s.scholarshipRequired,
    status: s.user.status,
  };

  const location = [s.villageTown, s.block?.name, s.district?.name, s.state?.name].filter(Boolean).join(", ");

  const profile = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Profile" />
        <CardBody className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          <KeyValue label="Full name" value={s.name} />
          <KeyValue label="Date of birth" value={s.dob ? `${formatDate(s.dob)}${age !== null ? ` (${age} yrs)` : ""}` : "—"} />
          <KeyValue label="Gender" value={titleCase(s.gender) || "—"} />
          <KeyValue label="Guardian" value={s.guardianName ? `${s.guardianName}${s.guardianRelation ? ` (${s.guardianRelation})` : ""}` : "—"} />
          <KeyValue label="Mobile" value={s.mobile} />
          <KeyValue label="WhatsApp" value={s.whatsapp ?? "—"} />
          <KeyValue label="Email" value={s.email ?? "—"} />
          <KeyValue label="Address" value={s.address ?? "—"} className="col-span-2 md:col-span-1" />
          <KeyValue label="Village / Town" value={s.villageTown ?? "—"} />
          <KeyValue label="Block" value={s.block?.name ?? "—"} />
          <KeyValue label="District" value={s.district?.name ?? "—"} />
          <KeyValue label="State" value={s.state?.name ?? "—"} />
          <KeyValue label="PIN code" value={s.pincode ?? "—"} />
          <KeyValue label="Area" value={titleCase(s.areaType) || "—"} />
          <KeyValue label="Qualification" value={s.qualification ?? "—"} />
          <KeyValue label="Institution" value={s.institution ?? "—"} />
          <KeyValue label="Passing year" value={s.passingYear ?? "—"} />
          <KeyValue label="Family income" value={s.familyIncome ?? "—"} />
          <KeyValue label="Occupation" value={s.occupation ?? "—"} />
          <KeyValue label="Scholarship support" value={s.scholarshipRequired ? "Requested" : "Not requested"} />
          <KeyValue label="Training requirement" value={s.trainingRequirement ?? "—"} className="col-span-2 md:col-span-3" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Account" />
        <CardBody className="space-y-4">
          <KeyValue label="Status" value={<StatusBadge status={s.user.status} />} />
          <KeyValue label="Profile" value={s.profileCompleted ? <Badge tone="success">Completed</Badge> : <Badge tone="warning">Incomplete</Badge>} />
          <KeyValue label="Login email" value={s.user.email ?? "—"} />
          <KeyValue label="Login mobile" value={s.user.mobile ?? "—"} />
          <KeyValue label="Last login" value={s.user.lastLoginAt ? formatDateTime(s.user.lastLoginAt) : "Never"} />
          <KeyValue label="Registered" value={formatDateTime(s.user.createdAt)} />
        </CardBody>
      </Card>
    </div>
  );

  const documents = (
    <Card>
      <CardHeader title="Documents" description="Uploaded by the student. Verification is visible to the student immediately." />
      {s.documents.length === 0 ? (
        <CardBody>
          <EmptyState icon={<FileText className="h-7 w-7" />} title="No documents uploaded" description="Documents uploaded from the student portal will appear here." className="py-8" />
        </CardBody>
      ) : (
        <TableWrap className="rounded-none border-0">
          <THead>
            <tr>
              <TH>Document</TH>
              <TH>File</TH>
              <TH>Status</TH>
              <TH>Remarks</TH>
              <TH>Uploaded</TH>
              <TH>Actions</TH>
            </tr>
          </THead>
          <TBody>
            {s.documents.map((d) => (
              <TR key={d.id}>
                <TD primary className="font-medium">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">{docName.get(d.type) ?? titleCase(d.type)}</span>
                    <span className="shrink-0 md:hidden">
                      <StatusBadge status={d.status} />
                    </span>
                  </span>
                </TD>
                <TD label="File">
                  <span className="block truncate text-caption text-muted md:max-w-56">{d.name}</span>
                  <span className="text-caption text-muted">
                    {d.mimeType ?? ""}
                    {d.size ? ` · ${(d.size / 1024).toFixed(0)} KB` : ""}
                  </span>
                </TD>
                <TD mobile="hidden">
                  <StatusBadge status={d.status} />
                  {d.verifiedAt && <span className="block text-caption text-muted">{formatDate(d.verifiedAt)}</span>}
                </TD>
                <TD label="Remarks" className="text-caption text-muted md:max-w-64">
                  {d.remarks ?? "—"}
                </TD>
                <TD label="Uploaded" className="text-muted md:whitespace-nowrap">
                  {formatDate(d.createdAt)}
                </TD>
                <TD actions>
                  <DocumentActions endpoint={`/api/admin/students/${s.id}/documents/${d.id}`} url={d.url} name={d.name} status={d.status} canDecide={canUpdate} />
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </Card>
  );

  const applications = (
    <TableWrap>
      <THead>
        <tr>
          <TH>Application</TH>
          <TH>Course</TH>
          <TH>Center</TH>
          <TH>Batch</TH>
          <TH>Status</TH>
          <TH className="text-right">Payable</TH>
          <TH className="text-right">Paid</TH>
          <TH>Submitted</TH>
        </tr>
      </THead>
      <TBody>
        {s.applications.length === 0 && <EmptyRow colSpan={8}>No applications yet.</EmptyRow>}
        {s.applications.map((a) => (
          <TR key={a.id}>
            <TD primary>
              <span className="flex items-start justify-between gap-2">
                <Link href={`/admin/applications/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                  {a.applicationNo}
                </Link>
                <span className="shrink-0 md:hidden">
                  <StatusBadge status={a.status} />
                </span>
              </span>
            </TD>
            <TD label="Course">{a.course.name}</TD>
            <TD label="Center">
              {a.center.name} <span className="text-caption text-muted">({a.center.code})</span>
            </TD>
            <TD label="Batch" className="text-caption">
              {a.batch ? `${a.batch.code}` : "—"}
            </TD>
            <TD mobile="hidden">
              <StatusBadge status={a.status} />
            </TD>
            <TD label="Payable" className="text-right tabular-nums">
              {formatINR(a.payableAmount)}
            </TD>
            <TD label="Paid" className="text-right tabular-nums">
              {formatINR(a.paidAmount)}
            </TD>
            <TD label="Submitted" className="text-muted md:whitespace-nowrap">
              {formatDate(a.submittedAt ?? a.createdAt)}
            </TD>
          </TR>
        ))}
      </TBody>
    </TableWrap>
  );

  const admissions = (
    <TableWrap>
      <THead>
        <tr>
          <TH>Admission</TH>
          <TH>Course</TH>
          <TH>Center</TH>
          <TH>Batch</TH>
          <TH>Trainer</TH>
          <TH>Status</TH>
          <TH>Progress</TH>
          <TH>Admitted</TH>
        </tr>
      </THead>
      <TBody>
        {s.admissions.length === 0 && <EmptyRow colSpan={8}>No admissions yet.</EmptyRow>}
        {s.admissions.map((a) => (
          <TR key={a.id}>
            <TD primary>
              <span className="flex items-start justify-between gap-2">
                <Link href={`/admin/admissions/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                  {a.admissionNo}
                </Link>
                <span className="shrink-0 md:hidden">
                  <StatusBadge status={a.status} />
                </span>
              </span>
            </TD>
            <TD label="Course">{a.course.name}</TD>
            <TD label="Center">{a.center.name}</TD>
            <TD label="Batch" className="text-caption">
              {a.batch.code} <StatusBadge status={a.batch.status} className="ml-1" />
            </TD>
            <TD label="Trainer">{a.trainer?.user.name ?? "—"}</TD>
            <TD mobile="hidden">
              <StatusBadge status={a.status} />
            </TD>
            <TD label="" className="md:min-w-40">
              {a.progress ? <ProgressBar value={a.progress.completionPct} label={`Attendance ${a.progress.attendancePct}%`} tone={a.progress.certificateEligible ? "success" : "orange"} /> : <span className="text-caption text-muted">Progress not computed</span>}
            </TD>
            <TD label="Admitted" className="text-muted md:whitespace-nowrap">
              {formatDate(a.admittedAt)}
            </TD>
          </TR>
        ))}
      </TBody>
    </TableWrap>
  );

  const attendanceTab = (
    <div className="space-y-6">
      {attendance.summary.length === 0 ? (
        <EmptyState title="No attendance recorded" description="Attendance appears once the trainer or staff marks it for an admitted batch." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {attendance.summary.map((b) => (
            <Card key={b.batchId}>
              <CardBody>
                <p className="font-semibold text-navy">{b.batch.name}</p>
                <p className="text-caption text-muted">
                  {b.batch.code} · {b.batch.course.name}
                </p>
                <ProgressBar className="mt-3" value={b.pct} label="Attendance" tone={b.pct >= 75 ? "success" : b.pct >= 50 ? "warning" : "danger"} />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-caption sm:grid-cols-5">
                  <div>
                    <p className="font-bold text-ink tabular-nums">{b.held}</p>
                    <p className="text-muted">Held</p>
                  </div>
                  <div>
                    <p className="font-bold text-success-dark tabular-nums">{b.present}</p>
                    <p className="text-muted">Present</p>
                  </div>
                  <div>
                    <p className="font-bold text-warning-dark tabular-nums">{b.late}</p>
                    <p className="text-muted">Late</p>
                  </div>
                  <div>
                    <p className="font-bold text-danger tabular-nums">{b.absent}</p>
                    <p className="text-muted">Absent</p>
                  </div>
                  <div>
                    <p className="font-bold text-info-dark tabular-nums">{b.leave}</p>
                    <p className="text-muted">Leave</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      {attendance.records.length > 0 && (
        <TableWrap>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Batch</TH>
              <TH>Status</TH>
              <TH>Remarks</TH>
            </tr>
          </THead>
          <TBody>
            {attendance.records.slice(0, 60).map((r) => (
              <TR key={r.id}>
                <TD primary>
                  <span className="flex items-center justify-between gap-2">
                    <span className="whitespace-nowrap">{formatDate(r.date)}</span>
                    <span className="md:hidden">
                      <StatusBadge status={r.status} />
                    </span>
                  </span>
                </TD>
                <TD label="Batch" className="text-caption">
                  {r.batch.code} · {r.batch.course.name}
                </TD>
                <TD mobile="hidden">
                  <StatusBadge status={r.status} />
                </TD>
                <TD label="Remarks" className="text-caption text-muted">
                  {r.remarks ?? "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </div>
  );

  const payments = (
    <TableWrap>
      <THead>
        <tr>
          <TH>Payment</TH>
          <TH>Application</TH>
          <TH className="text-right">Amount</TH>
          <TH>Method</TH>
          <TH>Status</TH>
          <TH>Paid at</TH>
          <TH>Receipt</TH>
        </tr>
      </THead>
      <TBody>
        {s.payments.length === 0 && <EmptyRow colSpan={7}>No payments recorded.</EmptyRow>}
        {s.payments.map((p) => (
          <TR key={p.id}>
            <TD primary>
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <Link href={`/admin/payments/${p.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                    {p.paymentNo}
                  </Link>
                  {p.receiptNo && <span className="block text-caption font-normal text-muted">Receipt {p.receiptNo}</span>}
                </span>
                <span className="shrink-0 text-right md:hidden">
                  <span className="block tabular-nums">{formatINR(p.amount)}</span>
                  <StatusBadge status={p.status} className="mt-1" />
                </span>
              </span>
            </TD>
            <TD label="Application" className="font-mono text-caption">
              {p.application.applicationNo}
            </TD>
            <TD mobile="hidden" className="text-right tabular-nums">
              {formatINR(p.amount)}
            </TD>
            <TD label="Method">{titleCase(p.method)}</TD>
            <TD mobile="hidden">
              <StatusBadge status={p.status} />
            </TD>
            <TD label="Paid at" className="text-muted md:whitespace-nowrap">
              {p.paidAt ? formatDateTime(p.paidAt) : "—"}
            </TD>
            <TD actions>
              <a
                href={withBasePath(`/api/admin/payments/${p.id}/document`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-caption font-semibold text-orange hover:underline md:min-h-0"
              >
                {p.status === "COMPLETED" ? "Receipt" : "Invoice"}
              </a>
            </TD>
          </TR>
        ))}
      </TBody>
    </TableWrap>
  );

  const certificates = (
    <TableWrap>
      <THead>
        <tr>
          <TH>Certificate No</TH>
          <TH>Course</TH>
          <TH>Center</TH>
          <TH>Grade</TH>
          <TH>Status</TH>
          <TH>Issued</TH>
          <TH>Links</TH>
        </tr>
      </THead>
      <TBody>
        {s.certificates.length === 0 && <EmptyRow colSpan={7}>No certificates issued.</EmptyRow>}
        {s.certificates.map((c) => (
          <TR key={c.id}>
            <TD primary className="font-mono text-caption font-semibold text-navy">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">{c.certificateNo}</span>
                <span className="shrink-0 font-sans md:hidden">
                  <StatusBadge status={c.status} />
                </span>
              </span>
            </TD>
            <TD label="Course">{c.courseName}</TD>
            <TD label="Center">{c.centerName}</TD>
            <TD label="Grade">{c.grade ?? "—"}</TD>
            <TD mobile="hidden">
              <StatusBadge status={c.status} />
            </TD>
            <TD label="Issued" className="text-muted md:whitespace-nowrap">
              {formatDate(c.issuedAt)}
            </TD>
            <TD actions className="space-x-3 text-caption font-semibold">
              <a href={withBasePath(`/api/admin/certificates/${c.id}/download`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-orange hover:underline md:min-h-0">
                Download
              </a>
              <Link href={`/verify-certificate/${c.certificateNo}`} target="_blank" className="inline-flex min-h-11 items-center text-navy hover:underline md:min-h-0">
                Verify page
              </Link>
            </TD>
          </TR>
        ))}
      </TBody>
    </TableWrap>
  );

  const activityTab =
    activity.length === 0 ? (
      <EmptyState icon={<History className="h-7 w-7" />} title="No activity yet" description="Staff actions on this student, their applications, admissions and payments appear here." />
    ) : (
      <Card>
        <CardBody>
          <Timeline
            items={activity.map((a) => ({
              title: a.description,
              description: `${a.actorName ?? "System"} · ${titleCase(a.module)} · ${titleCase(a.action)}`,
              meta: formatDateTime(a.createdAt),
              tone: a.action.includes("reject") || a.action.includes("cancel") || a.action === "delete" ? "danger" : a.action.includes("approve") || a.action.includes("verify") || a.action.includes("complete") ? "success" : "navy",
            }))}
          />
        </CardBody>
      </Card>
    );

  return (
    <div>
      {/* Identity and status first on phones, where the app bar only has room for a code. */}
      <RecordIdentity
        lead={<Avatar name={s.name} src={s.photoUrl} size={48} />}
        title={s.name}
        meta={s.studentId ? <span className="font-mono font-semibold text-navy">{s.studentId}</span> : undefined}
        badges={
          <>
            {!s.studentId && <Badge tone="warning">No Student ID</Badge>}
            <StatusBadge status={s.user.status} />
          </>
        }
      />
      <PageHeader
        backHref="/admin/students"
        mobileTitle={s.name}
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: s.name }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={s.name} src={s.photoUrl} size={56} />
            <span>
              {s.name}
              <span className="mt-1 flex flex-wrap items-center gap-2 text-body-sm font-medium text-muted">
                {s.studentId ? <span className="font-mono text-navy">{s.studentId}</span> : <Badge tone="warning">No Student ID</Badge>}
                <StatusBadge status={s.user.status} />
              </span>
            </span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {s.mobile}
            </span>
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {location}
              </span>
            )}
          </span>
        }
        actions={<StudentHeaderActions studentId={s.id} name={s.name} hasStudentId={!!s.studentId} canUpdate={canUpdate} initial={initial} />}
      />


      <TabbedPanels
        items={[
          { value: "profile", label: "Profile" },
          { value: "documents", label: "Documents", count: s.documents.length },
          { value: "applications", label: "Applications", count: s.applications.length },
          { value: "admissions", label: "Admissions", count: s.admissions.length },
          { value: "attendance", label: "Attendance" },
          { value: "payments", label: "Payments", count: s.payments.length },
          { value: "certificates", label: "Certificates", count: s.certificates.length },
          { value: "activity", label: "Activity", count: activity.length },
        ]}
        panels={{ profile, documents, applications, admissions, attendance: attendanceTab, payments, certificates, activity: activityTab }}
      />
    </div>
  );
}
