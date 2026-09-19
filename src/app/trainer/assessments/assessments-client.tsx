"use client";

import * as React from "react";
import { ClipboardList, ListChecks, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormActions, FormGrid } from "@/components/ui/form";
import { Drawer, ConfirmDialog } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/misc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Alert, EmptyState, ErrorState, SkeletonTable } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { BatchPicker } from "@/components/trainer/batch-picker";
import { useApi } from "@/components/trainer/use-api";
import { ASSESSMENT_TYPES, gradeFor, gradeTone } from "@/components/trainer/grades";
import type { BatchOption } from "@/components/trainer/types";

interface AssessmentRow {
  id: string;
  batchId: string;
  title: string;
  type: string;
  date: string | null;
  maxMarks: number;
  passingMarks: number;
  weightage: number;
  createdAt: string;
  resultCount: number;
}
interface ResultRow {
  admissionId: string;
  student: { id: string; name: string; studentId: string | null; photoUrl: string | null };
  admissionStatus: string;
  marks: number | null;
  grade: string | null;
  remarks: string | null;
  evaluatedAt: string | null;
}
interface ResultsSheet {
  assessment: { id: string; title: string; type: string; date: string | null; maxMarks: number; passingMarks: number; weightage: number; batch: { id: string; code: string; name: string } };
  rows: ResultRow[];
}

