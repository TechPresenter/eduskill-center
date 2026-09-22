"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ClipboardList, ListChecks, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Fab } from "@/components/ui/fab";
import { Avatar } from "@/components/ui/misc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Alert, EmptyState, ErrorState, SkeletonCard, SkeletonCardList, SkeletonTable } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { BatchPicker } from "@/components/trainer/batch-picker";
import { useApi } from "@/components/trainer/use-api";
import { gradeTone } from "@/components/trainer/grades";
import { AssessmentCard, ResultsEntryList, marksInputId, previewGrade, type AssessmentRow, type ResultEntry, type ResultRow } from "@/components/trainer/mobile";
import type { BatchOption } from "@/components/trainer/types";

/** The create / edit form is only needed once a sheet opens, so it is fetched on demand. */
const AssessmentForm = dynamic(() => import("./assessment-form"), {
  loading: () => <SkeletonCard lines={5} />,
});

interface ResultsSheetData {
  assessment: {
    id: string;
    title: string;
    type: string;
    date: string | null;
    maxMarks: number;
    passingMarks: number;
    weightage: number;
    batch: { id: string; code: string; name: string };
  };
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
        <Button onClick={() => setEditing("new")} disabled={!canEdit} leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
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
        <>
          <SkeletonCardList count={3} lines={3} className="lg:hidden" />
          <div className="hidden lg:block">
            <SkeletonTable rows={4} cols={6} />
          </div>
        </>
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
        <>
          {/* Phones: one card per assessment. */}
          <ul className="space-y-3 lg:hidden">
            {rows.map((a) => (
              <li key={a.id}>
                <AssessmentCard assessment={a} students={batch?.students} canEdit={canEdit} onEnterResults={() => setEntering(a)} onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} />
              </li>
            ))}
          </ul>

          {/* Desktop: the same records as a table. */}
          <div className="hidden lg:block">
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
                      {a.maxMarks} <span className="text-caption text-muted">(pass {a.passingMarks})</span>
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
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDeleting(a)}
                          disabled={!canEdit || a.resultCount > 0}
                          className="text-danger hover:bg-danger-light"
                          aria-label={`Delete ${a.title}`}
                          title={a.resultCount > 0 ? "Cannot delete after results are entered" : undefined}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}

      {canEdit && <Fab aria-label="New assessment" icon={<Plus className="h-6 w-6" />} label="New" onClick={() => setEditing("new")} />}

      <ResponsiveSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New assessment" : "Edit assessment"}
        description={batch ? `${batch.name} · ${batch.code}` : undefined}
        size="lg"
      >
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
      </ResponsiveSheet>

      <ResultsSheet assessment={entering} canEdit={canEdit} onClose={() => setEntering(null)} onSaved={reload} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        danger
        confirmLabel="Delete assessment"
        title="Delete this assessment?"
        description={deleting ? `"${deleting.title}" will be removed from the batch. This cannot be undone.` : undefined}
      />
    </>
  );
}

// ───────────────────────────── Results entry ─────────────────────────────

/**
 * Marks entry as a sheet on phones and a wide drawer on desktop. The roster is a card list below `lg`
 * (48px numeric inputs, Enter jumps to the next student) and the familiar table above it; both read
 * the same `entries` state, and Save lives in the sheet's own sticky footer so it is always in reach
 * however long the roster is.
 */
