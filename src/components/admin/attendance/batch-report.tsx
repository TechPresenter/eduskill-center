"use client";

import * as React from "react";
import Link from "next/link";
import { BellRing, Download } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn, dateInputValue, formatDate } from "@/lib/utils";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/tabs";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { StatsCard, ProgressBar } from "@/components/ui/stats";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { Gate } from "@/components/admin/pickers/permission-gate";
import { BatchSelector, type BatchLite, type CenterLite, type CourseLite } from "@/components/admin/attendance/batch-selector";

export type Preset = "daily" | "weekly" | "monthly" | "custom";

interface Report {
  batch: { id: string; code: string; name: string; status: string; startDate: string; endDate: string; days: string[]; course: { name: string; minAttendancePct: number }; center: { name: string; code: string } };
  held: number;
  rows: { studentId: string; studentCode: string | null; name: string; present: number; absent: number; late: number; leave: number; held: number; pct: number }[];
  daily: { date: string; present: number; absent: number; late: number; leave: number }[];
}

export function presetRange(preset: Preset, from: string, to: string): { from: string; to: string } {
  const today = new Date();
  const t = dateInputValue(today);
  if (preset === "daily") return { from: t, to: t };
  if (preset === "weekly") return { from: dateInputValue(new Date(today.getTime() - 6 * 86400000)), to: t };
  if (preset === "monthly") return { from: dateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)), to: t };
  return { from, to };
}

interface Props {
  centers: CenterLite[];
  batches: BatchLite[];
  courses: CourseLite[];
  can: { export: boolean; alerts: boolean };
  centerId: string;
  batchId: string;
  preset: Preset;
  from: string;
  to: string;
  onSelection: (v: { centerId: string; batchId: string; preset: Preset; from: string; to: string }) => void;
}