export function AssessmentsClient({ batches, initialBatchId, disabled }: { batches: BatchOption[]; initialBatchId: string; disabled: boolean }) {
  const defaultBatch = batches.find((b) => b.id === initialBatchId)?.id ?? batches.find((b) => b.status === "ONGOING")?.id ?? batches[0]?.id ?? "";
  const [batchId, setBatchId] = React.useState(defaultBatch);
  const batch = batches.find((b) => b.id === batchId);
  const { data: rows, error, loading, reload } = useApi<AssessmentRow[]>(batchId ? `/api/trainer/assessments?batchId=${encodeURIComponent(batchId)}` : null);
  const [editing, setEditing] = React.useState<AssessmentRow | "new" | null>(null);
  const [entering, setEntering] = React.useState<AssessmentRow | null>(null);
  const [deleting, setDeleting] = React.useState<AssessmentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const canEdit = !disabled && !!batch && batch.status !== "CANCELLED";

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/api/trainer/assessments/${deleting.id}`);
      toast.success("Assessment deleted");
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error("Could not delete", errorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (batches.length === 0) return <EmptyState title="No batches yet" description="Assessments open once the Foundation assigns you to a batch." />;

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <BatchPicker batches={batches} value={batchId} onChange={setBatchId} className="sm:max-w-md sm:flex-1" />
        <Button onClick={() => setEditing("new")} disabled={!canEdit} leftIcon={<Plus className="h-4 w-4" />}>
          New assessment
        </Button>
      </div>
      {batch?.status === "CANCELLED" && (
        <Alert tone="warning" className="mb-5">
          This batch is cancelled. Assessments are read-only.
        </Alert>
      )}

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !rows ? (
        <SkeletonTable rows={4} cols={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-7 w-7" />}
          title="No assessments for this batch"
          description="Add a quiz, practical, mid-term or final exam. Results feed into each student's progress and certificate eligibility."
          action={
            canEdit && (
              <Button onClick={() => setEditing("new")} leftIcon={<Plus className="h-4 w-4" />}>
                New assessment
              </Button>
            )
          }
        />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Assessment</TH>
              <TH>Type</TH>
              <TH>Date</TH>
              <TH>Marks</TH>
              <TH>Weightage</TH>
              <TH>Results</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((a) => (
              <TR key={a.id}>
                <TD className="font-semibold text-ink">{a.title}</TD>
                <TD>
                  <Badge tone="navy">{titleCase(a.type)}</Badge>
                </TD>
                <TD>{a.date ? formatDate(a.date) : <span className="text-muted">TBA</span>}</TD>
                <TD className="tabular-nums">
                  {a.maxMarks} <span className="text-xs text-muted">(pass {a.passingMarks})</span>
                </TD>
                <TD className="tabular-nums">{a.weightage}</TD>
                <TD>
                  {a.resultCount > 0 ? (
                    <span className="tabular-nums">
                      {a.resultCount} / {batch?.students ?? "—"}
                    </span>
                  ) : (
                    <Badge tone="warning">Pending</Badge>
                  )}
                </TD>
                <TD>
                  <div className="flex justify-end gap-1.5">
                    <Button variant="navy" size="xs" onClick={() => setEntering(a)} leftIcon={<ClipboardList className="h-3.5 w-3.5" />}>
                      {canEdit ? "Enter results" : "View results"}
                    </Button>
                    <Button variant="outline" size="xs" onClick={() => setEditing(a)} disabled={!canEdit} aria-label={`Edit ${a.title}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => setDeleting(a)} disabled={!canEdit || a.resultCount > 0} className="text-danger hover:bg-danger-light" aria-label={`Delete ${a.title}`} title={a.resultCount > 0 ? "Cannot delete after results are entered" : undefined}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New assessment" : "Edit assessment"} description={batch ? `${batch.name} · ${batch.code}` : undefined} className="max-w-lg">
        {editing !== null && batch && (
          <AssessmentForm
            batch={batch}
            assessment={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Drawer>
      <Drawer open={!!entering} onClose={() => setEntering(null)} title={entering?.title} description={entering ? `${titleCase(entering.type)} · ${entering.maxMarks} marks, pass ${entering.passingMarks}${entering.date ? ` · ${formatDate(entering.date)}` : ""}` : undefined} className="max-w-3xl">
        {entering && <ResultsPanel key={entering.id} assessment={entering} canEdit={canEdit} onClose={() => setEntering(null)} onSaved={reload} />}
      </Drawer>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={deleteBusy} danger confirmLabel="Delete assessment" title="Delete this assessment?" description={deleting ? `"${deleting.title}" will be removed from the batch. This cannot be undone.` : undefined} />
    </>
  );
}

// ───────────────────────────── Create / edit ─────────────────────────────

function AssessmentForm({ batch, assessment, onClose, onSaved }: { batch: BatchOption; assessment: AssessmentRow | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = React.useState(assessment?.title ?? "");
  const [type, setType] = React.useState(assessment?.type ?? "QUIZ");
  const [date, setDate] = React.useState(assessment?.date ? assessment.date.slice(0, 10) : "");
  const [maxMarks, setMaxMarks] = React.useState(String(assessment?.maxMarks ?? 100));
  const [passingMarks, setPassingMarks] = React.useState(String(assessment?.passingMarks ?? 40));
  const [weightage, setWeightage] = React.useState(String(assessment?.weightage ?? 1));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSaving(true);
    const payload = { title: title.trim(), type, date, maxMarks: Number(maxMarks), passingMarks: Number(passingMarks), weightage: Number(weightage) };
    try {
      if (assessment) await api.patch(`/api/trainer/assessments/${assessment.id}`, payload);
      else await api.post("/api/trainer/assessments", { batchId: batch.id, ...payload });
      toast.success(assessment ? "Assessment updated" : "Assessment created", assessment && assessment.resultCount > 0 ? "Existing grades were recalculated." : undefined);
      onSaved();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.status === 422 && Object.keys(err.fieldErrors).length ? null : err.message);
      } else setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Field label="Title" htmlFor="asm-title" required error={errors.title}>
        <Input id="asm-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} maxLength={200} placeholder="e.g. Unit 2 quiz – Spreadsheets" />
      </Field>
      <FormGrid>
        <Field label="Type" htmlFor="asm-type" required error={errors.type}>
          <Select id="asm-type" value={type} onChange={(e) => setType(e.target.value)} invalid={!!errors.type} options={ASSESSMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        </Field>
        <Field label="Date" htmlFor="asm-date" error={errors.date} hint="Leave blank if not scheduled yet.">
          <Input id="asm-date" type="date" value={date} min={batch.startDate} onChange={(e) => setDate(e.target.value)} invalid={!!errors.date} />
        </Field>
      </FormGrid>
      <FormGrid cols={3}>
        <Field label="Max marks" htmlFor="asm-max" required error={errors.maxMarks}>
          <Input id="asm-max" type="number" min={1} max={1000} inputMode="numeric" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} invalid={!!errors.maxMarks} />
        </Field>
        <Field label="Passing marks" htmlFor="asm-pass" required error={errors.passingMarks}>
          <Input id="asm-pass" type="number" min={0} max={1000} inputMode="numeric" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} invalid={!!errors.passingMarks} />
        </Field>
        <Field label="Weightage" htmlFor="asm-weight" required error={errors.weightage} hint="Relative weight in the batch average.">
          <Input id="asm-weight" type="number" min={1} max={100} inputMode="numeric" value={weightage} onChange={(e) => setWeightage(e.target.value)} invalid={!!errors.weightage} />
        </Field>
      </FormGrid>
      <p className="text-xs text-muted">Grades: A+ (90%+), A (80%+), B (70%+), C (60%+), Pass (at or above passing marks), Fail (below passing marks).</p>
      <FormActions>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {assessment ? "Save changes" : "Create assessment"}
        </Button>
      </FormActions>
    </form>
  );
}

// ───────────────────────────── Results grid ─────────────────────────────

type Entry = { marks: string; remarks: string };