function ResultsSheet({ assessment, canEdit, onClose, onSaved }: { assessment: AssessmentRow | null; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  // Keep the last opened assessment so the roster stays on screen through the sheet's 350ms exit
  // instead of collapsing to a loading skeleton on the way out.
  const [shown, setShown] = React.useState<AssessmentRow | null>(assessment);
  if (assessment && assessment.id !== shown?.id) setShown(assessment);

  const [entries, setEntries] = React.useState<Record<string, ResultEntry>>({});
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const {
    data: sheet,
    error,
    loading,
    reload,
  } = useApi<ResultsSheetData>(shown ? `/api/trainer/assessments/${shown.id}/results` : null, (s) => {
    setEntries(
      Object.fromEntries(
        s.rows.map((r) => [
          r.student.id,
          {
            marks: r.marks != null ? String(r.marks) : "",
            remarks: r.remarks ?? "",
          },
        ]),
      ),
    );
    setRowErrors({});
    setFormError(null);
  });

  const a = sheet?.assessment;
  const set = React.useCallback(
    (studentId: string, patch: Partial<ResultEntry>) =>
      setEntries((e) => ({
        ...e,
        [studentId]: {
          ...(e[studentId] ?? { marks: "", remarks: "" }),
          ...patch,
        },
      })),
    [],
  );
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
      return {
        studentId: r.student.id,
        marks: n === null ? "" : n,
        remarks: e.remarks.trim() || null,
      };
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

  const showFooter = canEdit && !!sheet && sheet.rows.length > 0;

  return (
    <ResponsiveSheet
      open={!!assessment}
      onClose={onClose}
      title={shown?.title}
      description={shown ? `${titleCase(shown.type)} · ${shown.maxMarks} marks, pass ${shown.passingMarks}${shown.date ? ` · ${formatDate(shown.date)}` : ""}` : undefined}
      size="xl"
      height="full"
      footer={
        showFooter ? (
          <>
            <Button type="button" variant="outline" size="md" onClick={onClose} className="w-full sm:w-auto">
              Close
            </Button>
            <Button onClick={() => void save()} size="md" loading={saving} leftIcon={<Save className="h-4 w-4" />} className="w-full sm:w-auto">
              Save results
            </Button>
          </>
        ) : undefined
      }
    >
      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !sheet || !a ? (
        <SkeletonCardList count={5} lines={2} />
      ) : sheet.rows.length === 0 ? (
        <EmptyState title="No students admitted to this batch" />
      ) : (
        <div className="space-y-4">
          <p className="text-body-sm text-muted">
            {a.batch.name} · <span className="font-semibold text-ink tabular-nums">{entered}</span> of {sheet.rows.length} students have marks. Leave marks blank to clear a result. Grades update as
            you type.
          </p>
          {formError && <Alert tone="danger">{formError}</Alert>}

          <ResultsEntryList rows={sheet.rows} entries={entries} errors={rowErrors} maxMarks={a.maxMarks} passingMarks={a.passingMarks} canEdit={canEdit} onChange={set} />

          <div className="hidden lg:block">
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
                  const grade = previewGrade(e.marks, a.maxMarks, a.passingMarks);
                  const err = rowErrors[r.student.id];
                  const locked = !canEdit || r.admissionStatus === "COMPLETED";
                  return (
                    <TR key={r.admissionId}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.student.name} src={r.student.photoUrl} size={36} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{r.student.name}</p>
                            <p className="flex items-center gap-2 font-mono text-caption text-muted">
                              {r.student.studentId ?? "ID pending"}
                              {r.admissionStatus !== "ACTIVE" && <StatusBadge status={r.admissionStatus} />}
                            </p>
                            {r.evaluatedAt && <p className="text-caption text-muted">Saved {formatDateTime(r.evaluatedAt)}</p>}
                          </div>
                        </div>
                      </TD>
                      <TD className="align-top">
                        <Field label={<span className="sr-only">Marks for {r.student.name}</span>} htmlFor={`d${marksInputId(r.student.id)}`} error={err}>
                          <Input
                            id={`d${marksInputId(r.student.id)}`}
                            type="number"
                            min={0}
                            max={a.maxMarks}
                            step="0.5"
                            inputMode="decimal"
                            value={e.marks}
                            onChange={(ev) => set(r.student.id, { marks: ev.target.value })}
                            invalid={!!err}
                            disabled={locked}
                            className="w-28 tabular-nums"
                          />
                        </Field>
                      </TD>
                      <TD className="pt-4 align-top">{grade ? <Badge tone={gradeTone(grade)}>{grade}</Badge> : <span className="text-caption text-muted">—</span>}</TD>
                      <TD className="align-top">
                        <Field label={<span className="sr-only">Remarks for {r.student.name}</span>} htmlFor={`dr-${r.student.id}`}>
                          <Input
                            id={`dr-${r.student.id}`}
                            value={e.remarks}
                            onChange={(ev) => set(r.student.id, { remarks: ev.target.value })}
                            maxLength={500}
                            placeholder="Optional"
                            disabled={locked}
                            className="min-w-48"
                          />
                        </Field>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
}
