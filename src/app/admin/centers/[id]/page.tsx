import type { Metadata } from "next";
import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Building2, CalendarDays, ClipboardList, GraduationCap, MapPin, Phone, UsersRound, Award, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSetting } from "@/lib/settings";
import { formatDate, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { getCenterAdmin } from "@/server/centers";
import { applicationListSchema, listApplications } from "@/server/applications";
import { batchFormOptions } from "@/app/admin/batches/queries";
import { activeTrainerOptions, centerAdmissions, centerBatchOccupancy, centerCourseOptions } from "@/app/admin/centers/queries";
import { PageHeader, KeyValue, Avatar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatsCard, ProgressBar } from "@/components/ui/stats";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { ButtonLink } from "@/components/ui/button";
import { TabLinks } from "@/components/admin/shared/tab-links";
import { flattenParams, hrefWith, type SearchParamsRecord } from "@/components/admin/shared/url";
import { orNotFound } from "@/components/admin/shared/server";
import { CenterHeaderActions } from "@/components/admin/centers/center-actions";
import { CenterCoursesEditor, CenterGalleryManager } from "@/components/admin/centers/center-panels";
import { AssignTrainerDrawer, CreateBatchDrawer, EndAssignmentButton } from "@/components/admin/centers/center-drawers";

export const metadata: Metadata = { title: "Training Center · Foundation Admin" };

const TABS = ["overview", "courses", "batches", "trainers", "students", "applications", "reports", "gallery"] as const;
type Tab = (typeof TABS)[number];

export default async function CenterDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("centers.view");
  const { id } = await params;
  const sp = flattenParams(await searchParams);
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const center = await orNotFound(getCenterAdmin(id));
  const perms = { update: hasPermission(user, "centers.update"), verify: hasPermission(user, "centers.verify"), delete: hasPermission(user, "centers.delete") };
  const canAssign = hasPermission(user, "trainers.assign");
  const canCreateBatch = hasPermission(user, "batches.create");
  const canViewApplications = hasPermission(user, "applications.view");
  const canViewStudents = hasPermission(user, ["students.view", "admissions.view"]);
  const base = `/admin/centers/${center.id}`;
  const tabHref = (t: Tab) => (t === "overview" ? base : `${base}?tab=${t}`);
  const openBatches = center.batches.filter((b) => b.status === "UPCOMING" || b.status === "ONGOING");
  const location = `${center.block.name}, ${center.district.name}, ${center.state.name} – ${center.pincode}`;
  const publicUrl = `/training-centers/${center.state.slug}/${center.district.slug}/${center.slug}`;

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "courses", label: "Courses", count: center.courses.length },
    { value: "batches", label: "Batches", count: center.batches.length },
    { value: "trainers", label: "Trainers", count: center.stats.trainerCount },
    ...(canViewStudents ? [{ value: "students", label: "Students", count: center.stats.studentCount }] : []),
    ...(canViewApplications ? [{ value: "applications", label: "Applications", count: center.stats.applicationCount }] : []),
    { value: "reports", label: "Reports" },
    { value: "gallery", label: "Gallery", count: center.gallery.length },
  ].map((t) => ({ ...t, href: tabHref(t.value as Tab) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {center.name}
            {center.isVerified && (
              <Badge tone="success">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified
              </Badge>
            )}
            <StatusBadge status={center.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {location}
            </span>
            {center.status !== "INACTIVE" && (
              <Link href={publicUrl} className="inline-flex items-center gap-1 text-orange hover:underline" target="_blank" rel="noreferrer">
                Public page <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </span>
        }
        mobileTitle={center.code}
        backHref="/admin/centers"
        breadcrumbs={[{ label: "Training Centers", href: "/admin/centers" }, { label: center.code }]}
        actions={<CenterHeaderActions center={{ id: center.id, code: center.code, name: center.name, status: center.status, isVerified: center.isVerified, activeStudents: center.stats.studentCount }} perms={perms} />}
      />

      {/* The app bar shows only the centre code on phones – keep the name and status visible in the page. */}
      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <h2 className="text-h3 min-w-0 text-navy">{center.name}</h2>
        <StatusBadge status={center.status} />
        {center.isVerified && (
          <Badge tone="success">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </Badge>
        )}
      </div>

      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-caption font-semibold tracking-wide text-muted uppercase">Center code</p>
          <p className="text-h2 font-extrabold text-navy tabular-nums">{center.code}</p>
          <p className="mt-1 text-caption text-muted">Permanent identifier: it is printed on certificates, receipts and batch codes and never changes – even if the center is renamed or moved.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-body-sm sm:grid-cols-4">
          <KeyValue label="Students" value={formatNumber(center.stats.studentCount)} />
          <KeyValue label="Open batches" value={formatNumber(openBatches.length)} />
          <KeyValue label="Trainers" value={formatNumber(center.stats.trainerCount)} />
          <KeyValue label="Pending applications" value={formatNumber(center.stats.pendingApplications)} />
        </div>
      </div>

      <TabLinks items={tabs} active={tab} />

      {tab === "overview" && <OverviewTab center={center} />}
      {tab === "courses" && <CoursesTab center={center} canEdit={perms.update} />}
      {tab === "batches" && <BatchesTab center={center} canCreate={canCreateBatch} />}
      {tab === "trainers" && <TrainersTab center={center} canAssign={canAssign} />}
      {tab === "students" && canViewStudents && <StudentsTab centerId={center.id} sp={sp} base={base} />}
      {tab === "applications" && canViewApplications && <ApplicationsTab centerId={center.id} sp={sp} base={base} />}
      {tab === "reports" && <ReportsTab center={center} />}
      {tab === "gallery" && <CenterGalleryManager centerId={center.id} images={center.gallery} canEdit={perms.update} />}
    </div>
  );
}

type CenterData = Awaited<ReturnType<typeof getCenterAdmin>>;

function OverviewTab({ center }: { center: CenterData }) {
  const hours = center.openingHours && typeof center.openingHours === "object" && !Array.isArray(center.openingHours) ? Object.entries(center.openingHours as Record<string, unknown>) : [];
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader title="Details" />
          <CardBody className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <KeyValue label="Address" value={<span className="whitespace-pre-line">{[center.address, center.landmark && `Landmark: ${center.landmark}`, center.villageTown].filter(Boolean).join("\n")}</span>} />
            <KeyValue label="Block / District / State" value={`${center.block.name} / ${center.district.name} (${center.state.code}-${center.district.code}) / ${center.state.name}`} />
            <KeyValue label="PIN code" value={center.pincode} />
            <KeyValue label="Coordinates" value={center.latitude != null && center.longitude != null ? `${center.latitude}, ${center.longitude}` : "Not set"} />
            <KeyValue label="Contact person" value={center.contactPerson ?? "—"} />
            <KeyValue
              label="Phone / WhatsApp"
              value={
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted" /> {center.phone ?? "—"} {center.whatsapp && <span className="text-muted">· WhatsApp {center.whatsapp}</span>}
                </span>
              }
            />
            <KeyValue label="Email" value={center.email ?? "—"} />
            <KeyValue label="Established" value={center.establishedOn ? formatDate(center.establishedOn) : "—"} />
            <KeyValue label="Capacity" value={`${formatNumber(center.capacity)} students`} />
            <KeyValue label="Created" value={formatDate(center.createdAt)} />
            <div className="sm:col-span-2">
              <KeyValue label="Facilities" value={center.facilities.length ? <span className="flex flex-wrap gap-1.5">{center.facilities.map((f) => <Badge key={f}>{f}</Badge>)}</span> : "—"} />
            </div>
            <div className="sm:col-span-2">
              <KeyValue label="Opening hours" value={hours.length ? <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">{hours.map(([k, v]) => <React.Fragment key={k}><dt className="text-muted">{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl> : "—"} />
            </div>
            {center.description && (
              <div className="sm:col-span-2">
                <KeyValue label="Description" value={<span className="whitespace-pre-line">{center.description}</span>} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
      <div className="space-y-4">
        {center.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={center.coverImage} alt={`${center.name} cover`} className="aspect-[4/3] w-full rounded-card border border-line object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-card border border-dashed border-line bg-surface text-body-sm text-muted">No cover image</div>
        )}
        <Card>
          <CardHeader title="At a glance" />
          <CardBody className="grid grid-cols-2 gap-4">
            <KeyValue label="Courses offered" value={formatNumber(center.courses.length)} />
            <KeyValue label="Batches (all)" value={formatNumber(center.batches.length)} />
            <KeyValue label="Applications" value={formatNumber(center.stats.applicationCount)} />
            <KeyValue label="Certificates" value={formatNumber(center.stats.certificates)} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

async function CoursesTab({ center, canEdit }: { center: CenterData; canEdit: boolean }) {
  const courses = await centerCourseOptions(center.courses.map((c) => c.courseId));
  return (
    <Card>
      <CardHeader title="Courses offered" description="Batches can only be created for courses offered at this center." />
      <CardBody>
        <CenterCoursesEditor centerId={center.id} courses={courses} selected={center.courses.map((c) => c.courseId)} canEdit={canEdit} />
      </CardBody>
    </Card>
  );
}

async function BatchesTab({ center, canCreate }: { center: CenterData; canCreate: boolean }) {
  const options = canCreate ? await batchFormOptions() : { centers: [], trainers: [] };
  return (
    <Card>
      <CardHeader title="Batches" description={`${center.batches.length} batch${center.batches.length === 1 ? "" : "es"} at this center.`} action={canCreate ? <CreateBatchDrawer centerId={center.id} options={options} disabled={center.courses.length === 0} /> : undefined} />
      {canCreate && center.courses.length === 0 && (
        <div className="px-5 pt-4">
          <Alert tone="warning">Add at least one course to this center before creating a batch.</Alert>
        </div>
      )}
      <TableWrap className="max-md:px-4 max-md:pb-4 md:rounded-none md:border-0">
        <THead>
          <tr>
            <TH>Batch</TH>
            <TH>Course</TH>
            <TH>Schedule</TH>
            <TH>Trainer</TH>
            <TH className="text-right">Students</TH>
            <TH className="text-right">Capacity</TH>
            <TH>Status</TH>
          </tr>
        </THead>
        <TBody>
          {center.batches.length === 0 && <EmptyRow colSpan={7}>No batches yet.</EmptyRow>}
          {center.batches.map((b) => (
            <TR key={b.id}>
              <TD mobile="full">
                <Link href={`/admin/batches/${b.id}`} className="block tap-highlight-none md:inline md:font-medium md:text-navy md:hover:underline">
                  {b.name}
                  <span className="block font-mono text-caption font-normal text-muted">{b.code}</span>
                </Link>
              </TD>
              <TD label="Course">{b.course.name}</TD>
              <TD label="Schedule" className="text-caption">
                {formatDate(b.startDate)} – {formatDate(b.endDate)}
                <span className="block text-muted">
                  {b.days.join(", ")} · {b.startTime}–{b.endTime}
                </span>
              </TD>
              <TD label="Trainer">{b.trainer?.user.name ?? <span className="text-muted">Unassigned</span>}</TD>
              <TD label="Students" className="text-right tabular-nums">
                {b._count.admissions}
              </TD>
              <TD label="Capacity" className="text-right tabular-nums">
                {b.capacity}
              </TD>
              <TD label="Status">
                <StatusBadge status={b.status} />
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
    </Card>
  );
}

async function TrainersTab({ center, canAssign }: { center: CenterData; canAssign: boolean }) {
  const trainers = canAssign ? await activeTrainerOptions() : [];
  const openBatches = center.batches.filter((b) => b.status === "UPCOMING" || b.status === "ONGOING").map((b) => ({ id: b.id, code: b.code, name: b.name, status: b.status, courseId: b.courseId, courseName: b.course.name, startDate: b.startDate.toISOString(), trainerName: b.trainer?.user.name ?? null }));
  return (
    <Card>
      <CardHeader title="Active trainer assignments" description="Trainers assigned to this center, a course here, or a specific batch." action={canAssign ? <AssignTrainerDrawer centerId={center.id} trainers={trainers} courses={center.courses.map((c) => c.course)} batches={openBatches} /> : undefined} />
      <TableWrap className="max-md:px-4 max-md:pb-4 md:rounded-none md:border-0">
        <THead>
          <tr>
            <TH>Trainer</TH>
            <TH>Scope</TH>
            <TH>Notes</TH>
            <TH>Since</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {center.trainerAssignments.length === 0 && <EmptyRow colSpan={5}>No trainers assigned yet.</EmptyRow>}
          {center.trainerAssignments.map((a) => (
            <TR key={a.id}>
              <TD mobile="full">
                <Link href={`/admin/trainers/${a.trainer.id}`} className="block tap-highlight-none md:inline md:font-medium md:text-navy md:hover:underline">
                  {a.trainer.user.name}
                  <span className="block font-mono text-caption font-normal text-muted">
                    {a.trainer.trainerId} · {titleCase(a.trainer.level)} level
                  </span>
                </Link>
              </TD>
              <TD label="Scope">{a.batch ? `Batch ${a.batch.code} · ${a.batch.name}` : a.course ? `Course · ${a.course.name}` : "Whole center"}</TD>
              <TD label="Notes" className="text-caption text-muted">
                {a.notes ?? "—"}
              </TD>
              <TD label="Since" className="text-muted md:whitespace-nowrap">
                {formatDate(a.assignedAt)}
              </TD>
              <TD mobile="actions" className="text-right">
                {canAssign && <EndAssignmentButton centerId={center.id} assignmentId={a.id} trainerName={a.trainer.user.name} />}
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
    </Card>
  );
}

async function StudentsTab({ centerId, sp, base }: { centerId: string; sp: Record<string, string>; base: string }) {
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await centerAdmissions(centerId, { page, limit: 25, status: sp.status });
  const statuses = ["ACTIVE", "ON_HOLD", "COMPLETED", "DROPPED"];
  return (
    <Card>
      <CardHeader
        title="Students"
        description={`${formatNumber(data.meta.total)} admission${data.meta.total === 1 ? "" : "s"} at this center.`}
        action={
          <div className="flex flex-wrap gap-1.5">
            <Link href={hrefWith(base, sp, { status: undefined, page: undefined })} className={`inline-flex min-h-11 items-center rounded-full border px-3 text-caption font-semibold tap-highlight-none md:min-h-0 md:py-1 ${!sp.status ? "border-navy bg-navy text-white" : "border-line text-muted hover:text-ink"}`}>
              All
            </Link>
            {statuses.map((s) => (
              <Link key={s} href={hrefWith(base, sp, { status: s, page: undefined })} className={`inline-flex min-h-11 items-center rounded-full border px-3 text-caption font-semibold tap-highlight-none md:min-h-0 md:py-1 ${sp.status === s ? "border-navy bg-navy text-white" : "border-line text-muted hover:text-ink"}`}>
                {titleCase(s)} ({formatNumber(data.byStatus[s] ?? 0)})
              </Link>
            ))}
          </div>
        }
      />
      <TableWrap className="max-md:px-4 max-md:pb-4 md:rounded-none md:border-0">
        <THead>
          <tr>
            <TH>Student</TH>
            <TH>Admission</TH>
            <TH>Course</TH>
            <TH>Batch</TH>
            <TH>Trainer</TH>
            <TH className="text-right">Attendance</TH>
            <TH>Status</TH>
          </tr>
        </THead>
        <TBody>
          {data.items.length === 0 && <EmptyRow colSpan={7}>No students match.</EmptyRow>}
          {data.items.map((a) => (
            <TR key={a.id}>
              <TD mobile="full">
                <Link href={`/admin/students/${a.student.id}`} className="flex items-center gap-3 tap-highlight-none md:hover:text-navy">
                  <Avatar name={a.student.name} src={a.student.photoUrl} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{a.student.name}</span>
                    <span className="block text-caption font-normal text-muted">{a.student.studentId ?? a.student.mobile}</span>
                  </span>
                </Link>
              </TD>
              <TD label="Admission">
                <Link href={`/admin/admissions/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                  {a.admissionNo}
                </Link>
                <span className="block text-caption text-muted">{formatDate(a.admittedAt)}</span>
              </TD>
              <TD label="Course">{a.course.name}</TD>
              <TD label="Batch" className="text-caption">
                <Link href={`/admin/batches/${a.batch.id}`} className="hover:underline">
                  {a.batch.code}
                </Link>
              </TD>
              <TD label="Trainer">{a.trainer?.user.name ?? <span className="text-muted">—</span>}</TD>
              <TD label="Attendance" className="text-right tabular-nums">
                {a.attendancePct === null ? "—" : `${a.attendancePct}%`}
              </TD>
              <TD label="Status">
                <StatusBadge status={a.status} />
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
      <div className="px-5 py-4">
        <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={(p) => hrefWith(base, sp, { page: p > 1 ? p : undefined })} />
      </div>
    </Card>
  );
}

async function ApplicationsTab({ centerId, sp, base }: { centerId: string; sp: Record<string, string>; base: string }) {
  const q = applicationListSchema.parse({ centerId, page: sp.page ?? "1", limit: "25", status: sp.status || undefined });
  const data = await listApplications(q);
  const statuses = ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "PAYMENT_PENDING", "ADMISSION_CONFIRMED", "WAITLISTED", "REJECTED"];
  return (
    <Card>
      <CardHeader
        title="Applications"
        description={`${formatNumber(data.meta.total)} application${data.meta.total === 1 ? "" : "s"} for this center.`}
        action={
          <Link href={`/admin/applications?centerId=${centerId}`} className="text-caption font-semibold text-orange hover:underline">
            Open in Applications
          </Link>
        }
      />
      <div className="flex flex-wrap gap-1.5 px-5 pt-4">
        <Link href={hrefWith(base, sp, { status: undefined, page: undefined })} className={`inline-flex min-h-11 items-center rounded-full border px-3 text-caption font-semibold tap-highlight-none md:min-h-0 md:py-1 ${!sp.status ? "border-navy bg-navy text-white" : "border-line text-muted hover:text-ink"}`}>
          All
        </Link>
        {statuses.map((s) => (
          <Link key={s} href={hrefWith(base, sp, { status: s, page: undefined })} className={`inline-flex min-h-11 items-center rounded-full border px-3 text-caption font-semibold tap-highlight-none md:min-h-0 md:py-1 ${sp.status === s ? "border-navy bg-navy text-white" : "border-line text-muted hover:text-ink"}`}>
            {titleCase(s)}
          </Link>
        ))}
      </div>
      <TableWrap className="mt-4 max-md:px-4 max-md:pb-4 md:rounded-none md:border-0">
        <THead>
          <tr>
            <TH>Application</TH>
            <TH>Applicant</TH>
            <TH>Course</TH>
            <TH>Batch</TH>
            <TH className="text-right">Payable</TH>
            <TH>Status</TH>
            <TH>Submitted</TH>
          </tr>
        </THead>
        <TBody>
          {data.items.length === 0 && <EmptyRow colSpan={7}>No applications match.</EmptyRow>}
          {data.items.map((a) => (
            <TR key={a.id}>
              <TD label="Application" mobile="hidden">
                <Link href={`/admin/applications/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                  {a.applicationNo}
                </Link>
              </TD>
              <TD mobile="full">
                <Link href={`/admin/applications/${a.id}`} className="block tap-highlight-none md:hidden">
                  <span className="block font-mono text-caption font-semibold text-orange">{a.applicationNo}</span>
                  <span className="block font-semibold text-navy">{a.student.name}</span>
                  <span className="block text-caption font-normal text-muted">{a.student.studentId ?? a.student.mobile}</span>
                </Link>
                <span className="hidden md:block">
                  <Link href={`/admin/students/${a.student.id}`} className="font-medium hover:text-navy">
                    {a.student.name}
                  </Link>
                  <span className="block text-caption text-muted">{a.student.studentId ?? a.student.mobile}</span>
                </span>
              </TD>
              <TD label="Course">{a.course.name}</TD>
              <TD label="Batch" className="text-caption">
                {a.batch?.code ?? <span className="text-muted">Not allocated</span>}
              </TD>
              <TD label="Payable" className="text-right tabular-nums">
                {formatINR(a.payableAmount)}
              </TD>
              <TD label="Status">
                <StatusBadge status={a.status} />
              </TD>
              <TD label="Submitted" className="text-muted md:whitespace-nowrap">
                {formatDate(a.submittedAt ?? a.createdAt)}
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
      <div className="px-5 py-4">
        <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={(p) => hrefWith(base, sp, { page: p > 1 ? p : undefined })} />
      </div>
    </Card>
  );
}

async function ReportsTab({ center }: { center: CenterData }) {
  const [occupancy, orgName] = await Promise.all([centerBatchOccupancy(center.id), getSetting<string>("branding.siteName")]);
  const byStatus = center.batches.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.status]: (acc[b.status] ?? 0) + 1 }), {});
  const reportLinks = [
    { key: "students", label: "Student summary" },
    { key: "batches", label: "Batch summary" },
    { key: "admissions", label: "Admission summary" },
    { key: "payments", label: "Payment summary" },
    { key: "attendance", label: "Attendance summary" },
    { key: "certificates", label: "Certificate summary" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatsCard label="Active students" value={center.stats.studentCount} icon={<GraduationCap className="h-5 w-5" />} tone="success" />
        <StatsCard label="Applications" value={center.stats.applicationCount} hint={`${formatNumber(center.stats.pendingApplications)} pending review`} icon={<ClipboardList className="h-5 w-5" />} tone="warning" />
        <StatsCard label="Trainers" value={center.stats.trainerCount} icon={<UsersRound className="h-5 w-5" />} tone="info" />
        <StatsCard label="Ongoing batches" value={byStatus.ONGOING ?? 0} hint={`${formatNumber(byStatus.UPCOMING ?? 0)} upcoming`} icon={<CalendarDays className="h-5 w-5" />} tone="orange" />
        <StatsCard label="Completed batches" value={byStatus.COMPLETED ?? 0} hint={`${formatNumber(byStatus.CANCELLED ?? 0)} cancelled`} icon={<Building2 className="h-5 w-5" />} tone="navy" />
        <StatsCard label="Certificates" value={center.stats.certificates} icon={<Award className="h-5 w-5" />} tone="navy" />
      </div>
      <Card>
        <CardHeader title="Seat occupancy by batch" description="Admitted students plus approved applications holding a seat." />
        <TableWrap className="max-md:px-4 max-md:pb-4 md:rounded-none md:border-0">
          <THead>
            <tr>
              <TH>Batch</TH>
              <TH>Course</TH>
              <TH>Status</TH>
              <TH className="text-right">Admitted</TH>
              <TH className="text-right">Reserved</TH>
              <TH className="text-right">Completed</TH>
              <TH className="md:w-56">Occupancy</TH>
            </tr>
          </THead>
          <TBody>
            {occupancy.length === 0 && <EmptyRow colSpan={7}>No batches yet.</EmptyRow>}
            {occupancy.map((b) => (
              <TR key={b.id}>
                <TD mobile="full">
                  <Link href={`/admin/batches/${b.id}`} className="block tap-highlight-none md:inline md:font-medium md:text-navy md:hover:underline">
                    {b.code}
                    <span className="block text-caption font-normal text-muted">{b.name}</span>
                  </Link>
                </TD>
                <TD label="Course">{b.course.name}</TD>
                <TD label="Status">
                  <StatusBadge status={b.status} />
                </TD>
                <TD label="Admitted" className="text-right tabular-nums">
                  {b.admitted}
                </TD>
                <TD label="Reserved" className="text-right tabular-nums">
                  {b.reserved}
                </TD>
                <TD label="Completed" className="text-right tabular-nums">
                  {b.completed}
                </TD>
                <TD label="" className="max-md:block">
                  <ProgressBar value={b.occupied} max={b.capacity} label={`${b.occupied}/${b.capacity}`} tone={b.available === 0 ? "danger" : b.occupied / b.capacity > 0.8 ? "warning" : "success"} />
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      </Card>
      <Card>
        <CardHeader title="Exportable reports" description={`${orgName} reports pre-filtered to ${center.code}. Choose CSV, Excel or PDF on the report page.`} />
        <CardBody className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {reportLinks.map((r) => (
            <ButtonLink key={r.key} href={`/admin/reports/${r.key}?centerId=${center.id}`} variant="outline" size="sm" className="justify-start">
              {r.label}
            </ButtonLink>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