function ResultsPanel({ assessment, canEdit, onClose, onSaved }: { assessment: AssessmentRow; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const [entries, setEntries] = React.useState<Record<string, Entry>>({});
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { data: sheet, error, loading, reload } = useApi<ResultsSheet>(`/api/trainer/assessments/${assessment.id}/results`, (s) => {
    setEntries(Object.fromEntries(s.rows.map((r) => [r.student.id, { marks: r.marks != null ? String(r.marks) : "", remarks: r.remarks ?? "" }])));
    setRowErrors({});
    setFormError(null);
  });

  const a = sheet?.assessment;
  const set = (studentId: string, patch: Partial<Entry>) => setEntries((e) => ({ ...e, [studentId]: { ...(e[studentId] ?? { marks: "", remarks: "" }), ...patch } }));
  const entered = sheet ? sheet.rows.filter((r) => (entries[r.student.id]?.marks ?? "") !== "").length : 0;

  const save = async () => {
    if (!sheet || !a) return;
    const local: Record<string, string> = {};
    const results = sheet.rows.map((r) => {
      const e = entries[r.student.id] ?? { marks: "", remarks: "" };
      const raw = e.marks.trim();
      const n = raw === "" ? null : Number(raw);
      if (n !== null && (!Number.isFinite(n) || n < 0)) local[r.student.id] = "Enter a valid number";
      else if (n !== null && n > a.maxMarks) local[r.student.id] = `Max ${a.maxMarks}`;
      return { studentId: r.student.id, marks: n === null ? "" : n, remarks: e.remarks.trim() || null };
    });
    setRowErrors(local);
    setFormError(null);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const r = await api.put<{ saved: number; cleared: number }>(`/api/trainer/assessments/${a.id}/results`, { results });
      toast.success("Results saved", `${r.saved} result${r.saved === 1 ? "" : "s"} saved${r.cleared ? `, ${r.cleared} cleared` : ""}`);
      onSaved();
      reload();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const fe = err.fieldErrors;
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(fe)) {
          const m = /^results\.(\d+)\.(marks|remarks)$/.exec(k);
          const row = m ? sheet.rows[Number(m[1])] : undefined;
          if (row) mapped[row.student.id] = v;
        }
        setRowErrors(mapped);
        setFormError(Object.keys(mapped).length ? err.message : (Object.values(fe)[0] ?? err.message));
      } else setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading || !sheet || !a) return <SkeletonTable rows={6} cols={4} />;
  if (sheet.rows.length === 0) return <EmptyState title="No students admitted to this batch" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {a.batch.name} · {entered} of {sheet.rows.length} students have marks. Leave marks blank to clear a result. Grades update automatically as you type.
      </p>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <TableWrap>
        <THead>
          <tr>
            <TH>Student</TH>
            <TH className="w-32">Marks / {a.maxMarks}</TH>
            <TH className="w-24">Grade</TH>
            <TH>Remarks</TH>
          </tr>
        </THead>
        <TBody>
          {sheet.rows.map((r) => {
            const e = entries[r.student.id] ?? { marks: "", remarks: "" };
            const n = e.marks.trim() === "" ? null : Number(e.marks);
            const grade = n !== null && Number.isFinite(n) && n >= 0 && n <= a.maxMarks ? gradeFor(n, a.maxMarks, a.passingMarks) : null;
            const err = rowErrors[r.student.id];
            const locked = !canEdit || r.admissionStatus === "COMPLETED";
            return (
              <TR key={r.admissionId}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={r.student.name} src={r.student.photoUrl} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.student.name}</p>
                      <p className="flex items-center gap-2 font-mono text-xs text-muted">
                        {r.student.studentId ?? "ID pending"}
                        {r.admissionStatus !== "ACTIVE" && <StatusBadge status={r.admissionStatus} />}
                      </p>
                      {r.evaluatedAt && <p className="text-[11px] text-muted">Saved {formatDateTime(r.evaluatedAt)}</p>}
                    </div>
                  </div>
                </TD>
                <TD className="align-top">
                  <Field label={<span className="sr-only">Marks for {r.student.name}</span>} htmlFor={`m-${r.student.id}`} error={err}>
                    <Input id={`m-${r.student.id}`} type="number" min={0} max={a.maxMarks} step="0.5" inputMode="decimal" value={e.marks} onChange={(ev) => set(r.student.id, { marks: ev.target.value })} invalid={!!err} disabled={locked} className="w-28 tabular-nums" />
                  </Field>
                </TD>
                <TD className="pt-4 align-top">{grade ? <Badge tone={gradeTone(grade)}>{grade}</Badge> : <span className="text-xs text-muted">—</span>}</TD>
                <TD className="align-top">
                  <Field label={<span className="sr-only">Remarks for {r.student.name}</span>} htmlFor={`r-${r.student.id}`}>
                    <Input id={`r-${r.student.id}`} value={e.remarks} onChange={(ev) => set(r.student.id, { remarks: ev.target.value })} maxLength={500} placeholder="Optional" disabled={locked} className="min-w-48" />
                  </Field>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </TableWrap>
      {canEdit && (
        <FormActions>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            Save results
          </Button>
        </FormActions>
      )}
    </div>
  );
}
