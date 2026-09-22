"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCheck, ChevronLeft, ChevronRight, MessageSquarePlus, RotateCcw, Save } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn, dateInputValue, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert, EmptyState, SkeletonTable } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Avatar } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { BatchSelector, type BatchLite, type CenterLite, type CourseLite } from "@/components/admin/attendance/batch-selector";

type Status = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
const STATUSES: { value: Status; label: string; short: string; cls: string }[] = [
  { value: "PRESENT", label: "Present", short: "P", cls: "data-[on=true]:bg-success data-[on=true]:text-white data-[on=true]:border-success" },
  { value: "ABSENT", label: "Absent", short: "A", cls: "data-[on=true]:bg-danger data-[on=true]:text-white data-[on=true]:border-danger" },
  { value: "LATE", label: "Late", short: "L", cls: "data-[on=true]:bg-warning data-[on=true]:text-white data-[on=true]:border-warning" },
  { value: "LEAVE", label: "Leave", short: "Lv", cls: "data-[on=true]:bg-info data-[on=true]:text-white data-[on=true]:border-info" },
];
const STATUS_NAMES: Record<Status, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", LEAVE: "On leave" };

interface SheetStudent {
  admissionId: string;
  studentId: string;
  studentCode: string | null;
  name: string;
  photoUrl: string | null;
  admissionStatus: string;
  status: Status | null;
  remarks: string | null;
}
interface Sheet {
  batch: { id: string; code: string; name: string; course: string; center: { name: string; code: string }; startDate: string; endDate: string; days: string[]; status: string };
  date: string;
  students: SheetStudent[];
  marked: boolean;
}
type Mark = { status: Status | null; remarks: string };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  centers: CenterLite[];
  batches: BatchLite[];
  courses: CourseLite[];
  canMark: boolean;
  centerId: string;
  batchId: string;
  date: string;
  onSelection: (v: { centerId: string; batchId: string; date: string }) => void;
}

