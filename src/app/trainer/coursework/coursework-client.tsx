"use client";

import * as React from "react";
import { CalendarClock, ExternalLink, FileText, Paperclip, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FormActions, FormGrid } from "@/components/ui/form";
import { Drawer, ConfirmDialog } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/misc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert, EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { toast } from "@/components/ui/toast";
import { BatchPicker } from "@/components/trainer/batch-picker";
import { useApi } from "@/components/trainer/use-api";
import type { BatchOption } from "@/components/trainer/types";

interface AssignmentRow {
  id: string;
  batchId: string;
  title: string;
  description: string | null;
  attachmentUrl: string | null;
  dueDate: string | null;
  maxMarks: number;
  createdAt: string;
  submissionCount: number;
  gradedCount: number;
}
interface Submission {
  id: string;
  status: string;
  text: string | null;
  fileUrl: string | null;
  submittedAt: string;
  marks: number | null;
  feedback: string | null;
  gradedAt: string | null;
}
interface SubmissionRow {
  admissionId: string;
  student: { id: string; name: string; studentId: string | null; photoUrl: string | null };
  admissionStatus: string;
  submission: Submission | null;
}
interface SubmissionsData {
  assignment: { id: string; title: string; maxMarks: number; dueDate: string | null; batch: { id: string; code: string; name: string } };
  rows: SubmissionRow[];
}

/** ISO → value for <input type="datetime-local"> in the viewer's timezone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** datetime-local value → ISO (UTC) so the server stores the intended instant regardless of its timezone. */
function fromLocalInput(v: string) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}
function fileName(url: string) {
  const last = url.split("/").pop() ?? "attachment";
  return decodeURIComponent(last.replace(/^[0-9a-f-]{20,}[-_]/i, ""));
}

