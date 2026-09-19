"use client";

import * as React from "react";
import { Phone, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { Drawer } from "@/components/ui/modal";
import { Avatar, KeyValue } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ProgressBar, RingProgress } from "@/components/ui/stats";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { ErrorState, SkeletonTable } from "@/components/ui/feedback";
import type { BatchOption } from "@/components/trainer/types";

interface StudentRow {
  admissionId: string;
  admissionNo: string;
  status: string;
  admittedAt: string;
  student: { id: string; name: string; studentId: string | null; photoUrl: string | null; mobile: string; gender: string | null };
  batch: { id: string; code: string; name: string; status: string; course: { name: string } };
  attendancePct: number;
  classesHeld: number;
  classesAttended: number;
  assignmentsTotal: number;
  assignmentsCompleted: number;
  assessmentAvgPct: number;
  completionPct: number;
}

function tone(p: number): "success" | "warning" | "danger" {
  return p >= 75 ? "success" : p >= 60 ? "warning" : "danger";
}

export function StudentsClient({ batches, initialBatchId }: { batches: BatchOption[]; initialBatchId: string }) {
  const [q, setQ] = React.useState("");
  const [batchId, setBatchId] = React.useState(batches.some((b) => b.id === initialBatchId) ? initialBatchId : "");
  const [status, setStatus] = React.useState("");
  const [rows, setRows] = React.useState<StudentRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<StudentRow | null>(null);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (batchId) params.set("batchId", batchId);
      if (status) params.set("status", status);
      setError(null);
      api
        .get<StudentRow[]>(`/api/trainer/students?${params.toString()}`)
        .then((d) => {
          if (!cancelled) setRows(d);
        })
        .catch((e) => {
          if (!cancelled) setError(errorMessage(e));
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, batchId, status, reload]);

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Search" htmlFor="q">
          <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, student ID or mobile" leftIcon={<Search className="h-4 w-4" />} />
        </Field>
        <Field label="Batch" htmlFor="batch">
          <Select id="batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="All batches" options={batches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={[{ value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On hold" }, { value: "COMPLETED", label: "Completed" }]} />
        </Field>
      </div>

      {error ? (
        <ErrorState description={error} onRetry={() => setReload((r) => r + 1)} />
      ) : rows === null ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Student ID</TH>
              <TH>Batch</TH>
              <TH>Status</TH>
              <TH>Attendance</TH>
              <TH>Assignments</TH>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={6}>No students match your filters.</EmptyRow>
            ) : (
              rows.map((r) => (
                <TR key={r.admissionId} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={r.student.name} src={r.student.photoUrl} size={36} />
                      <button type="button" className="text-left font-medium text-ink hover:text-navy" onClick={() => setSelected(r)}>
                        {r.student.name}
                      </button>
                    </div>
                  </TD>
                  <TD className="font-mono text-xs">{r.student.studentId ?? "—"}</TD>
                  <TD>
                    <p className="max-w-[16rem] truncate">{r.batch.name}</p>
                    <p className="text-xs text-muted">{r.batch.code}</p>
                  </TD>
                  <TD>
                    <StatusBadge status={r.status} />
                  </TD>
                  <TD>
                    <span className={cn("font-semibold", r.attendancePct >= 75 ? "text-green-700" : r.attendancePct >= 60 ? "text-amber-700" : "text-danger")}>{r.attendancePct}%</span>
                    <span className="ml-1 text-xs text-muted">
                      ({r.classesAttended}/{r.classesHeld})
                    </span>
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
      {rows && rows.length > 0 && <p className="mt-3 text-xs text-muted">{rows.length} student{rows.length === 1 ? "" : "s"}</p>}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.student.name} description={selected?.student.studentId ?? "Student ID pending"}>
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={selected.student.name} src={selected.student.photoUrl} size={64} />
              <div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  {selected.student.gender && <Badge tone="neutral">{titleCase(selected.student.gender)}</Badge>}
                </div>
                <a href={`tel:${selected.student.mobile}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:underline">
                  <Phone className="h-4 w-4" /> {selected.student.mobile}
                </a>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <KeyValue label="Batch" value={`${selected.batch.name} (${selected.batch.code})`} />
              <KeyValue label="Course" value={selected.batch.course.name} />
              <KeyValue label="Admission" value={`${selected.admissionNo} · ${formatDate(selected.admittedAt)}`} />
            </div>
            <div className="flex items-center justify-around rounded-xl bg-surface p-4">
              <RingProgress value={selected.attendancePct} label="Attendance" size={88} />
              <RingProgress value={selected.completionPct} label="Completion" size={88} />
            </div>
            <div className="space-y-3">
              <ProgressBar value={selected.classesAttended} max={selected.classesHeld || 1} label={`Classes attended (${selected.classesAttended}/${selected.classesHeld})`} tone={tone(selected.attendancePct)} />
              <ProgressBar value={selected.assignmentsCompleted} max={selected.assignmentsTotal || 1} label={`Assignments submitted (${selected.assignmentsCompleted}/${selected.assignmentsTotal})`} tone="navy" />
              <ProgressBar value={selected.assessmentAvgPct} label="Assessment average" tone={tone(selected.assessmentAvgPct)} />
            </div>
            <p className="text-xs text-muted">Documents and personal records are only available to the Foundation staff.</p>
          </div>
        )}
      </Drawer>
    </>
  );
}
