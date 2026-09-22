"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileText, Paperclip } from "lucide-react";
import { cn, formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, KeyValue } from "@/components/ui/misc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar, StatsCard } from "@/components/ui/stats";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";

interface Batch {
  id: string;
  code: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  days: string[];
  room: string | null;
  capacity: number;
  notes: string | null;
  admitted: number;
  course: { name: string; code: string; durationText: string; totalClasses: number };
  center: { name: string; code: string; address: string };
}
interface RosterRow {
  admissionId: string;
  admissionNo: string;
  status: string;
  student: { id: string; name: string; studentId: string | null; photoUrl: string | null; mobile: string };
  attendancePct: number;
  classesHeld: number;
  classesAttended: number;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  completionPct: number;
}
interface Report {
  held: number;
  rows: { studentId: string; studentCode: string | null; name: string; present: number; absent: number; late: number; leave: number; held: number; pct: number }[];
  daily: { date: string; present: number; absent: number; late: number; leave: number }[];
}
interface AssignmentRow {
  id: string;
  title: string;
  dueDate: string | null;
  maxMarks: number;
  submissions: number;
  attachmentUrl: string | null;
}
interface AssessmentRow {
  id: string;
  title: string;
  type: string;
  date: string | null;
  maxMarks: number;
  passingMarks: number;
  weightage: number;
  results: number;
}
interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string | null;
  createdAt: string;
  mine: boolean;
}
interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

function pctTone(p: number): "success" | "warning" | "danger" {
  return p >= 75 ? "success" : p >= 60 ? "warning" : "danger";
}

