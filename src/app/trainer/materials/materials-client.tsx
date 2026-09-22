"use client";

import * as React from "react";
import { BookOpen, Plus, UploadCloud } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormActions } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Fab } from "@/components/ui/fab";
import { Alert, EmptyState, ErrorState, SkeletonCardList } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { BatchPicker } from "@/components/trainer/batch-picker";
import { useApi } from "@/components/trainer/use-api";
import { MaterialCard, type MaterialRow } from "@/components/trainer/mobile";
import type { BatchOption } from "@/components/trainer/types";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.zip,.txt";
const MAX_MB = 50;

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
        <Button onClick={() => setOpen(true)} disabled={!canUpload} leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
          Upload material
        </Button>
      </div>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading || !rows ? (
        <SkeletonCardList count={3} lines={2} />
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
            <MaterialCard key={m.id} material={m} canDelete={!disabled} onDelete={() => setDeleting(m)} />
          ))}
        </ul>
      )}

      {rows && rows.length > 0 && (
        <p className="mt-3 text-caption text-muted">
          {visible.length} of {rows.length} material{rows.length === 1 ? "" : "s"} · only files you uploaded are listed here.
        </p>
      )}

      {canUpload && <Fab aria-label="Upload training material" icon={<UploadCloud className="h-6 w-6" />} label="Upload" onClick={() => setOpen(true)} />}

      <ResponsiveSheet open={open} onClose={() => setOpen(false)} title="Upload training material" description="Files are private to the students and trainers of the batch." size="lg">
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
      </ResponsiveSheet>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        danger
        confirmLabel="Delete material"
        title="Delete this material?"
        description={deleting ? `"${deleting.title}" will be removed and students will no longer be able to download it.` : undefined}
      />
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
      {batch && <p className="-mt-3 text-caption text-muted">Course: {batch.courseName}</p>}
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
          className="block w-full cursor-pointer rounded-sm border border-line bg-white text-input text-ink ring-focus file:mr-3 file:cursor-pointer file:rounded-l-sm file:border-0 file:bg-lavender file:px-4 file:py-3 file:text-body-sm file:font-semibold file:text-navy hover:file:bg-navy-soft aria-invalid:border-danger"
        />
        {file && (
          <p className="text-caption text-muted">
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </Field>
      <FormActions>
        <Button type="button" variant="outline" size="md" onClick={onClose} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" size="md" loading={saving} leftIcon={<UploadCloud className="h-4 w-4" />} className="w-full sm:w-auto">
          {saving ? "Uploading…" : "Upload"}
        </Button>
      </FormActions>
    </form>
  );
}