/** Daily attendance sheet: pick a batch and date, mark every student, save. */
export function MarkSheet({ centers, batches, courses, canMark, centerId, batchId, date, onSelection }: Props) {
  const [loaded, setLoaded] = React.useState<{ key: string; sheet: Sheet | null; error: string | null }>({ key: "", sheet: null, error: null });
  const [marks, setMarks] = React.useState<Record<string, Mark>>({});
  const [saving, setSaving] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  // Phone cards keep the remarks field out of the way until it is needed.
  const [remarkOpen, setRemarkOpen] = React.useState<Set<string>>(new Set());
  const today = dateInputValue(new Date());
  const key = batchId && date ? `${batchId}|${date}|${reloadKey}` : "";

  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;
    api
      .get<Sheet>(`/api/admin/attendance/sheet?batchId=${batchId}&date=${date}`)
      .then((d) => {
        if (cancelled) return;
        setLoaded({ key, sheet: d, error: null });
        setMarks(Object.fromEntries(d.students.map((s) => [s.studentId, { status: s.status, remarks: s.remarks ?? "" }])));
      })
      .catch((err) => !cancelled && setLoaded({ key, sheet: null, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [key, batchId, date]);

  const current = loaded.key === key ? loaded : null;
  const sheet = key ? (current?.sheet ?? null) : null;
  const error = key ? (current?.error ?? null) : null;
  const loading = !!key && !current;

  const dirty = !!sheet && sheet.students.some((s) => (marks[s.studentId]?.status ?? null) !== s.status || (marks[s.studentId]?.remarks ?? "") !== (s.remarks ?? ""));
  const markable = sheet?.students.filter((s) => s.admissionStatus === "ACTIVE" || s.admissionStatus === "ON_HOLD") ?? [];
  const counts = markable.reduce(
    (acc, s) => {
      const st = marks[s.studentId]?.status;
      if (st) acc[st]++;
      else acc.unmarked++;
      return acc;
    },
    { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0, unmarked: 0 }
  );
  const shiftDate = (days: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + days);
    onSelection({ centerId, batchId, date: dateInputValue(d) });
  };
  const setAll = (status: Status) => setMarks((m) => Object.fromEntries(markable.map((s) => [s.studentId, { status, remarks: m[s.studentId]?.remarks ?? "" }])));
  const set = (id: string, patch: Partial<Mark>) => setMarks((m) => ({ ...m, [id]: { status: m[id]?.status ?? null, remarks: m[id]?.remarks ?? "", ...patch } }));

  const save = async () => {
    if (!sheet) return;
    const records = markable.filter((s) => marks[s.studentId]?.status).map((s) => ({ studentId: s.studentId, status: marks[s.studentId]!.status as Status, remarks: marks[s.studentId]!.remarks.trim() || undefined }));
    if (records.length === 0) {
      toast.error("Nothing to save", "Mark at least one student first.");
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ marked: number }>("/api/admin/attendance/mark", { batchId: sheet.batch.id, date, records });
      toast.success(`Attendance saved for ${r.marked} student${r.marked === 1 ? "" : "s"}`, `${sheet.batch.code} · ${formatDate(date)}`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error("Could not save attendance", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const dateObj = date ? new Date(`${date}T00:00:00`) : null;
  const dayName = dateObj ? DAY_NAMES[dateObj.getDay()]! : "";
  const notClassDay = !!sheet && sheet.batch.days.length > 0 && !sheet.batch.days.some((d) => d.toLowerCase().startsWith(dayName.toLowerCase()));
  const beforeStart = !!sheet && date < dateInputValue(sheet.batch.startDate);
  const future = date > today;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
          <BatchSelector centers={centers} batches={batches} courses={courses} centerId={centerId} batchId={batchId} onChange={(v) => onSelection({ ...v, date })} statuses={["UPCOMING", "ONGOING"]} idPrefix="sheet" />
          <Field label="Date" htmlFor="sheet-date">
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" aria-label="Previous day" onClick={() => shiftDate(-1)} disabled={!date}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input id="sheet-date" type="date" value={date} max={today} onChange={(e) => onSelection({ centerId, batchId, date: e.target.value })} />
              <Button type="button" variant="outline" size="sm" aria-label="Next day" onClick={() => shiftDate(1)} disabled={!date || date >= today}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </Field>
        </div>
      </div>

      {!batchId ? (
        <EmptyState title="Select a batch" description="Choose a training center and an open batch to load its roster for the selected date." />
      ) : loading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : error ? (
        <Alert tone="danger" title="Could not load the sheet">
          {error}
        </Alert>
      ) : sheet ? (
        <>
          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-navy">
                {sheet.batch.name} <span className="font-mono text-caption text-muted">{sheet.batch.code}</span> <StatusBadge status={sheet.batch.status} className="ml-1" />
              </p>
              <p className="text-caption text-muted">
                {sheet.batch.course} · {sheet.batch.center.name} · {sheet.batch.days.join(", ") || "no schedule"} · {formatDate(date, "EEEE, dd MMM yyyy")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-caption">
              <Badge tone="success">Present {counts.PRESENT}</Badge>
              <Badge tone="danger">Absent {counts.ABSENT}</Badge>
              <Badge tone="warning">Late {counts.LATE}</Badge>
              <Badge tone="info">Leave {counts.LEAVE}</Badge>
              {counts.unmarked > 0 && <Badge>Unmarked {counts.unmarked}</Badge>}
              {sheet.marked && !dirty && <Badge tone="navy">Saved</Badge>}
              {dirty && <Badge tone="orange">Unsaved changes</Badge>}
            </div>
          </div>

          {future && <Alert tone="danger">Attendance cannot be marked for a future date.</Alert>}
          {beforeStart && <Alert tone="danger">This date is before the batch start date ({formatDate(sheet.batch.startDate)}).</Alert>}
          {!future && !beforeStart && notClassDay && <Alert tone="warning">{dayName} is not a scheduled class day for this batch ({sheet.batch.days.join(", ")}). You can still mark an extra session.</Alert>}
          {!canMark && <Alert tone="info">You can view this sheet but do not have permission to mark attendance.</Alert>}

          {sheet.students.length === 0 ? (
            <EmptyState title="No students in this batch" description="Admitted students appear here once their admission is confirmed." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="secondary" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={() => setAll("PRESENT")} disabled={!canMark || markable.length === 0}>
                  Mark all present
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAll("ABSENT")} disabled={!canMark || markable.length === 0}>
                  Mark all absent
                </Button>
                <Button type="button" size="sm" variant="ghost" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => setMarks(Object.fromEntries(sheet.students.map((s) => [s.studentId, { status: s.status, remarks: s.remarks ?? "" }])))} disabled={!dirty}>
                  Discard changes
                </Button>
                <span className="ml-auto hidden text-caption text-muted md:inline">P = Present · A = Absent · L = Late · Lv = Leave</span>
              </div>
              {/* ── Phone roster: one card per student with a full-width P/A/L/Lv control ── */}
              <ul className="space-y-3 md:hidden">
                {sheet.students.map((s) => {
                  const m = marks[s.studentId] ?? { status: null, remarks: "" };
                  const editable = canMark && (s.admissionStatus === "ACTIVE" || s.admissionStatus === "ON_HOLD") && !future && !beforeStart;
                  const showRemarks = !!m.remarks || remarkOpen.has(s.studentId);
                  return (
                    <li key={s.studentId} className={cn("card space-y-3 p-4", !m.status && editable && "border-warning/40 bg-warning-light/20")}>
                      <div className="flex items-center gap-3">
                        <Link href={`/admin/students/${s.studentId}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <Avatar name={s.name} src={s.photoUrl} size={40} />
                          <span className="min-w-0">
                            <span className="block truncate text-body font-semibold text-navy">{s.name}</span>
                            <span className="block font-mono text-caption text-muted">{s.studentCode ?? "—"}</span>
                          </span>
                        </Link>
                        <StatusBadge status={s.admissionStatus} />
                      </div>
                      <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="grid grid-cols-4 gap-1.5">
                        {STATUSES.map((st) => (
                          <button
                            key={st.value}
                            type="button"
                            role="radio"
                            aria-checked={m.status === st.value}
                            data-on={m.status === st.value}
                            disabled={!editable}
                            onClick={() => set(s.studentId, { status: st.value })}
                            className={cn(
                              "flex min-h-12 items-center justify-center rounded-md border border-line bg-white px-1 text-caption font-bold text-ink tap-highlight-none transition-colors duration-micro active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                              st.cls
                            )}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                      {showRemarks ? (
                        <Input value={m.remarks} onChange={(e) => set(s.studentId, { remarks: e.target.value })} placeholder="Remarks (optional)" disabled={!editable} aria-label={`Remarks for ${s.name}`} />
                      ) : (
                        <button
                          type="button"
                          disabled={!editable}
                          onClick={() => setRemarkOpen((r) => new Set(r).add(s.studentId))}
                          className="inline-flex min-h-11 items-center gap-1.5 text-caption font-semibold text-navy disabled:opacity-50"
                        >
                          <MessageSquarePlus className="h-4 w-4" aria-hidden /> Add remark
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              <TableWrap cards={false} className="hidden md:block">
                <THead>
                  <tr>
                    <TH>Student</TH>
                    <TH>Student ID</TH>
                    <TH>Admission</TH>
                    <TH>Attendance</TH>
                    <TH>Remarks</TH>
                  </tr>
                </THead>
                <TBody>
                  {sheet.students.map((s) => {
                    const m = marks[s.studentId] ?? { status: null, remarks: "" };
                    const editable = canMark && (s.admissionStatus === "ACTIVE" || s.admissionStatus === "ON_HOLD") && !future && !beforeStart;
                    return (
                      <TR key={s.studentId} className={cn(!m.status && editable && "bg-warning-light/30")}>
                        <TD>
                          <Link href={`/admin/students/${s.studentId}`} className="flex items-center gap-3 hover:text-navy">
                            <Avatar name={s.name} src={s.photoUrl} size={32} />
                            <span className="font-semibold">{s.name}</span>
                          </Link>
                        </TD>
                        <TD className="font-mono text-caption">{s.studentCode ?? "—"}</TD>
                        <TD>
                          <StatusBadge status={s.admissionStatus} />
                        </TD>
                        <TD>
                          <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="inline-flex gap-1">
                            {STATUSES.map((st) => (
                              <button
                                key={st.value}
                                type="button"
                                role="radio"
                                aria-checked={m.status === st.value}
                                aria-label={STATUS_NAMES[st.value]}
                                title={STATUS_NAMES[st.value]}
                                data-on={m.status === st.value}
                                disabled={!editable}
                                onClick={() => set(s.studentId, { status: st.value })}
                                className={cn("h-9 min-w-10 rounded-md border border-line bg-white px-2 text-caption font-bold text-ink transition-colors duration-micro hover:border-navy/40 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none", st.cls)}
                              >
                                {st.short}
                              </button>
                            ))}
                          </div>
                          {m.status && <span className="ml-2 text-caption text-muted">{STATUS_NAMES[m.status]}</span>}
                        </TD>
                        <TD>
                          <Input value={m.remarks} onChange={(e) => set(s.studentId, { remarks: e.target.value })} placeholder="Optional" disabled={!editable} aria-label={`Remarks for ${s.name}`} className="min-w-40 py-1.5" />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </TableWrap>
              <div className="hidden flex-col-reverse items-stretch gap-2 md:flex md:flex-row md:items-center md:justify-end">
                <p className="mr-auto text-caption text-muted">
                  {markable.length} of {sheet.students.length} students can be marked{sheet.students.length - markable.length > 0 ? ` (${sheet.students.length - markable.length} completed / dropped)` : ""}.
                </p>
                <Button type="button" leftIcon={<Save className="h-4 w-4" />} loading={saving} disabled={!canMark || future || beforeStart || markable.length === 0} onClick={() => void save()}>
                  {sheet.marked ? "Save changes" : "Save attendance"}
                </Button>
              </div>

              {/* Phones: "Mark all present" + Save pinned above the gesture area. */}
              <StickyActionBar desktop="hidden" innerClassName="gap-2">
                <Button type="button" variant="outline" size="md" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={() => setAll("PRESENT")} disabled={!canMark || markable.length === 0}>
                  All present
                </Button>
                <span className="flex-1 *:w-full">
                  <Button type="button" size="md" fullWidth leftIcon={<Save className="h-4 w-4" />} loading={saving} disabled={!canMark || future || beforeStart || markable.length === 0} onClick={() => void save()}>
                    {counts.unmarked > 0 ? `Save (${markable.length - counts.unmarked}/${markable.length})` : sheet.marked ? "Save changes" : "Save attendance"}
                  </Button>
                </span>
              </StickyActionBar>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
