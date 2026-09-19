"use client";

import * as React from "react";
import { BookOpen, Download, FileText, Film, Image as ImageIcon, Plus, Trash2, UploadCloud } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormActions } from "@/components/ui/form";
import { Drawer, ConfirmDialog } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { BatchPicker } from "@/components/trainer/batch-picker";
import { useApi } from "@/components/trainer/use-api";
import type { BatchOption } from "@/components/trainer/types";

interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string | null;
  createdAt: string;
  batch: { id: string; code: string; name: string } | null;
  course: { id: string; name: string } | null;
}

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.zip,.txt";
const MAX_MB = 50;

function FileIcon({ type }: { type: string | null }) {
  const t = (type ?? "").toLowerCase();
  const Icon = ["png", "jpg", "jpeg"].includes(t) ? ImageIcon : t === "mp4" ? Film : FileText;
  return <Icon className="h-5 w-5" />;
}

export function MaterialsClient({ batches, initialBatchId, disabled }: { batches: BatchOption[]; initialBatchId: string; disabled: boolean }) {
  const { data: rows, error, loading, reload } = useApi<MaterialRow[]>("/api/trainer/materials");
  const [filter, setFilter] = React.useState(batches.some((b) => b.id === initialBatchId) ? initialBatchId : "");
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<MaterialRow | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const uploadable = batches.filter((b) => b.status !== "CANCELLED" && b.status !== "COMPLETED");
  const canUpload = !disabled && uploadable.length > 0;
  const visible = rows?.filter((m) => !filter || m.batch?.id === filter) ?? [];

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/api/trainer/materials/${deleting.id}`);
      toast.success("Material deleted");
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error("Could not delete", errorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Field label="Batch" htmlFor="mat-filter" className="sm:max-w-md sm:flex-1">
          <Select id="mat-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="All batches" options={batches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))} />
        </Field>
        <Button onClick={() => setOpen(true)} disabled={!canUpload} leftIcon={<Plus className="h-4 w-4" />}>
          Upload material
        </Button>
      </div>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !rows ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7" />}
          title={rows.length === 0 ? "You have not uploaded any materials yet" : "No materials for this batch"}
          description="Upload notes, worksheets, slides or short videos. Students of the batch can download them from their portal."
          action={
            canUpload && (
              <Button onClick={() => setOpen(true)} leftIcon={<UploadCloud className="h-4 w-4" />}>
                Upload material
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => (
            <li key={m.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavender text-navy">
                  <FileIcon type={m.fileType} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-bold text-navy">{m.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted">{m.batch ? `${m.batch.name} · ${m.batch.code}` : (m.course?.name ?? "Course material")}</p>
                </div>
                <Badge tone="neutral">{(m.fileType ?? "file").toUpperCase()}</Badge>
              </div>
              {m.description && <p className="mt-3 line-clamp-3 text-sm text-muted">{m.description}</p>}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="text-xs text-muted">{formatDateTime(m.createdAt)}</span>
                <div className="flex gap-1.5">
                  <a href={m.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink hover:bg-surface">
                    <Download className="h-3.5 w-3.5" /> Open
                  </a>
                  <Button variant="ghost" size="xs" onClick={() => setDeleting(m)} disabled={disabled} className="text-danger hover:bg-danger-light" aria-label={`Delete ${m.title}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          {visible.length} of {rows.length} material{rows.length === 1 ? "" : "s"} · only files you uploaded are listed here.
        </p>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} title="Upload training material" description="Files are private to the students and trainers of the batch." className="max-w-lg">
        {open && (
          <UploadForm
            batches={uploadable}
            initialBatchId={filter}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              reload();
            }}
          />
        )}
      </Drawer>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={deleteBusy} danger confirmLabel="Delete material" title="Delete this material?" description={deleting ? `"${deleting.title}" will be removed and students will no longer be able to download it.` : undefined} />
    </>
  );
}

function UploadForm({ batches, initialBatchId, onClose, onSaved }: { batches: BatchOption[]; initialBatchId: string; onClose: () => void; onSaved: () => void }) {
  const [batchId, setBatchId] = React.useState(() => (batches.some((b) => b.id === initialBatchId) ? initialBatchId : (batches.find((b) => b.status === "ONGOING")?.id ?? batches[0]?.id ?? "")));
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const batch = batches.find((b) => b.id === batchId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!batchId) local.batchId = "Select a batch";
    if (title.trim().length < 3) local.title = "Enter a title";
    if (!file) local.file = "Choose a file to upload";
    else if (file.size > MAX_MB * 1024 * 1024) local.file = `File is too large. Maximum size is ${MAX_MB} MB`;
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length || !file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("batchId", batchId);
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("file", file);
      await api.post("/api/trainer/materials", fd);
      toast.success("Material uploaded", batch ? `Students of ${batch.name} can download it now.` : undefined);
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
      <BatchPicker batches={batches} value={batchId} onChange={setBatchId} error={errors.batchId} id="mat-batch" />
      {batch && <p className="-mt-3 text-xs text-muted">Course: {batch.courseName}</p>}
      <Field label="Title" htmlFor="mat-title" required error={errors.title}>
        <Input id="mat-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} maxLength={200} placeholder="e.g. Chapter 4 notes – Formulas & functions" />
      </Field>
      <Field label="Description" htmlFor="mat-desc" error={errors.description} hint={`${description.length} / 2000`}>
        <Textarea id="mat-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} invalid={!!errors.description} maxLength={2000} placeholder="What is inside and how students should use it" />
      </Field>
      <Field label="File" htmlFor="mat-file" required error={errors.file} hint={`PDF, Word, Excel, images, MP4, ZIP or text up to ${MAX_MB} MB.`}>
        <input
          id="mat-file"
          type="file"
          accept={ACCEPT}
          aria-invalid={errors.file ? true : undefined}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full cursor-pointer rounded-xl border border-line bg-white text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-l-xl file:border-0 file:bg-lavender file:px-4 file:py-3 file:text-sm file:font-semibold file:text-navy hover:file:bg-navy-soft focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15 aria-invalid:border-danger"
        />
        {file && (
          <p className="text-xs text-muted">
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </Field>
      <FormActions>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} leftIcon={<UploadCloud className="h-4 w-4" />}>
          {saving ? "Uploading…" : "Upload"}
        </Button>
      </FormActions>
    </form>
  );
}
