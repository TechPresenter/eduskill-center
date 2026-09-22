import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, GraduationCap, Users, MapPin, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { batchFormOptions, getBatchAdmin } from "@/app/admin/batches/queries";
import { PageHeader, KeyValue, Avatar } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatsCard, ProgressBar } from "@/components/ui/stats";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { orNotFound } from "@/components/admin/shared/server";
import { BatchHeaderActions } from "@/components/admin/batches/batch-actions";

export const metadata: Metadata = { title: "Batch · Foundation Admin" };

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("batches.view");
  const { id } = await params;
  const batch = await orNotFound(getBatchAdmin(id));
  const perms = { update: hasPermission(user, "batches.update"), delete: hasPermission(user, "batches.delete"), assign: hasPermission(user, "trainers.assign") };
  const options = perms.update || perms.assign ? await batchFormOptions() : { centers: [], trainers: [] };
  const activeStudents = batch.roster.filter((a) => a.status === "ACTIVE" || a.status === "ON_HOLD").length;
  const seats = batch.seats;
  const pct = seats.capacity ? Math.round((seats.occupied / seats.capacity) * 100) : 0;
  const canAttendance = hasPermission(user, "attendance.view");
  const avgAttendance = batch.attendance.rows.length ? Math.round(batch.attendance.rows.reduce((a, r) => a + r.pct, 0) / batch.attendance.rows.length) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {batch.name}
            <StatusBadge status={batch.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">{batch.code}</span>
            <span>· {batch.course.name}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <Link href={`/admin/centers/${batch.center.id}`} className="hover:underline">
                {batch.center.name} ({batch.center.code})
              </Link>
            </span>
          </span>
        }
        backHref="/admin/batches"
        mobileTitle={batch.code}
        breadcrumbs={[{ label: "Batches", href: "/admin/batches" }, { label: batch.code }]}
        actions={<BatchHeaderActions batch={{ id: batch.id, code: batch.code, name: batch.name, status: batch.status, occupied: seats.occupied, activeStudents, trainerId: batch.trainerId }} perms={perms} trainers={options.trainers} centerId={batch.centerId} />}
      />

      {/* The app bar shows only the batch code on phones – keep the name and status in the page. */}
      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <h2 className="text-h4 min-w-0 text-navy">{batch.name}</h2>
        <StatusBadge status={batch.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatsCard label="Capacity" value={seats.capacity} icon={<Users className="h-5 w-5" />} tone="navy" />
        <StatsCard label="Occupied" value={seats.occupied} hint={`${formatNumber(activeStudents)} admitted · ${formatNumber(batch.reserving.length)} reserved`} icon={<GraduationCap className="h-5 w-5" />} tone="orange" />
        <StatsCard label="Available" value={seats.available} icon={<Users className="h-5 w-5" />} tone={seats.available === 0 ? "warning" : "success"} />
        <StatsCard label="Avg. attendance" value={avgAttendance === null ? "—" : `${avgAttendance}%`} hint={`${formatNumber(batch.attendance.held)} class day${batch.attendance.held === 1 ? "" : "s"} marked`} icon={<ClipboardCheck className="h-5 w-5" />} tone="info" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Seat meter" description="Seats are held by active admissions and by approved applications awaiting payment/confirmation." />
            <CardBody>
              <ProgressBar value={seats.occupied} max={seats.capacity} label={`${seats.occupied} of ${seats.capacity} seats (${pct}%)`} tone={seats.available === 0 ? "danger" : pct > 80 ? "warning" : "success"} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Roster" description={`${batch.roster.length} admission${batch.roster.length === 1 ? "" : "s"} in this batch.`} action={canAttendance ? <ButtonLink href={`/admin/attendance?batchId=${batch.id}`} variant="outline" size="sm">Attendance register</ButtonLink> : undefined} />
            <TableWrap className="rounded-none border-0">
              <THead>
                <tr>
                  <TH>Student</TH>
                  <TH>Admission</TH>
                  <TH className="text-right">Attendance</TH>
                  <TH className="text-right">Progress</TH>
                  <TH>Certificate</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {batch.roster.length === 0 && <EmptyRow colSpan={6}>No students admitted yet.</EmptyRow>}
                {batch.roster.map((a) => (
                  <TR key={a.id}>
                    <TD primary>
                      <span className="flex items-start justify-between gap-2">
                        <Link href={`/admin/students/${a.student.id}`} className="flex min-w-0 items-center gap-3 hover:text-navy">
                          <Avatar name={a.student.name} src={a.student.photoUrl} size={32} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{a.student.name}</span>
                            <span className="block text-caption font-normal text-muted">{a.student.studentId ?? a.student.mobile}</span>
                          </span>
                        </Link>
                        <span className="shrink-0 md:hidden">
                          <StatusBadge status={a.status} />
                        </span>
                      </span>
                    </TD>
                    <TD label="Admission">
                      <Link href={`/admin/admissions/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                        {a.admissionNo}
                      </Link>
                      <span className="block text-caption text-muted">{formatDate(a.admittedAt)}</span>
                    </TD>
                    <TD label="Attendance" className="text-right tabular-nums">
                      {a.attendancePct === null ? "—" : `${a.attendancePct}%`}
                    </TD>
                    <TD label="Progress" className="text-right tabular-nums">
                      {a.completionPct === null ? "—" : `${a.completionPct}%`}
                    </TD>
                    <TD label="Certificate" className="text-caption">
                      {a.certificate ? <span className="font-mono">{a.certificate.certificateNo}</span> : a.progress?.certificateEligible ? <Badge tone="success">Eligible</Badge> : <span className="text-muted">—</span>}
                    </TD>
                    <TD mobile="hidden">
                      <StatusBadge status={a.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </Card>

          <Card>
            <CardHeader title="Applications holding a seat" description="Approved applications that have not yet become admissions." />
            <TableWrap className="rounded-none border-0">
              <THead>
                <tr>
                  <TH>Application</TH>
                  <TH>Applicant</TH>
                  <TH className="text-right">Payable</TH>
                  <TH className="text-right">Paid</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {batch.reserving.length === 0 && <EmptyRow colSpan={5}>No applications are reserving seats.</EmptyRow>}
                {batch.reserving.map((a) => (
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
                    <TD label="Applicant">
                      <Link href={`/admin/students/${a.student.id}`} className="hover:text-navy">
                        {a.student.name}
                      </Link>
                      <span className="block text-caption text-muted">{a.student.studentId ?? ""}</span>
                    </TD>
                    <TD label="Payable" className="text-right tabular-nums">
                      {formatINR(a.payableAmount)}
                    </TD>
                    <TD label="Paid" className="text-right tabular-nums">
                      {formatINR(a.paidAmount)}
                    </TD>
                    <TD mobile="hidden">
                      <StatusBadge status={a.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </Card>

          <Card>
            <CardHeader title="Attendance summary" description={batch.attendance.held ? `${batch.attendance.held} class day${batch.attendance.held === 1 ? "" : "s"} recorded.` : "No attendance has been marked yet."} />
            {batch.attendance.daily.length > 0 && (
              <TableWrap className="rounded-none border-0">
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH className="text-right">Present</TH>
                    <TH className="text-right">Late</TH>
                    <TH className="text-right">Absent</TH>
                    <TH className="text-right">Leave</TH>
                  </tr>
                </THead>
                <TBody>
                  {batch.attendance.daily.slice(-12).reverse().map((d) => (
                    <TR key={String(d.date)}>
                      <TD primary>
                        {formatDate(d.date)}
                        <span className="mt-1 block text-caption font-normal text-muted md:hidden">
                          <span className="font-semibold text-success-dark">{d.present} present</span> · <span className="font-semibold text-amber-700">{d.late} late</span> ·{" "}
                          <span className="font-semibold text-danger">{d.absent} absent</span> · {d.leave} leave
                        </span>
                      </TD>
                      <TD mobile="hidden" className="text-right tabular-nums text-success-dark">
                        {d.present}
                      </TD>
                      <TD mobile="hidden" className="text-right tabular-nums text-amber-700">
                        {d.late}
                      </TD>
                      <TD mobile="hidden" className="text-right tabular-nums text-danger">
                        {d.absent}
                      </TD>
                      <TD mobile="hidden" className="text-right tabular-nums">
                        {d.leave}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            )}
            {batch.attendance.daily.length > 12 && <p className="px-5 py-3 text-caption text-muted">Showing the latest 12 of {batch.attendance.daily.length} days.</p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Schedule" />
            <CardBody className="space-y-3">
              <KeyValue label="Dates" value={`${formatDate(batch.startDate)} – ${formatDate(batch.endDate)}`} />
              <KeyValue label="Days" value={batch.days.join(", ") || "—"} />
              <KeyValue label="Time" value={`${batch.startTime} – ${batch.endTime}`} />
              <KeyValue label="Room" value={batch.room ?? "—"} />
              <KeyValue label="Course" value={<Link href={`/admin/courses/${batch.course.id}`} className="text-navy hover:underline">{batch.course.name} ({batch.course.code})</Link>} />
              <KeyValue label="Min. attendance" value={`${batch.course.minAttendancePct}% of ${batch.course.totalClasses} classes`} />
              <KeyValue label="Created" value={formatDate(batch.createdAt)} />
              {batch.notes && <KeyValue label="Notes" value={<span className="whitespace-pre-line">{batch.notes}</span>} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Trainer" />
            <CardBody>
              {batch.trainer ? (
                <div className="flex items-start gap-3">
                  <Avatar name={batch.trainer.user.name} size={40} />
                  <div className="min-w-0 text-body-sm">
                    <Link href={`/admin/trainers/${batch.trainer.id}`} className="font-semibold text-navy hover:underline">
                      {batch.trainer.user.name}
                    </Link>
                    <p className="font-mono text-caption text-muted">
                      {batch.trainer.trainerId} · {titleCase(batch.trainer.level)} level
                    </p>
                    <p className="text-caption text-muted">{[batch.trainer.user.mobile, batch.trainer.user.email].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ) : (
                <p className="text-body-sm text-muted">No trainer assigned yet.</p>
              )}
              {batch.trainerAssignments.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-caption text-muted">
                  {batch.trainerAssignments.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span>
                        {a.trainer.user.name} · {formatDate(a.assignedAt)}
                        {a.endedAt ? ` → ${formatDate(a.endedAt)}` : ""}
                      </span>
                      <Badge tone={a.isActive ? "success" : "neutral"}>{a.isActive ? "Active" : "Ended"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Center" />
            <CardBody className="space-y-2 text-body-sm">
              <Link href={`/admin/centers/${batch.center.id}`} className="inline-flex items-center gap-1 font-semibold text-navy hover:underline">
                {batch.center.name} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <p className="text-muted">
                {batch.center.block.name}, {batch.center.district.name}, {batch.center.state.name}
              </p>
              <p className="font-mono text-caption text-muted">{batch.center.code}</p>
              <div className="pt-2">
                <ButtonLink href={`/admin/batches?centerId=${batch.center.id}`} variant="outline" size="sm" leftIcon={<CalendarDays className="h-3.5 w-3.5" />}>
                  Other batches here
                </ButtonLink>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
