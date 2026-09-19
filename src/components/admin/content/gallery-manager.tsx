"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormGrid } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { FormFields, type FieldDef, type FormValues } from "@/components/admin/content/fields";

export interface GalleryRow {
  id: string;
  title: string | null;
  imageUrl: string;
  category: string | null;
  centerId: string | null;
  sortOrder: number;
  isPublished: boolean;
  center: { id: string; name: string; code: string } | null;
}

interface Uploaded {
  url: string;
  name: string;
}

export function GalleryManager({ items, categories, centers, canEdit }: { items: GalleryRow[]; categories: string[]; centers: { id: string; name: string; code: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [files, setFiles] = React.useState<Uploaded[]>([]);
  const [uploading, setUploading] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [centerId, setCenterId] = React.useState("");
  const [published, setPublished] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState<GalleryRow | null>(null);
  const [values, setValues] = React.useState<FormValues>({});
  const [deleting, setDeleting] = React.useState<GalleryRow | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const centerOptions = centers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
  const editFields: FieldDef[] = [
    { key: "title", label: "Caption", type: "text", span: 2 },
    { key: "category", label: "Category", type: "text", placeholder: "e.g. Classroom, Events" },
    { key: "centerId", label: "Training center", type: "select", options: centerOptions, placeholder: "Not linked to a center" },
    { key: "sortOrder", label: "Order", type: "number" },
    { key: "isPublished", label: "Published on the website", type: "boolean" },
  ];

  const uploadMany = async (list: FileList | null) => {
    if (!list?.length) return;
    const arr = Array.from(list);
    setUploading((n) => n + arr.length);
    for (const f of arr) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("preset", "image");
        fd.append("folder", "gallery");
        fd.append("visibility", "public");
        // Raw fetch (not the api client) so the per-file error message survives; the path still
        // needs the deployment sub-path, which `fetch` would otherwise resolve against the origin.
        const res = await fetch(withBasePath("/api/admin/uploads"), { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json?.error?.message ?? "Upload failed");
        setFiles((prev) => [...prev, { url: json.data.url as string, name: f.name }]);
      } catch (err) {
        toast.error(`Could not upload ${f.name}`, err instanceof Error ? err.message : undefined);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api.post("/api/admin/gallery", { items: files.map((f) => ({ imageUrl: f.url, title: files.length === 1 ? title || null : null })), title: title || null, category: category || null, centerId: centerId || null, isPublished: published });
      toast.success(`${files.length} image${files.length === 1 ? "" : "s"} added to the gallery`);
      setAddOpen(false);
      setFiles([]);
      setTitle("");
      setCategory("");
      setCenterId("");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api.put(`/api/admin/gallery/${editing.id}`, values);
      toast.success("Image updated");
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/gallery/${deleting.id}`);
      toast.success("Image removed");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)} leftIcon={<ImagePlus className="h-4 w-4" />}>
            Add images
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="No gallery images" description="Upload photos of classes, events and centers to show on the website." action={canEdit ? <Button onClick={() => setAddOpen(true)} leftIcon={<ImagePlus className="h-4 w-4" />}>Add images</Button> : undefined} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((g) => (
            <li key={g.id} className="group card overflow-hidden">
              <div className="relative aspect-[4/3] bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.imageUrl} alt={g.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
                {!g.isPublished && <Badge tone="warning" className="absolute top-2 left-2">Hidden</Badge>}
                {canEdit && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button type="button" onClick={() => { setEditing(g); setValues({ title: g.title ?? "", category: g.category ?? "", centerId: g.centerId ?? "", sortOrder: g.sortOrder, isPublished: g.isPublished }); setErrors({}); setFormError(null); }} className="rounded-lg bg-white/90 p-1.5 text-navy shadow-sm hover:bg-white" aria-label="Edit image">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setDeleting(g)} className="rounded-lg bg-white/90 p-1.5 text-danger shadow-sm hover:bg-white" aria-label="Delete image">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-ink">{g.title || <span className="text-muted">Untitled</span>}</p>
                <p className="truncate text-xs text-muted">{[g.category, g.center?.name].filter(Boolean).join(" · ") || "No category"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={addOpen} onClose={() => !busy && setAddOpen(false)} title="Add gallery images" description="Upload one or many photos. JPG, PNG or WEBP up to 5 MB each." size="lg">
        <form onSubmit={submitAdd} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div>
            <label
              htmlFor="gallery-files"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface/60 px-4 py-6 text-center hover:border-navy/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void uploadMany(e.dataTransfer.files);
              }}
            >
              {uploading > 0 ? <Loader2 className="h-6 w-6 animate-spin text-orange" /> : <UploadCloud className="h-6 w-6 text-navy" />}
              <span className="text-sm font-semibold text-ink">{uploading > 0 ? `Uploading ${uploading}…` : "Drag & drop or click to choose images"}</span>
              <span className="text-xs text-muted">You can select several files at once.</span>
              <input ref={inputRef} id="gallery-files" type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="sr-only" onChange={(e) => { void uploadMany(e.target.files); e.target.value = ""; }} />
            </label>
            {errors.items && (
              <p className="mt-1 text-xs font-medium text-danger" role="alert">
                {errors.items}
              </p>
            )}
          </div>
          {files.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {files.map((f, i) => (
                <li key={f.url} className="relative aspect-square overflow-hidden rounded-lg bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-danger shadow-sm" aria-label={`Remove ${f.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <FormGrid>
            <Field label={files.length > 1 ? "Caption (applied to all)" : "Caption"} htmlFor="g-title" error={errors.title}>
              <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Category" htmlFor="g-cat" error={errors.category} hint={categories.length ? `Existing: ${categories.join(", ")}` : undefined}>
              <Input id="g-cat" list="gallery-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Classroom" />
              <datalist id="gallery-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Training center (optional)" htmlFor="g-center" error={errors.centerId}>
              <Select id="g-center" value={centerId} onChange={(e) => setCenterId(e.target.value)} options={centerOptions} placeholder="Not linked to a center" />
            </Field>
            <div className="flex items-end">
              <Checkbox label="Publish on the website" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            </div>
          </FormGrid>
          <div className={cn("flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end")}>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={files.length === 0 || uploading > 0}>
              Add {files.length || ""} image{files.length === 1 ? "" : "s"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => !busy && setEditing(null)} title="Edit image" size="lg">
        <form onSubmit={submitEdit} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          {editing && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={editing.imageUrl} alt="" className="max-h-56 w-full rounded-xl object-cover" />
          )}
          <FormFields fields={editFields} values={values} onChange={setValues} errors={errors} disabled={busy} idPrefix="ge" />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => !busy && setDeleting(null)} onConfirm={remove} title="Delete this image?" description="The image will be removed from the website gallery. This cannot be undone." confirmLabel="Delete" danger loading={busy} />
    </div>
  );
}