/** Batch attendance report with daily / weekly / monthly / custom ranges, per-student and per-day totals. */
export function BatchReport({ centers, batches, courses, can, centerId, batchId, preset, from, to, onSelection }: Props) {
  const [loaded, setLoaded] = React.useState<{ key: string; report: Report | null; error: string | null }>({ key: "", report: null, error: null });
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertBusy, setAlertBusy] = React.useState(false);
  const range = presetRange(preset, from, to);
  const rangeQs = `${range.from ? `&from=${range.from}` : ""}${range.to ? `&to=${range.to}` : ""}`;
  const incompleteRange = preset === "custom" && (!from || !to);
  const key = batchId && !incompleteRange ? `${batchId}|${rangeQs}` : "";

  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;
    api
      .get<Report>(`/api/admin/attendance/report?batchId=${batchId}${rangeQs}`)
      .then((d) => !cancelled && setLoaded({ key, report: d, error: null }))
      .catch((err) => !cancelled && setLoaded({ key, report: null, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [key, batchId, rangeQs]);

  const current = loaded.key === key ? loaded : null;
  const report = key ? (current?.report ?? null) : null;
  const error = key ? (current?.error ?? null) : null;
  const loading = !!key && !current;

  const min = report?.batch.course.minAttendancePct ?? 75;
  const avg = report && report.rows.length ? Math.round((report.rows.reduce((s, r) => s + r.pct, 0) / report.rows.length) * 10) / 10 : 0;
  const below = report ? report.rows.filter((r) => r.held > 0 && r.pct < min).length : 0;
  const exportHref = (mode: "summary" | "daily" | "records") => `/api/admin/attendance/export?batchId=${batchId}${rangeQs}${mode === "summary" ? "" : `&mode=${mode}`}`;

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <BatchSelector centers={centers} batches={batches} courses={courses} centerId={centerId} batchId={batchId} onChange={(v) => onSelection({ ...v, preset, from, to })} idPrefix="report" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div>
            <span className="mb-1.5 block text-body-sm font-medium text-ink">Period</span>
            <SegmentedControl
              scrollable
              className="w-full lg:w-auto"
              value={preset}
              onChange={(v) => onSelection({ centerId, batchId, preset: v as Preset, from, to })}
              items={[
                { value: "daily", label: "Today" },
                { value: "weekly", label: "Last 7 days" },
                { value: "monthly", label: "This month" },
                { value: "custom", label: "Custom" },
              ]}
            />
          </div>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="From" htmlFor="rep-from">
                <Input id="rep-from" type="date" value={from} max={to || undefined} onChange={(e) => onSelection({ centerId, batchId, preset, from: e.target.value, to })} />
              </Field>
              <Field label="To" htmlFor="rep-to">
                <Input id="rep-to" type="date" value={to} min={from || undefined} onChange={(e) => onSelection({ centerId, batchId, preset, from, to: e.target.value })} />
              </Field>
            </div>
          )}
          <p className="text-caption text-muted lg:ml-auto lg:pb-3">
            {range.from && range.to ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "Entire batch"}
          </p>
        </div>
      </div>

      {!batchId ? (
        <EmptyState title="Select a batch" description="Pick a batch to see attendance totals per student and per day." />
      ) : incompleteRange ? (
        <Alert tone="info">Choose both a start and an end date for the custom period.</Alert>
      ) : loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : error ? (
        <Alert tone="danger" title="Could not load the report">
          {error}
        </Alert>
      ) : report ? (
        <>
          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-navy">
                {report.batch.name} <span className="font-mono text-caption text-muted">{report.batch.code}</span> <StatusBadge status={report.batch.status} className="ml-1" />
              </p>
              <p className="text-caption text-muted">
                {report.batch.course.name} · {report.batch.center.name} · {formatDate(report.batch.startDate)} – {formatDate(report.batch.endDate)} · minimum {min}%
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              {can.export ? (
                <>
                  <a href={exportHref("summary")} className={buttonClasses({ variant: "outline", size: "sm" })} download>
                    <Download className="h-4 w-4" /> Students CSV
                  </a>
                  <a href={exportHref("daily")} className={buttonClasses({ variant: "outline", size: "sm" })} download>
                    <Download className="h-4 w-4" /> Daily CSV
                  </a>
                  <a href={exportHref("records")} className={buttonClasses({ variant: "outline", size: "sm" })} download>
                    <Download className="h-4 w-4" /> Records CSV
                  </a>
                </>
              ) : (
                <span className={cn(buttonClasses({ variant: "outline", size: "sm" }), "col-span-2 cursor-not-allowed opacity-50")} title="You do not have the export permission">
                  <Download className="h-4 w-4" /> Export CSV
                </span>
              )}
              <Gate allowed={can.alerts && report.batch.status !== "COMPLETED"} reason={report.batch.status === "COMPLETED" ? "Batch is completed" : "You need the attendance.mark or notifications.send permission"}>
                <Button size="sm" variant="secondary" className="col-span-2 sm:col-auto" leftIcon={<BellRing className="h-4 w-4" />} onClick={() => setAlertOpen(true)}>
                  Send low-attendance alerts
                </Button>
              </Gate>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsCard label="Classes held" value={report.held} hint={range.from ? "in the selected period" : "since batch start"} tone="navy" />
            <StatsCard label="Students" value={report.rows.length} tone="info" />
            <StatsCard label="Average attendance" value={`${avg}%`} tone={avg >= min ? "success" : "warning"} />
            <StatsCard label={`Below ${min}%`} value={below} hint={report.held === 0 ? "no classes yet" : below === 0 ? "everyone on track" : "need attention"} tone={below > 0 ? "orange" : "success"} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
            <TableWrap>
              <THead>
                <tr>
                  <TH>Student</TH>
                  <TH className="text-center">Held</TH>
                  <TH className="text-center">Present</TH>
                  <TH className="text-center">Late</TH>
                  <TH className="text-center">Absent</TH>
                  <TH className="text-center">Leave</TH>
                  <TH>Attendance</TH>
                </tr>
              </THead>
              <TBody>
                {report.rows.length === 0 && <EmptyRow colSpan={7}>No students in this batch.</EmptyRow>}
                {report.rows.map((r) => (
                  <TR key={r.studentId}>
                    <TD primary>
                      <Link href={`/admin/students/${r.studentId}`} className="font-semibold hover:text-navy">
                        {r.name}
                      </Link>
                      <span className="block font-mono text-caption font-normal text-muted">{r.studentCode ?? "—"}</span>
                      {/* The five count columns are dropped on phones – one compact line replaces them. */}
                      <span className="mt-1 block text-caption font-normal text-muted md:hidden">
                        {r.held} held · <span className="font-semibold text-success-dark">{r.present} present</span> · <span className="font-semibold text-amber-700">{r.late} late</span> ·{" "}
                        <span className="font-semibold text-danger">{r.absent} absent</span> · <span className="font-semibold text-blue-700">{r.leave} leave</span>
                      </span>
                    </TD>
                    <TD mobile="hidden" className="text-center tabular-nums">
                      {r.held}
                    </TD>
                    <TD mobile="hidden" className="text-center text-success-dark tabular-nums">
                      {r.present}
                    </TD>
                    <TD mobile="hidden" className="text-center text-amber-700 tabular-nums">
                      {r.late}
                    </TD>
                    <TD mobile="hidden" className="text-center text-danger tabular-nums">
                      {r.absent}
                    </TD>
                    <TD mobile="hidden" className="text-center text-blue-700 tabular-nums">
                      {r.leave}
                    </TD>
                    <TD label="" className="md:min-w-40">
                      <ProgressBar value={r.pct} label={r.held ? undefined : "No classes"} tone={r.pct >= min ? "success" : r.pct >= min - 15 ? "warning" : "danger"} />
                      <span className="mt-1 flex items-center gap-2 text-caption text-muted">
                        {r.pct}%{r.held > 0 && r.pct < min && <Badge tone="danger">Below minimum</Badge>}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
            <TableWrap>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH className="text-center">Present</TH>
                  <TH className="text-center">Late</TH>
                  <TH className="text-center">Absent</TH>
                  <TH className="text-center">Leave</TH>
                  <TH className="text-center">%</TH>
                </tr>
              </THead>
              <TBody>
                {report.daily.length === 0 && <EmptyRow colSpan={6}>No classes held in this period.</EmptyRow>}
                {[...report.daily].reverse().map((d) => {
                  const total = d.present + d.absent + d.late + d.leave;
                  const pct = total ? Math.round(((d.present + d.late) / total) * 100) : 0;
                  return (
                    <TR key={d.date}>
                      <TD primary>
                        <span className="flex items-center justify-between gap-2">
                          <span className="whitespace-nowrap">{formatDate(d.date, "EEE, dd MMM")}</span>
                          <span className={cn("font-semibold tabular-nums md:hidden", pct >= min ? "text-success-dark" : "text-amber-700")}>{pct}%</span>
                        </span>
                        <span className="mt-1 block text-caption font-normal text-muted md:hidden">
                          <span className="font-semibold text-success-dark">{d.present} present</span> · <span className="font-semibold text-amber-700">{d.late} late</span> ·{" "}
                          <span className="font-semibold text-danger">{d.absent} absent</span> · <span className="font-semibold text-blue-700">{d.leave} leave</span>
                        </span>
                      </TD>
                      <TD mobile="hidden" className="text-center text-success-dark tabular-nums">
                        {d.present}
                      </TD>
                      <TD mobile="hidden" className="text-center text-amber-700 tabular-nums">
                        {d.late}
                      </TD>
                      <TD mobile="hidden" className="text-center text-danger tabular-nums">
                        {d.absent}
                      </TD>
                      <TD mobile="hidden" className="text-center text-blue-700 tabular-nums">
                        {d.leave}
                      </TD>
                      <TD mobile="hidden" className={cn("text-center font-semibold tabular-nums", pct >= min ? "text-success-dark" : "text-amber-700")}>
                        {pct}%
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          </div>

          <ConfirmDialog
            open={alertOpen}
            onClose={() => setAlertOpen(false)}
            title="Send low-attendance alerts"
            description={`Every active student of ${report.batch.code} whose overall attendance is below ${min}% (after at least 5 classes) receives an alert by their preferred channels.`}
            confirmLabel="Send alerts"
            loading={alertBusy}
            onConfirm={async () => {
              setAlertBusy(true);
              try {
                const r = await api.post<{ sent: number }>("/api/admin/attendance/alerts", { batchId });
                toast.success(r.sent ? `Alerts sent to ${r.sent} student${r.sent === 1 ? "" : "s"}` : "No alerts needed", r.sent ? undefined : "No active student is below the minimum attendance yet.");
                setAlertOpen(false);
              } catch (err) {
                toast.error("Could not send alerts", errorMessage(err));
              } finally {
                setAlertBusy(false);
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}
