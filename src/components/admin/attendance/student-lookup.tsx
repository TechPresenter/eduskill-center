"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Alert, EmptyState, Skeleton, SkeletonTable } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/stats";
import { Avatar } from "@/components/ui/misc";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { withBasePath } from "@/lib/base-path";

interface StudentHit {
  id: string;
  name: string;
  studentId: string | null;
  mobile: string;
  photoUrl: string | null;
}
interface StudentAttendance {
  student: { id: string; name: string; studentId: string | null; mobile: string; photoUrl: string | null };
  records: { id: string; date: string; status: string; remarks: string | null; batch: { id: string; name: string; code: string; course: { name: string } } }[];
  summary: { batchId: string; batch: { id: string; name: string; code: string; course: { name: string } }; present: number; absent: number; late: number; leave: number; held: number; pct: number }[];
}

interface Props {
  canExport: boolean;
  studentId: string;
  onSelect: (studentId: string) => void;
}

/** Search a student and show their attendance across batches. */
export function StudentLookup({ canExport, studentId, onSelect }: Props) {
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState<{ key: string; hits: StudentHit[] }>({ key: "", hits: [] });
  const [loaded, setLoaded] = React.useState<{ key: string; data: StudentAttendance | null; error: string | null }>({ key: "", data: null, error: null });
  const [batchSel, setBatchSel] = React.useState<{ studentId: string; batchId: string }>({ studentId: "", batchId: "" });
  const term = q.trim();
  const searchKey = term.length >= 2 ? term : "";

  React.useEffect(() => {
    if (!searchKey) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get<{ items: StudentHit[] }>(`/api/admin/students?q=${encodeURIComponent(searchKey)}&limit=8`)
        .then((d) => !cancelled && setSearch({ key: searchKey, hits: d.items }))
        .catch(() => !cancelled && setSearch({ key: searchKey, hits: [] }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchKey]);

  React.useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    api
      .get<StudentAttendance>(`/api/admin/attendance/student?studentId=${studentId}`)
      .then((d) => !cancelled && setLoaded({ key: studentId, data: d, error: null }))
      .catch((err) => !cancelled && setLoaded({ key: studentId, data: null, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const hits = searchKey && search.key === searchKey ? search.hits : null;
  const searching = !!searchKey && search.key !== searchKey;
  const current = loaded.key === studentId ? loaded : null;
  const data = studentId ? (current?.data ?? null) : null;
  const error = studentId ? (current?.error ?? null) : null;
  const loading = !!studentId && !current;
  const batchFilter = batchSel.studentId === studentId ? batchSel.batchId : "";
  const toggleBatch = (id: string) => setBatchSel({ studentId, batchId: batchFilter === id ? "" : id });
  const records = data ? data.records.filter((r) => !batchFilter || r.batch.id === batchFilter).slice(0, 100) : [];

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label htmlFor="att-student-q" className="mb-1.5 block text-body-sm font-medium text-ink">
          Find a student
        </label>
        <Input id="att-student-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name, Student ID or mobile number" leftIcon={<Search className="h-4 w-4" />} autoComplete="off" />
        {searching && <Skeleton className="mt-2 h-10 w-full" />}
        {!searching && hits && (
          <ul className="mt-2 divide-y divide-line rounded-md border border-line" role="listbox" aria-label="Matching students">
            {hits.length === 0 && <li className="px-3 py-2 text-body-sm text-muted">No students match “{q.trim()}”.</li>}
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={h.id === studentId}
                  className={cn("flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left text-body-sm tap-highlight-none hover:bg-surface active:bg-surface sm:min-h-0", h.id === studentId && "bg-lavender/60")}
                  onClick={() => {
                    onSelect(h.id);
                    setQ("");
                  }}
                >
                  <Avatar name={h.name} src={h.photoUrl} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{h.name}</span>
                    <span className="block font-mono text-caption text-muted">{h.studentId ?? h.mobile}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!studentId ? (
        <EmptyState title="Search for a student" description="Their attendance for every batch is summarised here with the full day-by-day record." />
      ) : loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : error ? (
        <Alert tone="danger" title="Could not load attendance">
          {error}
        </Alert>
      ) : data ? (
        <>
          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/admin/students/${data.student.id}`} className="flex items-center gap-3 hover:text-navy">
              <Avatar name={data.student.name} src={data.student.photoUrl} size={44} />
              <span>
                <span className="block font-semibold text-navy">{data.student.name}</span>
                <span className="block font-mono text-caption text-muted">{data.student.studentId ?? data.student.mobile}</span>
              </span>
            </Link>
            {canExport ? (
              <a href={withBasePath(`/api/admin/attendance/export?studentId=${data.student.id}${batchFilter ? `&batchId=${batchFilter}` : ""}`)} className={buttonClasses({ variant: "outline", size: "sm" })} download>
                <Download className="h-4 w-4" /> Export CSV
              </a>
            ) : (
              <span className={cn(buttonClasses({ variant: "outline", size: "sm" }), "cursor-not-allowed opacity-50")} title="You do not have the export permission">
                <Download className="h-4 w-4" /> Export CSV
              </span>
            )}
          </div>
          {data.summary.length === 0 ? (
            <EmptyState title="No attendance recorded" description="Attendance appears once it is marked for one of the student's batches." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.summary.map((b) => (
                <Card key={b.batchId} className={cn("cursor-pointer", batchFilter === b.batchId && "ring-2 ring-orange/40")} onClick={() => toggleBatch(b.batchId)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleBatch(b.batchId)} aria-pressed={batchFilter === b.batchId}>
                  <CardBody>
                    <p className="font-semibold text-navy">{b.batch.name}</p>
                    <p className="text-caption text-muted">
                      {b.batch.code} · {b.batch.course.name}
                    </p>
                    <ProgressBar className="mt-3" value={b.pct} label="Attendance" tone={b.pct >= 75 ? "success" : b.pct >= 50 ? "warning" : "danger"} />
                    <p className="mt-2 text-caption text-muted">
                      {b.held} held · {b.present} present · {b.late} late · {b.absent} absent · {b.leave} leave
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
          {records.length > 0 && (
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
                {records.map((r) => (
                  <TR key={r.id}>
                    <TD primary>
                      <span className="flex items-center justify-between gap-2">
                        <span className="whitespace-nowrap">{formatDate(r.date, "EEE, dd MMM yyyy")}</span>
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
          {data.records.length > 100 && <p className="text-caption text-muted">Showing the latest 100 of {data.records.length} records – export the CSV for the full history.</p>}
        </>
      ) : null}
    </div>
  );
}
