"use client";

import * as React from "react";
import { CheckCheck, Download, Save } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Field } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/tabs";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/ui/stats";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Alert, EmptyState, ErrorState, SkeletonList, SkeletonTable } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { BatchPicker } from "@/components/trainer/batch-picker";
import { useApi } from "@/components/trainer/use-api";
import { AttendanceRoster, ATTENDANCE_STATUSES, type AttendanceMark, type AttendanceStatus, type AttendanceStudent } from "@/components/trainer/mobile";
import type { BatchOption } from "@/components/trainer/types";

type Range = "week" | "month" | "all";

interface Sheet {
  batch: { id: string; code: string; name: string; course: string; center: { name: string; code: string }; startDate: string; endDate: string; days: string[]; status: string };
  date: string;
  students: AttendanceStudent[];
  marked: boolean;
}
interface ReportRow {
  studentId: string;
  studentCode: string | null;
  name: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  held: number;
  pct: number;
}
interface Report {
  batch: { id: string; code: string; name: string };
  range: Range;
  from: string | null;
  to: string | null;
  held: number;
  rows: ReportRow[];
  daily: { date: string; present: number; absent: number; late: number; leave: number }[];
}
type Marks = Record<string, AttendanceMark>;

function pctClass(p: number) {
  return p >= 75 ? "text-success-dark" : p >= 60 ? "text-warning-dark" : "text-danger";
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadReportCsv(report: Report, today: string) {
  const lines = [["Student ID", "Name", "Classes held", "Present", "Late", "Absent", "Leave", "Attendance %"].map(csvCell).join(",")];
  for (const r of report.rows) lines.push([r.studentCode ?? "", r.name, r.held, r.present, r.late, r.absent, r.leave, r.pct].map(csvCell).join(","));
  lines.push("");
  lines.push(["Date", "Present", "Late", "Absent", "Leave"].map(csvCell).join(","));
  for (const d of report.daily) lines.push([d.date.slice(0, 10), d.present, d.late, d.absent, d.leave].map(csvCell).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${report.batch.code}-${report.range}-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AttendanceClient({ batches, initialBatchId, today, disabled }: { batches: BatchOption[]; initialBatchId: string; today: string; disabled: boolean }) {
  const defaultBatch = batches.find((b) => b.id === initialBatchId)?.id ?? batches.find((b) => b.status === "ONGOING")?.id ?? batches[0]?.id ?? "";
  const [tab, setTab] = React.useState<"mark" | "reports">("mark");
  const [batchId, setBatchId] = React.useState(defaultBatch);
  const batch = batches.find((b) => b.id === batchId);

  if (batches.length === 0) {
    return <EmptyState title="No batches to mark attendance for" description="Attendance opens once the Foundation assigns you to a batch." />;
  }

  return (
    <>
      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as "mark" | "reports")}
        fullWidth
        className="mb-5 sm:max-w-sm"
        items={[
          { value: "mark", label: "Mark attendance" },
          { value: "reports", label: "Reports" },
        ]}
      />
      {tab === "mark" ? (
        <MarkTab batches={batches} batch={batch} batchId={batchId} onBatchChange={setBatchId} today={today} disabled={disabled} />
      ) : (
        <ReportsTab batches={batches} batch={batch} batchId={batchId} onBatchChange={setBatchId} today={today} />
      )}
    </>
  );
}

// ───────────────────────────── Mark attendance ─────────────────────────────

function MarkTab({ batches, batch, batchId, onBatchChange, today, disabled }: { batches: BatchOption[]; batch: BatchOption | undefined; batchId: string; onBatchChange: (id: string) => void; today: string; disabled: boolean }) {
  const [rawDate, setRawDate] = React.useState(today);
  const [marks, setMarks] = React.useState<Marks>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // The chosen date is clamped to [batch start, today] – derived, so it follows batch changes without an effect.
  const notStarted = !!batch && batch.startDate > today;
  const date = !rawDate ? "" : rawDate > today ? today : batch && rawDate < batch.startDate && !notStarted ? batch.startDate : rawDate;
  const canLoad = !!batchId && !!date && !notStarted;
  const url = canLoad ? `/api/trainer/attendance?batchId=${encodeURIComponent(batchId)}&date=${encodeURIComponent(date)}` : null;

  const {
    data: sheet,
    error,
    loading,
    reload,
  } = useApi<Sheet>(url, (s) => {
    const next: Marks = {};
    for (const st of s.students) next[st.studentId] = { status: st.status, remarks: st.remarks ?? "" };
    setMarks(next);
    setSaveError(null);
  });

  const readOnly = disabled || sheet?.batch.status === "COMPLETED" || sheet?.batch.status === "CANCELLED";
  const markable = React.useMemo(() => sheet?.students.filter((s) => s.admissionStatus !== "COMPLETED") ?? [], [sheet]);
  const markedCount = markable.filter((s) => marks[s.studentId]?.status).length;
  const counts = ATTENDANCE_STATUSES.map((s) => ({ ...s, n: markable.filter((st) => marks[st.studentId]?.status === s.value).length }));
  const remaining = markable.length - markedCount;

  const setStatus = React.useCallback((studentId: string, status: AttendanceStatus) => setMarks((m) => ({ ...m, [studentId]: { status, remarks: m[studentId]?.remarks ?? "" } })), []);
  const setRemarks = React.useCallback((studentId: string, remarks: string) => setMarks((m) => ({ ...m, [studentId]: { status: m[studentId]?.status ?? null, remarks } })), []);
  const markAllPresent = () => setMarks((m) => Object.fromEntries(markable.map((s) => [s.studentId, { status: "PRESENT" as AttendanceStatus, remarks: m[s.studentId]?.remarks ?? "" }])));

  const save = async () => {
    if (!sheet) return;
    const records = markable
      .map((s) => ({ studentId: s.studentId, status: marks[s.studentId]?.status ?? null, remarks: marks[s.studentId]?.remarks.trim() || null }))
      .filter((r): r is { studentId: string; status: AttendanceStatus; remarks: string | null } => !!r.status);
    if (records.length === 0) {
      setSaveError("Mark at least one student before saving.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const r = await api.post<{ marked: number }>("/api/trainer/attendance", { batchId, date, records });
      toast.success("Attendance saved", `${r.marked} student${r.marked === 1 ? "" : "s"} marked for ${formatDate(date)}`);
      reload();
    } catch (err) {
      const msg = err instanceof ApiClientError ? (Object.values(err.fieldErrors)[0] ?? err.message) : errorMessage(err);
      setSaveError(msg);
      toast.error("Could not save attendance", msg);
    } finally {
      setSaving(false);
    }
  };

  const showRoster = canLoad && !error && !loading && sheet && sheet.students.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BatchPicker batches={batches} value={batchId} onChange={onBatchChange} className="sm:col-span-2" />
          <Field label="Date" htmlFor="attendance-date" hint={batch ? `Up to today only.` : undefined}>
            <DateInput id="attendance-date" value={date} min={batch?.startDate || undefined} max={today} onChange={(e) => setRawDate(e.target.value)} />
          </Field>
          {batch && (
            <p className="text-caption text-muted sm:col-span-3">
              {batch.courseName} · {batch.centerName} · {batch.days.join(", ")} {batch.startTime}–{batch.endTime}
              {batch.room ? ` · ${batch.room}` : ""}
            </p>
          )}
        </CardBody>
      </Card>

      {notStarted && batch && (
        <Alert tone="info" title="This batch has not started yet">
          Attendance can be marked from {formatDate(batch.startDate)}.
        </Alert>
      )}
      {sheet?.batch.status === "COMPLETED" && (
        <Alert tone="info" title="This batch is completed">
          Attendance is read-only. Contact the Foundation office for corrections.
        </Alert>
      )}

      {!canLoad ? null : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !sheet ? (
        <SkeletonList rows={6} />
      ) : sheet.students.length === 0 ? (
        <EmptyState title="No students admitted to this batch yet" description="Students appear here once their admission is confirmed by the Foundation." />
      ) : (
        <Card>
          <CardHeader
            title={formatDate(date, "EEEE, dd MMM yyyy")}
            description={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-ink tabular-nums">
                  {markedCount} of {markable.length} marked
                </span>
                {sheet.marked && (
                  <Badge tone="success" dot>
                    Previously saved
                  </Badge>
                )}
                {counts
                  .filter((c) => c.n > 0)
                  .map((c) => (
                    <span key={c.value} className="text-caption">
                      {c.label}: <strong className="text-ink tabular-nums">{c.n}</strong>
                    </span>
                  ))}
              </span>
            }
            action={
              !readOnly && (
                <Button variant="outline" size="sm" onClick={markAllPresent} leftIcon={<CheckCheck className="h-4 w-4" />}>
                  Mark all present
                </Button>
              )
            }
          />
          <CardBody className="p-0">
            <AttendanceRoster students={sheet.students} marks={marks} readOnly={!!readOnly} onStatus={setStatus} onRemarks={setRemarks} />
            {saveError && (
              <div className="px-5 pt-4">
                <Alert tone="danger">{saveError}</Alert>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Sticky on phones (and above the bottom nav), an ordinary form footer from lg up. */}
      {showRoster && !readOnly && (
        <StickyActionBar innerClassName="justify-between lg:justify-end">
          <p className="min-w-0 flex-1 text-caption text-muted lg:hidden">
            {remaining > 0 ? `${remaining} not marked` : "Everyone marked"}
          </p>
          <p className="hidden text-body-sm text-muted lg:mr-auto lg:block">
            {remaining > 0 ? `${remaining} student${remaining === 1 ? "" : "s"} not marked yet. Unmarked students are left unchanged.` : "Everyone is marked."}
          </p>
          <Button onClick={() => void save()} loading={saving} disabled={markedCount === 0} leftIcon={<Save className="h-4 w-4" />} size="lg" className="shrink-0">
            Save attendance
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}

// ───────────────────────────── Reports ─────────────────────────────

const RANGES: { value: Range; label: string; hint: string }[] = [
  { value: "week", label: "This week", hint: "Monday to today" },
  { value: "month", label: "This month", hint: "1st of the month to today" },
  { value: "all", label: "All time", hint: "Every class held in this batch" },
];

function ReportsTab({ batches, batch, batchId, onBatchChange, today }: { batches: BatchOption[]; batch: BatchOption | undefined; batchId: string; onBatchChange: (id: string) => void; today: string }) {
  const [range, setRange] = React.useState<Range>("all");
  const { data: report, error, loading, reload } = useApi<Report>(batchId ? `/api/trainer/attendance/report?batchId=${encodeURIComponent(batchId)}&range=${range}` : null);

  const avg = report && report.rows.length ? Math.round((report.rows.reduce((s, r) => s + r.pct, 0) / report.rows.length) * 10) / 10 : 0;
  const low = report ? report.rows.filter((r) => r.held > 0 && r.pct < 75).length : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <BatchPicker batches={batches} value={batchId} onChange={onBatchChange} className="lg:max-w-md lg:flex-1" />
          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm font-medium text-ink">Period</span>
            <SegmentedControl value={range} onChange={(v) => setRange(v as Range)} fullWidth items={RANGES.map((r) => ({ value: r.value, label: r.label }))} className="lg:w-auto" />
            <span className="text-caption text-muted">{RANGES.find((r) => r.value === range)?.hint}</span>
          </div>
        </CardBody>
      </Card>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !report ? (
        <SkeletonTable rows={6} cols={6} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard label="Classes held" value={report.held} tone="navy" hint={RANGES.find((r) => r.value === range)?.label} />
            <StatsCard label="Average attendance" value={`${avg}%`} tone={avg >= 75 ? "success" : "warning"} hint={`${report.rows.length} students`} />
            <StatsCard label="Below 75%" value={low} tone={low ? "warning" : "success"} hint="Students needing follow-up" />
          </div>
          <Card>
            <CardHeader
              title="Student-wise summary"
              description={batch ? `${batch.name} · ${batch.code}` : undefined}
              action={
                <Button variant="outline" size="sm" onClick={() => downloadReportCsv(report, today)} disabled={report.rows.length === 0} leftIcon={<Download className="h-4 w-4" />}>
                  Export CSV
                </Button>
              }
            />
            <CardBody className="p-0">
              <TableWrap className="md:rounded-none md:border-0 md:shadow-none">
                <THead>
                  <tr>
                    <TH>Student</TH>
                    <TH>Held</TH>
                    <TH>Present</TH>
                    <TH>Late</TH>
                    <TH>Absent</TH>
                    <TH>Leave</TH>
                    <TH>Attendance %</TH>
                  </tr>
                </THead>
                <TBody>
                  {report.rows.length === 0 ? (
                    <EmptyRow colSpan={7}>No students in this batch.</EmptyRow>
                  ) : (
                    report.rows.map((r) => (
                      <TR key={r.studentId}>
                        <TD mobile="full">
                          <span className="font-medium">{r.name}</span>
                          <span className="ml-2 font-mono text-caption text-muted">{r.studentCode ?? ""}</span>
                        </TD>
                        <TD className="tabular-nums">{r.held}</TD>
                        <TD className="tabular-nums">{r.present}</TD>
                        <TD className="tabular-nums">{r.late}</TD>
                        <TD className="tabular-nums">{r.absent}</TD>
                        <TD className="tabular-nums">{r.leave}</TD>
                        <TD>
                          <span className={cn("font-semibold tabular-nums", r.held ? pctClass(r.pct) : "text-muted")}>{r.held ? `${r.pct}%` : "—"}</span>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </TableWrap>
            </CardBody>
          </Card>
          {report.daily.length > 0 && (
            <Card>
              <CardHeader title="Day-wise summary" description="Most recent classes first." />
              <CardBody className="p-0">
                <TableWrap className="md:rounded-none md:border-0 md:shadow-none">
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
                    {[...report.daily]
                      .reverse()
                      .slice(0, 31)
                      .map((d) => (
                        <TR key={d.date}>
                          <TD mobile="full">{formatDate(d.date, "EEE, dd MMM yyyy")}</TD>
                          <TD className="tabular-nums">{d.present}</TD>
                          <TD className="tabular-nums">{d.late}</TD>
                          <TD className="tabular-nums">{d.absent}</TD>
                          <TD className="tabular-nums">{d.leave}</TD>
                        </TR>
                      ))}
                  </TBody>
                </TableWrap>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