export function CourseworkClient({ batches, initialBatchId, today, disabled }: { batches: BatchOption[]; initialBatchId: string; today: string; disabled: boolean }) {
  const defaultBatch = batches.find((b) => b.id === initialBatchId)?.id ?? batches.find((b) => b.status === "ONGOING")?.id ?? batches[0]?.id ?? "";
  const [batchId, setBatchId] = React.useState(defaultBatch);
  const batch = batches.find((b) => b.id === batchId);
  const { data: rows, error, loading, reload } = useApi<AssignmentRow[]>(batchId ? `/api/trainer/assignments?batchId=${encodeURIComponent(batchId)}` : null);
  const [editing, setEditing] = React.useState<AssignmentRow | "new" | null>(null);
  const [viewing, setViewing] = React.useState<AssignmentRow | null>(null);
  const [deleting, setDeleting] = React.useState<AssignmentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const canEdit = !disabled && !!batch && batch.status !== "CANCELLED";

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/api/trainer/assignments/${deleting.id}`);
      toast.success("Assignment deleted");
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error("Could not delete", errorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (batches.length === 0) return <EmptyState title="No batches yet" description="Coursework opens once the Foundation assigns you to a batch." />;

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <BatchPicker batches={batches} value={batchId} onChange={setBatchId} className="sm:max-w-md sm:flex-1" />
        <Button onClick={() => setEditing("new")} disabled={!canEdit} leftIcon={<Plus className="h-4 w-4" />}>
          New assignment
        </Button>
      </div>
      {batch?.status === "CANCELLED" && (
        <Alert tone="warning" className="mb-5">
          This batch is cancelled. Coursework is read-only.
        </Alert>
      )}

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !rows ? (
        <div className="space-y-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title="No assignments for this batch"
          description="Create the first assignment. Students see it in their portal and can submit their work online."
          action={
            canEdit && (
              <Button onClick={() => setEditing("new")} leftIcon={<Plus className="h-4 w-4" />}>
                New assignment
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => {
            const overdue = !!a.dueDate && a.dueDate.slice(0, 10) < today;
            const pending = a.submissionCount - a.gradedCount;
            return (
              <li key={a.id} className="card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-navy">{a.title}</h3>
                      {pending > 0 && <Badge tone="orange">{pending} to grade</Badge>}
                      {overdue && <Badge tone="neutral">Past due</Badge>}
                    </div>
                    {a.description && <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-muted">{a.description}</p>}
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" /> {a.dueDate ? `Due ${formatDateTime(a.dueDate)}` : "No due date"}
                      </span>
                      <span>{a.maxMarks} marks</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {a.submissionCount} submitted · {a.gradedCount} graded
                      </span>
                      {a.attachmentUrl && (
                        <a href={a.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-navy hover:underline">
                          <Paperclip className="h-3.5 w-3.5" /> Attachment
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:shrink-0">
                    <Button variant="navy" size="sm" onClick={() => setViewing(a)}>
                      Submissions{a.submissionCount ? ` (${a.submissionCount})` : ""}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(a)} disabled={!canEdit} leftIcon={<Pencil className="h-4 w-4" />} aria-label={`Edit ${a.title}`}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(a)} disabled={!canEdit || a.submissionCount > 0} className="text-danger hover:bg-danger-light" leftIcon={<Trash2 className="h-4 w-4" />} aria-label={`Delete ${a.title}`} title={a.submissionCount > 0 ? "Cannot delete after students have submitted" : undefined}>
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New assignment" : "Edit assignment"} description={batch ? `${batch.name} · ${batch.code}` : undefined} className="max-w-lg">
        {editing !== null && batch && (
          <AssignmentForm
            batch={batch}
            assignment={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Drawer>
      <Drawer open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title} description={viewing && batch ? `${batch.name} · ${viewing.maxMarks} marks${viewing.dueDate ? ` · due ${formatDateTime(viewing.dueDate)}` : ""}` : undefined} className="max-w-2xl">
        {viewing && <SubmissionsPanel key={viewing.id} assignmentId={viewing.id} canGrade={canEdit} onGraded={reload} />}
      </Drawer>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={deleteBusy} danger confirmLabel="Delete assignment" title="Delete this assignment?" description={deleting ? `"${deleting.title}" will be removed from the batch. This cannot be undone.` : undefined} />
    </>
  );
}

// ───────────────────────────── Create / edit ─────────────────────────────

function AssignmentForm({ batch, assignment, onClose, onSaved }: { batch: BatchOption; assignment: AssignmentRow | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = React.useState(assignment?.title ?? "");
  const [description, setDescription] = React.useState(assignment?.description ?? "");
  const [dueDate, setDueDate] = React.useState(() => toLocalInput(assignment?.dueDate ?? null));
  const [maxMarks, setMaxMarks] = React.useState(String(assignment?.maxMarks ?? 100));
  const [attachment, setAttachment] = React.useState<{ url: string; name: string } | null>(() => (assignment?.attachmentUrl ? { url: assignment.attachmentUrl, name: fileName(assignment.attachmentUrl) } : null));
  const [upload, setUpload] = React.useState<UploadedFile | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSaving(true);
    const payload = { title: title.trim(), description: description.trim() || null, attachmentUrl: attachment?.url ?? null, dueDate: fromLocalInput(dueDate), maxMarks: Number(maxMarks) };
    try {
      if (assignment) await api.patch(`/api/trainer/assignments/${assignment.id}`, payload);
      else await api.post("/api/trainer/assignments", { batchId: batch.id, ...payload });
      toast.success(assignment ? "Assignment updated" : "Assignment created", assignment ? undefined : "Students in this batch can now see it.");
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
      <Field label="Title" htmlFor="as-title" required error={errors.title}>
        <Input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} maxLength={200} placeholder="e.g. Practice sheet 3 – Excel formulas" />
      </Field>
      <Field label="Instructions" htmlFor="as-desc" error={errors.description} hint={`${description.length} / 5000`}>
        <Textarea id="as-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} invalid={!!errors.description} maxLength={5000} placeholder="What should students do and how should they submit?" />
      </Field>
      <FormGrid>
        <Field label="Due date & time" htmlFor="as-due" error={errors.dueDate} hint="Leave blank for no deadline.">
          <Input id="as-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} invalid={!!errors.dueDate} />
        </Field>
        <Field label="Maximum marks" htmlFor="as-max" required error={errors.maxMarks}>
          <Input id="as-max" type="number" min={1} max={1000} inputMode="numeric" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} invalid={!!errors.maxMarks} />
        </Field>
      </FormGrid>
      <Field label="Attachment" error={errors.attachmentUrl} hint="Optional worksheet or reference file (PDF, Office, image, ZIP up to 20 MB).">
        {attachment ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-lavender text-navy">
              <Paperclip className="h-5 w-5" />
            </span>
            <a href={attachment.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-navy hover:underline">
              {attachment.name}
            </a>
            <button
              type="button"
              onClick={() => {
                setAttachment(null);
                setUpload(null);
              }}
              className="rounded-lg p-2 text-muted hover:bg-danger-light hover:text-danger"
              aria-label="Remove attachment"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <FileUpload
            endpoint="/api/trainer/uploads"
            fields={{ kind: "attachment", batchId: batch.id }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.txt"
            maxSizeMb={20}
            value={upload}
            onChange={(f) => {
              setUpload(f);
              setAttachment(f ? { url: f.url, name: f.name } : null);
            }}
            label="Upload attachment"
            preview={false}
          />
        )}
      </Field>
      <FormActions>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {assignment ? "Save changes" : "Create assignment"}
        </Button>
      </FormActions>
    </form>
  );
}

// ───────────────────────────── Submissions & grading ─────────────────────────────

type SubFilter = "all" | "pending" | "graded" | "missing";

function SubmissionsPanel({ assignmentId, canGrade, onGraded }: { assignmentId: string; canGrade: boolean; onGraded: () => void }) {
  const { data, error, loading, reload, setData } = useApi<SubmissionsData>(`/api/trainer/assignments/${assignmentId}/submissions`);
  const [filter, setFilter] = React.useState<SubFilter>("all");

  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (loading || !data) {
    return (
      <div className="space-y-3">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }
  if (data.rows.length === 0) return <EmptyState title="No students admitted to this batch" />;

  const counts: Record<SubFilter, number> = {
    all: data.rows.length,
    pending: data.rows.filter((r) => r.submission && r.submission.status !== "GRADED").length,
    graded: data.rows.filter((r) => r.submission?.status === "GRADED").length,
    missing: data.rows.filter((r) => !r.submission).length,
  };
  const rows = data.rows.filter((r) => (filter === "all" ? true : filter === "missing" ? !r.submission : filter === "graded" ? r.submission?.status === "GRADED" : !!r.submission && r.submission.status !== "GRADED"));

  return (
    <div className="space-y-4">
      <div className="scrollbar-thin flex gap-1 overflow-x-auto rounded-xl bg-surface p-1" role="tablist">
        {(
          [
            ["all", "All"],
            ["pending", "To grade"],
            ["graded", "Graded"],
            ["missing", "Not submitted"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all", filter === key ? "bg-white text-navy shadow-sm" : "text-muted hover:text-ink")}>
            {label} <span className="opacity-70">({counts[key]})</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <SubmissionCard
              key={r.admissionId}
              row={r}
              maxMarks={data.assignment.maxMarks}
              canGrade={canGrade}
              onGraded={(s) => {
                setData((d) => ({ ...d, rows: d.rows.map((x) => (x.admissionId === r.admissionId ? { ...x, submission: s } : x)) }));
                onGraded();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmissionCard({ row, maxMarks, canGrade, onGraded }: { row: SubmissionRow; maxMarks: number; canGrade: boolean; onGraded: (s: Submission) => void }) {
  const s = row.submission;
  const [marks, setMarks] = React.useState(s?.marks != null ? String(s.marks) : "");
  const [feedback, setFeedback] = React.useState(s?.feedback ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(!!s && s.status !== "GRADED");

  const grade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setErrors({});
    setSaving(true);
    try {
      const updated = await api.post<Submission>(`/api/trainer/submissions/${s.id}/grade`, { marks: Number(marks), feedback: feedback.trim() || null });
      toast.success("Grade saved", `${row.student.name}: ${updated.marks}/${maxMarks}`);
      onGraded({ ...s, ...updated, status: "GRADED" });
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        if (err.status !== 422) toast.error("Could not save grade", err.message);
      } else toast.error("Could not save grade", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.student.name} src={row.student.photoUrl} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{row.student.name}</p>
            <p className="text-xs text-muted">
              <span className="font-mono">{row.student.studentId ?? "ID pending"}</span>
              {s ? ` · Submitted ${formatDateTime(s.submittedAt)}` : ""}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {s ? (
            s.status === "GRADED" ? (
              <>
                <p className="font-heading text-lg font-extrabold text-navy tabular-nums">
                  {s.marks}
                  <span className="text-xs font-semibold text-muted"> / {maxMarks}</span>
                </p>
                <StatusBadge status="GRADED" />
              </>
            ) : (
              <StatusBadge status={s.status} />
            )
          ) : (
            <Badge tone="neutral">Not submitted</Badge>
          )}
        </div>
      </div>
      {s && (
        <div className="mt-3 space-y-2">
          {s.text && <p className="rounded-lg bg-surface p-3 text-sm whitespace-pre-wrap text-ink">{s.text}</p>}
          {s.fileUrl && (
            <a href={s.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:underline">
              <ExternalLink className="h-4 w-4" /> Open submitted file
            </a>
          )}
          {s.status === "GRADED" && s.feedback && !open && (
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">Feedback:</span> {s.feedback}
            </p>
          )}
          {canGrade &&
            (open ? (
              <form onSubmit={grade} className="mt-2 space-y-3 rounded-lg border border-line bg-surface/60 p-3" noValidate>
                <FormGrid cols={3}>
                  <Field label={`Marks (out of ${maxMarks})`} htmlFor={`marks-${s.id}`} required error={errors.marks}>
                    <Input id={`marks-${s.id}`} type="number" min={0} max={maxMarks} step={1} inputMode="numeric" value={marks} onChange={(e) => setMarks(e.target.value)} invalid={!!errors.marks} />
                  </Field>
                  <Field label="Feedback" htmlFor={`fb-${s.id}`} error={errors.feedback} className="sm:col-span-2">
                    <Textarea id={`fb-${s.id}`} rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} invalid={!!errors.feedback} maxLength={2000} placeholder="What went well, what to improve" />
                  </Field>
                </FormGrid>
                <div className="flex justify-end gap-2">
                  {s.status === "GRADED" && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" size="sm" loading={saving} disabled={marks === ""}>
                    {s.status === "GRADED" ? "Update grade" : "Save grade"}
                  </Button>
                </div>
              </form>
            ) : (
              <Button type="button" variant="outline" size="xs" onClick={() => setOpen(true)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                {s.status === "GRADED" ? "Edit grade" : "Grade"}
              </Button>
            ))}
        </div>
      )}
      {!s && row.admissionStatus !== "ACTIVE" && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          Admission <StatusBadge status={row.admissionStatus} />
        </p>
      )}
    </li>
  );
}