export function BatchTabs({ batch, roster, report, assignments, assessments, materials, announcements, avgAttendance }: { batch: Batch; roster: RosterRow[]; report: Report; assignments: AssignmentRow[]; assessments: AssessmentRow[]; materials: MaterialRow[]; announcements: AnnouncementRow[]; avgAttendance: number }) {
  const [tab, setTab] = React.useState("overview");
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-6"
        items={[
          { value: "overview", label: "Overview" },
          { value: "students", label: "Students", count: roster.length },
          { value: "attendance", label: "Attendance" },
          { value: "coursework", label: "Coursework", count: assignments.length + assessments.length + materials.length },
          { value: "announcements", label: "Announcements", count: announcements.length },
        ]}
      />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Batch details" />
            <CardBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <KeyValue label="Batch code" value={batch.code} />
                <KeyValue label="Status" value={<StatusBadge status={batch.status} />} />
                <KeyValue label="Course" value={`${batch.course.name} (${batch.course.code})`} />
                <KeyValue label="Duration" value={`${batch.course.durationText}${batch.course.totalClasses ? ` · ${batch.course.totalClasses} classes` : ""}`} />
                <KeyValue label="Dates" value={`${formatDate(batch.startDate)} – ${formatDate(batch.endDate)}`} />
                <KeyValue label="Schedule" value={`${batch.days.join(", ")} · ${batch.startTime}–${batch.endTime}`} />
                <KeyValue label="Room" value={batch.room ?? "—"} />
                <KeyValue label="Seats" value={`${batch.admitted} admitted / ${batch.capacity} capacity`} />
                <KeyValue label="Center" value={`${batch.center.name} (${batch.center.code})`} className="sm:col-span-2" />
                <KeyValue label="Address" value={batch.center.address} className="sm:col-span-2" />
              </div>
            </CardBody>
          </Card>
          <div className="space-y-4">
            <StatsCard label="Classes held" value={report.held} tone="navy" />
            <StatsCard label="Average attendance" value={`${avgAttendance}%`} tone={avgAttendance >= 75 ? "success" : "warning"} />
            <Card>
              <CardHeader title="Trainer notes" />
              <CardBody>
                <p className="text-body-sm whitespace-pre-wrap text-muted">{batch.notes || "No notes from the Foundation for this batch."}</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === "students" && (
        <TableWrap>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Student ID</TH>
              <TH>Mobile</TH>
              <TH>Status</TH>
              <TH>Attendance</TH>
              <TH>Assignments</TH>
            </tr>
          </THead>
          <TBody>
            {roster.length === 0 ? (
              <EmptyRow colSpan={6}>No students admitted to this batch yet.</EmptyRow>
            ) : (
              roster.map((r) => (
                <TR key={r.admissionId}>
                  <TD mobile="full">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.student.name} src={r.student.photoUrl} size={36} />
                      <span className="font-medium">{r.student.name}</span>
                    </div>
                  </TD>
                  <TD className="font-mono text-caption">{r.student.studentId ?? "—"}</TD>
                  <TD>{r.student.mobile}</TD>
                  <TD>
                    <StatusBadge status={r.status} />
                  </TD>
                  <TD className="min-w-[10rem]">
                    <ProgressBar value={r.attendancePct} tone={pctTone(r.attendancePct)} label={`${r.classesAttended}/${r.classesHeld}`} />
                  </TD>
                  <TD>
                    {r.assignmentsCompleted} / {r.assignmentsTotal}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </TableWrap>
      )}

      {tab === "attendance" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-sm text-muted">
              {report.held} class{report.held === 1 ? "" : "es"} held so far.
            </p>
            <div className="flex gap-2">
              <ButtonLink href={`/trainer/attendance?batchId=${batch.id}`} size="sm" variant="navy">
                Mark attendance
              </ButtonLink>
              <a href={withBasePath(`/api/trainer/attendance/report?batchId=${batch.id}&range=all&format=csv`)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3.5 text-body-sm font-semibold text-ink ring-focus transition-colors duration-micro hover:border-navy/40 hover:bg-surface motion-reduce:transition-none sm:min-h-9">
                <Download className="h-4 w-4" /> CSV
              </a>
            </div>
          </div>
          <TableWrap>
            <THead>
              <tr>
                <TH>Student</TH>
                <TH>Present</TH>
                <TH>Late</TH>
                <TH>Absent</TH>
                <TH>Leave</TH>
                <TH>Attendance %</TH>
              </tr>
            </THead>
            <TBody>
              {report.rows.length === 0 ? (
                <EmptyRow colSpan={6}>No attendance recorded yet.</EmptyRow>
              ) : (
                report.rows.map((r) => (
                  <TR key={r.studentId}>
                    <TD mobile="full">
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 font-mono text-caption text-muted">{r.studentCode}</span>
                    </TD>
                    <TD>{r.present}</TD>
                    <TD>{r.late}</TD>
                    <TD>{r.absent}</TD>
                    <TD>{r.leave}</TD>
                    <TD>
                      <span className={cn("font-semibold tabular-nums", r.pct >= 75 ? "text-success-dark" : r.pct >= 60 ? "text-amber-700" : "text-danger")}>{r.pct}%</span>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </TableWrap>
          {report.daily.length > 0 && (
            <Card>
              <CardHeader title="Day-wise summary" description="Most recent classes first." />
              <CardBody className="p-0">
                <TableWrap className="rounded-none border-0">
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH>Present</TH>
                      <TH>Late</TH>
                      <TH>Absent</TH>
                      <TH>Leave</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {[...report.daily].reverse().slice(0, 30).map((d) => (
                      <TR key={d.date}>
                        <TD mobile="full">{formatDate(d.date, "EEE, dd MMM yyyy")}</TD>
                        <TD>{d.present}</TD>
                        <TD>{d.late}</TD>
                        <TD>{d.absent}</TD>
                        <TD>{d.leave}</TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "coursework" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader title="Assignments" action={<ButtonLink href={`/trainer/coursework?batchId=${batch.id}`} size="xs" variant="outline">Manage</ButtonLink>} />
            <CardBody className="p-0">
              {assignments.length === 0 ? (
                <EmptyState title="No assignments yet" size="sm" bare className="px-5 py-8" />
              ) : (
                <ul className="divide-y divide-line">
                  {assignments.map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <p className="text-body font-semibold text-ink">{a.title}</p>
                      <p className="text-caption text-muted">
                        {a.dueDate ? `Due ${formatDateTime(a.dueDate)}` : "No due date"} · {a.maxMarks} marks · {a.submissions} submitted
                      </p>
                      {a.attachmentUrl && (
                        <a href={a.attachmentUrl} className="mt-1 inline-flex min-h-11 items-center gap-1 text-caption font-semibold text-navy hover:underline">
                          <Paperclip className="h-3 w-3" /> Attachment
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Assessments" action={<ButtonLink href={`/trainer/assessments?batchId=${batch.id}`} size="xs" variant="outline">Manage</ButtonLink>} />
            <CardBody className="p-0">
              {assessments.length === 0 ? (
                <EmptyState title="No assessments yet" size="sm" bare className="px-5 py-8" />
              ) : (
                <ul className="divide-y divide-line">
                  {assessments.map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-body font-semibold text-ink">{a.title}</p>
                        <Badge tone="navy">{titleCase(a.type)}</Badge>
                      </div>
                      <p className="text-caption text-muted">
                        {a.date ? formatDate(a.date) : "Date TBA"} · {a.maxMarks} marks (pass {a.passingMarks}) · {a.results} results
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Study materials" action={<ButtonLink href={`/trainer/materials?batchId=${batch.id}`} size="xs" variant="outline">Manage</ButtonLink>} />
            <CardBody className="p-0">
              {materials.length === 0 ? (
                <EmptyState title="No materials yet" size="sm" bare className="px-5 py-8" />
              ) : (
                <ul className="divide-y divide-line">
                  {materials.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 px-5 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lavender text-navy">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-body font-semibold text-ink hover:text-navy hover:underline">
                          {m.title}
                        </a>
                        <p className="text-caption text-muted">
                          {(m.fileType ?? "file").toUpperCase()} · {formatDate(m.createdAt)}
                          {m.mine ? " · Uploaded by you" : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "announcements" &&
        (announcements.length === 0 ? (
          <EmptyState title="No announcements for this batch" action={<Link href={`/trainer/announcements?batchId=${batch.id}`} className="inline-flex min-h-11 items-center text-body-sm font-semibold text-orange hover:underline">Post an announcement</Link>} />
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <Card key={a.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 text-h4 text-navy">{a.title}</h3>
                    <span className="shrink-0 text-caption text-muted">{formatDateTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-body whitespace-pre-wrap text-ink">{a.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        ))}
    </>
  );
}
