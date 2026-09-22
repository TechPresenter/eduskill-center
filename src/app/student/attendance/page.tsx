import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { studentAttendance } from "@/server/attendance";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/stats";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { AttendanceRecordsList } from "@/components/student/mobile";

export const metadata: Metadata = { title: "Attendance" };

export default async function StudentAttendancePage() {
  const user = await requireStudent();
  const { records, summary } = await studentAttendance(user.student.id);
  const batchIds = summary.map((s) => s.batchId);
  const batches = batchIds.length ? await db.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, status: true, startDate: true, endDate: true, course: { select: { minAttendancePct: true } } } }) : [];
  const batchInfo = new Map(batches.map((b) => [b.id, b]));

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Attendance" mobileTitle="Attendance" description="Attendance is marked by your trainer after each class. Late arrivals count as present." />

      {summary.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-7 w-7" />} title="No attendance yet" description="Your attendance records appear here once classes begin." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {summary.map((s) => {
            const info = batchInfo.get(s.batchId);
            const required = info?.course.minAttendancePct ?? 75;
            const ok = s.pct >= required;
            return (
              <Card key={s.batchId}>
                <CardHeader title={s.batch.course.name} description={`${s.batch.name} (${s.batch.code})${info ? ` · ${formatDate(info.startDate)} – ${formatDate(info.endDate)}` : ""}`} action={info ? <StatusBadge status={info.status} /> : undefined} />
                <CardBody className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-h1 text-navy tabular-nums">{s.pct}%</p>
                      <p className="text-caption text-muted">
                        {s.present + s.late} of {s.held} classes attended · required {required}%
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${ok ? "bg-success-light text-green-700" : "bg-warning-light text-amber-700"}`}>{ok ? "On track" : `Below ${required}%`}</span>
                  </div>
                  <ProgressBar value={s.pct} tone={ok ? "success" : "warning"} />
                  <div className="grid grid-cols-4 gap-2 text-center text-caption">
                    <Stat label="Present" value={s.present} tone="text-green-700" />
                    <Stat label="Late" value={s.late} tone="text-amber-700" />
                    <Stat label="Leave" value={s.leave} tone="text-blue-700" />
                    <Stat label="Absent" value={s.absent} tone="text-danger" />
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Records – month-grouped cards on phones, table from md up. */}
      <section aria-label="Attendance records" className="md:hidden">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-overline text-muted">Attendance records</h2>
          <span className="text-caption text-muted tabular-nums">{records.length}</span>
        </div>
        <AttendanceRecordsList
          records={records.map((r) => ({ id: r.id, date: r.date.toISOString(), status: r.status, remarks: r.remarks, courseName: r.batch.course.name, batchName: r.batch.name }))}
        />
      </section>

      <Card className="hidden md:block">
        <CardHeader title="Attendance records" description={`${records.length} entries`} />
        <TableWrap cards={false} className="rounded-none border-0">
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Batch</TH>
              <TH>Status</TH>
              <TH>Remarks</TH>
            </tr>
          </THead>
          <TBody>
            {records.length === 0 ? (
              <EmptyRow colSpan={4}>No attendance marked yet.</EmptyRow>
            ) : (
              records.map((r) => (
                <TR key={r.id}>
                  <TD className="text-body-sm">{formatDate(r.date, "EEE, dd MMM yyyy")}</TD>
                  <TD className="text-body-sm">
                    {r.batch.course.name}
                    <p className="text-caption text-muted">{r.batch.name}</p>
                  </TD>
                  <TD>
                    <StatusBadge status={r.status} />
                  </TD>
                  <TD className="text-body-sm text-muted">{r.remarks ?? "—"}</TD>
                </TR>
              ))
            )}
          </TBody>
        </TableWrap>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md bg-surface py-2">
      <p className={`text-h4 tabular-nums ${tone}`}>{value}</p>
      <p className="text-caption font-semibold tracking-wide text-muted uppercase">{label}</p>
    </div>
  );
}
