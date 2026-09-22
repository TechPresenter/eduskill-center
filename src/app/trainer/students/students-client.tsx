"use client";

import * as React from "react";
import { Phone, Search, Users } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Avatar, KeyValue } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ProgressBar, RingProgress } from "@/components/ui/stats";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState, ErrorState, SkeletonCardList, SkeletonTable } from "@/components/ui/feedback";
import { StudentCard, attendanceTextClass, attendanceTone, type TrainerStudentRow } from "@/components/trainer/mobile";
import type { BatchOption } from "@/components/trainer/types";

export function StudentsClient({ batches, initialBatchId }: { batches: BatchOption[]; initialBatchId: string }) {
  const [q, setQ] = React.useState("");
  const [batchId, setBatchId] = React.useState(batches.some((b) => b.id === initialBatchId) ? initialBatchId : "");
  const [status, setStatus] = React.useState("");
  const [rows, setRows] = React.useState<TrainerStudentRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<TrainerStudentRow | null>(null);
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
        .get<TrainerStudentRow[]>(`/api/trainer/students?${params.toString()}`)
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

  const filtered = !!q.trim() || !!batchId || !!status;

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Search" htmlFor="q">
          <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, student ID or mobile" type="search" enterKeyHint="search" leftIcon={<Search className="h-4 w-4" />} />
        </Field>
        <Field label="Batch" htmlFor="batch">
          <Select
            id="batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="All batches"
            options={batches.map((b) => ({
              value: b.id,
              label: `${b.name} (${b.code})`,
            }))}
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "ON_HOLD", label: "On hold" },
              { value: "COMPLETED", label: "Completed" },
            ]}
          />
        </Field>
      </div>

      {error ? (
        <ErrorState description={error} onRetry={() => setReload((r) => r + 1)} />
      ) : rows === null ? (
        <>
          <SkeletonCardList count={4} lines={2} className="lg:hidden" />
          <div className="hidden lg:block">
            <SkeletonTable rows={5} cols={6} cards={false} />
          </div>
        </>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title={filtered ? "No students match your filters" : "No students in your batches yet"}
          description={filtered ? "Try a different batch, status or search term." : "Students appear here once the Foundation confirms their admission to one of your batches."}
        />
      ) : (
        <>
          {/* Phones and tablets: one card per student, tap to open the quick profile. */}
          <ul className="space-y-3 lg:hidden">
            {rows.map((r) => (
              <StudentCard key={r.admissionId} row={r} onOpen={() => setSelected(r)} />
            ))}
          </ul>

          {/* Desktop: the same roster as a table. */}
          <div className="hidden lg:block">
            <TableWrap cards={false}>
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
                {rows.map((r) => (
                  <TR key={r.admissionId} className="cursor-pointer" onClick={() => setSelected(r)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.student.name} src={r.student.photoUrl} size={36} />
                        <button type="button" className="text-left font-medium text-ink ring-focus hover:text-navy" onClick={() => setSelected(r)}>
                          {r.student.name}
                        </button>
                      </div>
                    </TD>
                    <TD className="font-mono text-caption">{r.student.studentId ?? "—"}</TD>
                    <TD>
                      <p className="max-w-[16rem] truncate">{r.batch.name}</p>
                      <p className="text-caption text-muted">{r.batch.code}</p>
                    </TD>
                    <TD>
                      <StatusBadge status={r.status} />
                    </TD>
                    <TD>
                      <span className={cn("font-semibold tabular-nums", attendanceTextClass(r.attendancePct))}>{r.attendancePct}%</span>
                      <span className="ml-1 text-caption text-muted tabular-nums">
                        ({r.classesAttended}/{r.classesHeld})
                      </span>
                    </TD>
                    <TD className="tabular-nums">
                      {r.assignmentsCompleted} / {r.assignmentsTotal}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}
      {rows && rows.length > 0 && (
        <p className="mt-3 text-caption text-muted">
          {rows.length} student{rows.length === 1 ? "" : "s"}
        </p>
      )}

      <ResponsiveSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.student.name} description={selected?.student.studentId ?? "Student ID pending"} size="md">
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={selected.student.name} src={selected.student.photoUrl} size={64} />
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  {selected.student.gender && <Badge tone="neutral">{titleCase(selected.student.gender)}</Badge>}
                </div>
                <a href={`tel:${selected.student.mobile}`} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-body font-semibold text-navy hover:underline">
                  <Phone className="h-4 w-4" aria-hidden /> {selected.student.mobile}
                </a>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <KeyValue label="Batch" value={`${selected.batch.name} (${selected.batch.code})`} />
              <KeyValue label="Course" value={selected.batch.course.name} />
              <KeyValue label="Admission" value={`${selected.admissionNo} · ${formatDate(selected.admittedAt)}`} />
            </div>
            <div className="flex items-center justify-around rounded-lg bg-surface p-4">
              <RingProgress value={selected.attendancePct} label="Attendance" size={88} />
              <RingProgress value={selected.completionPct} label="Completion" size={88} />
            </div>
            <div className="space-y-3">
              <ProgressBar
                value={selected.classesAttended}
                max={selected.classesHeld || 1}
                label={`Classes attended (${selected.classesAttended}/${selected.classesHeld})`}
                tone={attendanceTone(selected.attendancePct)}
              />
              <ProgressBar
                value={selected.assignmentsCompleted}
                max={selected.assignmentsTotal || 1}
                label={`Assignments submitted (${selected.assignmentsCompleted}/${selected.assignmentsTotal})`}
                tone="navy"
              />
              <ProgressBar value={selected.assessmentAvgPct} label="Assessment average" tone={attendanceTone(selected.assessmentAvgPct)} />
            </div>
            <p className="text-caption text-muted">Documents and personal records are only available to the Foundation staff.</p>
          </div>
        )}
      </ResponsiveSheet>
    </>
  );
}
