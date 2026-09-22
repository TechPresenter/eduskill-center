import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, GraduationCap, Mail, MapPin, MapPinned, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { getTrainerDetail } from "@/server/trainers";
import { PageHeader, Avatar, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatsCard } from "@/components/ui/stats";
import { TabbedPanels } from "@/components/admin/pickers/query-tabs";
import { TrainerActions, EndAssignmentButton } from "@/components/admin/trainers/trainer-actions";
import { AssignDrawer } from "@/components/admin/trainers/assign-drawer";
import { DocumentActions } from "@/components/admin/trainers/document-actions";

export const metadata = { title: "Trainer" };

export default async function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("trainers.view");
  const { id } = await params;
  const t = await getTrainerDetail(id).catch(() => null);
  if (!t) notFound();
  const canUpdate = hasPermission(user, "trainers.update");
  const canAssign = hasPermission(user, "trainers.assign");

  const [students, docTypes, preferredCourses] = await Promise.all([
    db.admission.findMany({
      where: { batch: { trainerId: t.id }, status: { in: ["ACTIVE", "ON_HOLD"] } },
      orderBy: { admittedAt: "desc" },
      take: 300,
      include: { student: { select: { id: true, name: true, studentId: true, mobile: true, photoUrl: true } }, batch: { select: { id: true, name: true, code: true, status: true } }, course: { select: { name: true } }, center: { select: { name: true, code: true } } },
    }),
    db.documentType.findMany({ where: { appliesTo: "TRAINER" }, select: { key: true, name: true } }),
    t.application?.preferredCourseIds.length ? db.course.findMany({ where: { id: { in: t.application.preferredCourseIds } }, select: { id: true, name: true, code: true } }) : Promise.resolve([]),
  ]);
  const docName = new Map(docTypes.map((d) => [d.key, d.name]));
  const location = [t.block?.name, t.district?.name, t.state.name].filter(Boolean).join(", ");
  const activeAssignments = t.assignments.filter((a) => a.isActive);
  const pastAssignments = t.assignments.filter((a) => !a.isActive);

  const profile = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Profile" />
        <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
          <KeyValue label="Full name" value={t.user.name} />
          <KeyValue label="Trainer ID" value={<span className="font-mono font-semibold text-navy">{t.trainerId}</span>} />
          <KeyValue label="Volunteer level" value={<Badge tone="navy">{titleCase(t.level)}</Badge>} />
          <KeyValue label="Mobile" value={t.user.mobile ?? "—"} />
          <KeyValue label="Email" value={t.user.email ?? "—"} />
          <KeyValue label="Joined" value={formatDate(t.joinedAt)} />
          <KeyValue label="State" value={t.state.name} />
          <KeyValue label="District" value={t.district?.name ?? "—"} />
          <KeyValue label="Block" value={t.block?.name ?? "—"} />
          <KeyValue label="Qualification" value={t.qualification ?? "—"} className="sm:col-span-2 md:col-span-3" />
          <KeyValue
            label="Skills"
            value={
              t.skills.length ? (
                <span className="flex flex-wrap gap-1">
                  {t.skills.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </span>
              ) : (
                "—"
              )
            }
            className="sm:col-span-2 md:col-span-3"
          />
          <KeyValue
            label="Languages"
            value={
              t.languages.length ? (
                <span className="flex flex-wrap gap-1">
                  {t.languages.map((s) => (
                    <Badge key={s} tone="info">
                      {s}
                    </Badge>
                  ))}
                </span>
              ) : (
                "—"
              )
            }
            className="sm:col-span-2 md:col-span-3"
          />
          <KeyValue label="Bio" value={t.bio ? <span className="whitespace-pre-line">{t.bio}</span> : "—"} className="sm:col-span-2 md:col-span-3" />
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Account" />
          <CardBody className="space-y-4">
            <KeyValue label="Trainer status" value={<StatusBadge status={t.status} />} />
            <KeyValue label="Login status" value={<StatusBadge status={t.user.status} />} />
            <KeyValue label="Last login" value={t.user.lastLoginAt ? formatDateTime(t.user.lastLoginAt) : "Never"} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Application" />
          <CardBody className="space-y-4">
            {t.application ? (
              <>
                <KeyValue
                  label="Application no"
                  value={
                    <Link href={`/admin/trainer-applications/${t.application.id}`} className="font-mono font-semibold text-navy hover:underline">
                      {t.application.applicationNo}
                    </Link>
                  }
                />
                <KeyValue label="Submitted" value={formatDate(t.application.submittedAt)} />
                <KeyValue label="Experience" value={`${t.application.experienceYears} yrs · ${t.application.teachingExperienceYears} yrs teaching`} />
                <KeyValue label="Training mode" value={titleCase(t.application.trainingMode)} />
                <KeyValue label="Availability" value={t.application.availability ?? "—"} />
                <KeyValue
                  label="Preferred courses"
                  value={
                    preferredCourses.length ? (
                      <span className="flex flex-wrap gap-1">
                        {preferredCourses.map((c) => (
                          <Badge key={c.id} tone="navy">
                            {c.name}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      "No preference"
                    )
                  }
                />
              </>
            ) : (
              <p className="text-body-sm text-muted">This trainer was not created from a volunteer application.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );

  const assignmentRows = (rows: typeof t.assignments, showEnd: boolean) =>
    rows.map((a) => (
      <TR key={a.id}>
        <TD mobile="full">
          <Link href={`/admin/centers/${a.center.id}`} className="block tap-highlight-none md:inline md:font-medium md:text-ink md:hover:text-navy">
            {a.center.name}
            <span className="block font-mono text-caption font-normal text-muted">{a.center.code}</span>
          </Link>
        </TD>
        <TD label="Course">{a.course?.name ?? <span className="text-caption text-muted">Any course</span>}</TD>
        <TD label="Batch">
          {a.batch ? (
            <Link href={`/admin/batches/${a.batch.id}`} className="text-body-sm hover:text-navy">
              {a.batch.name} <span className="font-mono text-caption text-muted">{a.batch.code}</span> <StatusBadge status={a.batch.status} className="ml-1" />
            </Link>
          ) : (
            <span className="text-caption text-muted">No specific batch</span>
          )}
        </TD>
        <TD label="Notes" className="text-caption text-muted md:max-w-[14rem]">
          {a.notes ?? "—"}
        </TD>
        <TD label="Assigned" className="text-muted md:whitespace-nowrap">
          {formatDate(a.assignedAt)}
        </TD>
        <TD label="Ended" className="text-muted md:whitespace-nowrap">
          {a.endedAt ? formatDate(a.endedAt) : <Badge tone="success">Active</Badge>}
        </TD>
        {showEnd && <TD mobile="actions">{canAssign && a.isActive ? <EndAssignmentButton assignmentId={a.id} label={`${a.center.name}${a.batch ? ` · ${a.batch.name}` : ""}`} /> : null}</TD>}
      </TR>
    ));

  const assignments = (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-muted">
          {activeAssignments.length} active assignment{activeAssignments.length === 1 ? "" : "s"} · {pastAssignments.length} ended
        </p>
        {canAssign && <AssignDrawer trainerId={t.id} trainerName={t.user.name} active={t.status === "ACTIVE"} />}
      </div>
      {t.assignments.length === 0 ? (
        <EmptyState icon={<MapPinned className="h-7 w-7" />} title="Not assigned to any center" description={t.status === "ACTIVE" ? "Use “Assign to center” to place this trainer at a training center, course or batch." : "Activate the trainer before assigning them."} />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Training center</TH>
              <TH>Course</TH>
              <TH>Batch</TH>
              <TH>Notes</TH>
              <TH>Assigned</TH>
              <TH>Ended</TH>
              <TH>Actions</TH>
            </tr>
          </THead>
          <TBody>
            {assignmentRows(activeAssignments, true)}
            {assignmentRows(pastAssignments, true)}
          </TBody>
        </TableWrap>
      )}
    </div>
  );

  const batches = (
    <TableWrap>
      <THead>
        <tr>
          <TH>Batch</TH>
          <TH>Course</TH>
          <TH>Center</TH>
          <TH>Schedule</TH>
          <TH className="text-center">Students</TH>
          <TH>Status</TH>
        </tr>
      </THead>
      <TBody>
        {t.batches.length === 0 && <EmptyRow colSpan={6}>No batches are led by this trainer.</EmptyRow>}
        {t.batches.map((b) => (
          <TR key={b.id}>
            <TD mobile="full">
              <Link href={`/admin/batches/${b.id}`} className="block tap-highlight-none md:inline md:font-medium md:text-ink md:hover:text-navy">
                {b.name}
                <span className="block font-mono text-caption font-normal text-muted">{b.code}</span>
              </Link>
            </TD>
            <TD label="Course">{b.course.name}</TD>
            <TD label="Center">
              {b.center.name} <span className="text-caption text-muted">({b.center.code})</span>
            </TD>
            <TD label="Schedule" className="text-caption">
              <span className="block">
                {formatDate(b.startDate)} – {formatDate(b.endDate)}
              </span>
              <span className="text-muted">
                {b.days.join(", ")} · {b.startTime}–{b.endTime}
              </span>
            </TD>
            <TD label="Students" className="tabular-nums md:text-center">
              {b._count.admissions} / {b.capacity}
            </TD>
            <TD label="Status">
              <StatusBadge status={b.status} />
            </TD>
          </TR>
        ))}
      </TBody>
    </TableWrap>
  );

  const studentsTab = (
    <TableWrap>
      <THead>
        <tr>
          <TH>Student</TH>
          <TH>Student ID</TH>
          <TH>Course</TH>
          <TH>Batch</TH>
          <TH>Center</TH>
          <TH>Admission</TH>
          <TH>Admitted</TH>
        </tr>
      </THead>
      <TBody>
        {students.length === 0 && <EmptyRow colSpan={7}>No active students in this trainer&rsquo;s batches.</EmptyRow>}
        {students.map((a) => (
          <TR key={a.id}>
            <TD mobile="full">
              <Link href={`/admin/students/${a.student.id}`} className="flex items-center gap-3 tap-highlight-none md:hover:text-navy">
                <Avatar name={a.student.name} src={a.student.photoUrl} size={40} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{a.student.name}</span>
                  <span className="block text-caption font-normal text-muted tabular-nums">{a.student.mobile}</span>
                </span>
              </Link>
            </TD>
            <TD label="Student ID">{a.student.studentId ? <span className="font-mono text-caption font-semibold text-navy">{a.student.studentId}</span> : <span className="text-caption text-muted">—</span>}</TD>
            <TD label="Course">{a.course.name}</TD>
            <TD label="Batch" className="text-caption">
              {a.batch.code} <StatusBadge status={a.batch.status} className="ml-1" />
            </TD>
            <TD label="Center">{a.center.name}</TD>
            <TD label="Admission">
              <Link href={`/admin/admissions/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                {a.admissionNo}
              </Link>
              <StatusBadge status={a.status} className="ml-1" />
            </TD>
            <TD label="Admitted" className="text-muted md:whitespace-nowrap">
              {formatDate(a.admittedAt)}
            </TD>
          </TR>
        ))}
      </TBody>
    </TableWrap>
  );

  const documents = (
    <Card>
      <CardHeader title="Documents" description="Carried over from the volunteer application." />
      {t.documents.length === 0 ? (
        <CardBody>
          <EmptyState icon={<FileText className="h-7 w-7" />} title="No documents on file" className="py-8" />
        </CardBody>
      ) : (
        <TableWrap className="max-md:px-4 max-md:pb-4 md:rounded-none md:border-0">
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
            {t.documents.map((d) => (
              <TR key={d.id}>
                <TD mobile="full" className="font-medium">
                  {docName.get(d.type) ?? titleCase(d.type)}
                </TD>
                <TD label="File">
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="block truncate text-caption font-semibold text-orange hover:underline md:max-w-[14rem]">
                    {d.name}
                  </a>
                  <span className="text-caption text-muted">
                    {d.mimeType ?? ""}
                    {d.size ? ` · ${(d.size / 1024).toFixed(0)} KB` : ""}
                  </span>
                </TD>
                <TD label="Status">
                  <StatusBadge status={d.status} />
                  {d.verifiedAt && <span className="block text-caption text-muted">{formatDate(d.verifiedAt)}</span>}
                </TD>
                <TD label="Remarks" className="text-caption text-muted md:max-w-[16rem]">
                  {d.remarks ?? "—"}
                </TD>
                <TD label="Uploaded" className="text-muted md:whitespace-nowrap">
                  {formatDate(d.createdAt)}
                </TD>
                <TD mobile="actions">
                  <div className="flex items-center gap-2 max-md:w-full max-md:justify-end">
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md px-2 text-caption font-semibold text-navy hover:underline md:min-h-0 md:px-0">
                      View
                    </a>
                    <DocumentActions docId={d.id} status={d.status} canUpdate={canUpdate} />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </Card>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Trainers", href: "/admin/trainers" }, { label: t.user.name }]}
        mobileTitle={t.trainerId}
        backHref="/admin/trainers"
        title={
          <span className="flex items-center gap-4">
            <Avatar name={t.user.name} src={t.user.avatarUrl} size={56} />
            <span>
              {t.user.name}
              <span className="mt-1 flex flex-wrap items-center gap-2 text-body-sm font-medium text-muted">
                <span className="font-mono text-navy">{t.trainerId}</span>
                <StatusBadge status={t.status} />
                <Badge tone="navy">{titleCase(t.level)} level</Badge>
              </span>
            </span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {t.user.mobile && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {t.user.mobile}
              </span>
            )}
            {t.user.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {t.user.email}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {location}
            </span>
          </span>
        }
        actions={
          <>
            {canAssign && <AssignDrawer trainerId={t.id} trainerName={t.user.name} active={t.status === "ACTIVE"} />}
            <TrainerActions trainer={{ id: t.id, trainerId: t.trainerId, status: t.status, qualification: t.qualification, skills: t.skills, languages: t.languages, bio: t.bio, user: { name: t.user.name, email: t.user.email, mobile: t.user.mobile } }} canUpdate={canUpdate} />
          </>
        }
      />

      {/* The app bar shows only the Trainer ID on phones – keep the face, name and status in the page. */}
      <div className="mb-4 flex items-center gap-3 lg:hidden">
        <Avatar name={t.user.name} src={t.user.avatarUrl} size={44} />
        <div className="min-w-0">
          <h2 className="text-h4 truncate text-navy">{t.user.name}</h2>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <Badge tone="navy">{titleCase(t.level)} level</Badge>
          </span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatsCard label="Active assignments" value={activeAssignments.length} icon={<MapPinned className="h-5 w-5" />} tone="navy" />
        <StatsCard label="Batches" value={t.batches.length} icon={<CalendarDays className="h-5 w-5" />} tone="orange" hint={`${t.batches.filter((b) => b.status === "ONGOING").length} ongoing`} />
        <StatsCard label="Active students" value={t.studentCount} icon={<GraduationCap className="h-5 w-5" />} tone="success" className="max-sm:col-span-2" />
      </div>

      <TabbedPanels
        items={[
          { value: "profile", label: "Profile" },
          { value: "assignments", label: "Assignments", count: activeAssignments.length },
          { value: "batches", label: "Batches", count: t.batches.length },
          { value: "students", label: "Students", count: students.length },
          { value: "documents", label: "Documents", count: t.documents.length },
        ]}
        panels={{ profile, assignments, batches, students: studentsTab, documents }}
      />
    </div>
  );
}
