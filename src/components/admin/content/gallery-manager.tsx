"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ImagePlus, Images, Loader2, MoreVertical, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormGrid } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { ActionSheet } from "@/components/ui/action-sheet";
import { Fab } from "@/components/ui/fab";
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

const valuesOf = (g: GalleryRow): FormValues => ({ title: g.title ?? "", category: g.category ?? "", centerId: g.centerId ?? "", sortOrder: g.sortOrder, isPublished: g.isPublished });

/**
 * The photo library. A 2-up grid on phones (tap a photo for Edit / Hide / Delete in an action sheet),
 * up to 5-up on desktop with the same actions on hover and keyboard focus. Uploading takes several
 * photos at once; each shows as a thumbnail as soon as it lands.
 */
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
  const [sheetFor, setSheetFor] = React.useState<GalleryRow | null>(null);
  const addFormId = React.useId();
  const editFormId = React.useId();

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

  const resetAdd = () => {
    setFiles([]);
    setTitle("");
    setCategory("");
    setCenterId("");
    setPublished(true);
    setErrors({});
    setFormError(null);
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
      resetAdd();
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

  const openEdit = (g: GalleryRow) => {
    setEditing(g);
    setValues(valuesOf(g));
    setErrors({});
    setFormError(null);
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

  const togglePublished = async (g: GalleryRow) => {
    try {
      await api.put(`/api/admin/gallery/${g.id}`, { ...valuesOf(g), isPublished: !g.isPublished });
      toast.success(g.isPublished ? "Image hidden from the website" : "Image published");
      router.refresh();
    } catch (err) {
      toast.error("Could not update", err instanceof Error ? err.message : undefined);
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

  const addButton = (
    <Button onClick={() => setAddOpen(true)} leftIcon={<ImagePlus className="h-4 w-4" />}>
      Add images
    </Button>
  );

  return (
    <div className="space-y-4">
      {canEdit && items.length > 0 && <div className="hidden justify-end lg:flex">{addButton}</div>}

      {items.length === 0 ? (
        <EmptyState icon={<Images className="h-7 w-7" />} title="No gallery images" description="Upload photos of classes, events and centers to show them in the website gallery and on center pages." action={canEdit ? addButton : undefined} />
      ) : (
        <ul className="grid animate-fade-in grid-cols-2 gap-3 motion-reduce:animate-none sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" aria-label="Gallery images">
          {items.map((g) => {
            const caption = g.title || "Untitled";
            const meta = [g.category, g.center?.name].filter(Boolean).join(" · ") || "No category";
            return (
              <li key={g.id} className="group card relative overflow-hidden">
                <div className="media media-4x3 rounded-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={withBasePath(g.imageUrl)} alt={g.title ?? ""} loading="lazy" decoding="async" className={cn(!g.isPublished && "opacity-60")} />
                </div>
                {!g.isPublished && (
                  <Badge tone="warning" className="absolute top-2 left-2">
                    <EyeOff className="h-3 w-3" aria-hidden /> Hidden
                  </Badge>
                )}
                <div className="flex items-start gap-1 p-3 pr-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-ink">{caption}</p>
                    <p className="truncate text-caption text-muted">{meta}</p>
                  </div>
                  {canEdit && (
                    <>
                      {/* Phones / touch: one overflow button → action sheet. */}
                      <IconButton icon={<MoreVertical className="h-5 w-5" />} aria-label={`Actions for ${caption}`} onClick={() => setSheetFor(g)} className="-my-2 lg:hidden lg:pointer-coarse:inline-flex" />
                      {/* Desktop: inline actions, revealed on hover / focus. */}
                      <div className="hidden items-center lg:flex lg:pointer-coarse:hidden lg:opacity-0 lg:transition-opacity lg:duration-micro lg:group-focus-within:opacity-100 lg:group-hover:opacity-100 motion-reduce:transition-none">
                        <IconButton size="sm" icon={<Pencil className="h-4 w-4" />} aria-label={`Edit ${caption}`} onClick={() => openEdit(g)} />
                        <IconButton size="sm" icon={g.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} aria-label={g.isPublished ? `Hide ${caption}` : `Publish ${caption}`} onClick={() => void togglePublished(g)} />
                        <IconButton size="sm" icon={<Trash2 className="h-4 w-4" />} aria-label={`Delete ${caption}`} onClick={() => setDeleting(g)} className="hover:bg-danger-light hover:text-danger" />
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && <Fab aria-label="Add images" icon={<ImagePlus className="h-6 w-6" aria-hidden />} onClick={() => setAddOpen(true)} />}

      <ActionSheet
        open={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.title || "Image"}
        items={
          sheetFor
            ? [
                { label: "Edit details", icon: <Pencil className="h-5 w-5" />, onSelect: () => openEdit(sheetFor) },
                { label: sheetFor.isPublished ? "Hide from the website" : "Publish on the website", icon: sheetFor.isPublished ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />, onSelect: () => void togglePublished(sheetFor) },
                { label: "Delete image", icon: <Trash2 className="h-5 w-5" />, danger: true, onSelect: () => setDeleting(sheetFor) },
              ]
            : []
        }
      />

      <Modal
        open={addOpen}
        onClose={() => !busy && setAddOpen(false)}
        title="Add gallery images"
        description="Upload one or many photos. JPG, PNG or WEBP up to 5 MB each."
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form={addFormId} loading={busy} disabled={files.length === 0 || uploading > 0}>
              {files.length ? `Add ${files.length} image${files.length === 1 ? "" : "s"}` : "Add images"}
            </Button>
          </>
        }
      >
        <form id={addFormId} onSubmit={submitAdd} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div>
            <label
              htmlFor="gallery-files"
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface/60 px-4 py-6 text-center tap-highlight-none transition-colors duration-micro has-focus-visible:border-orange hover:border-navy/40 active:bg-surface motion-reduce:transition-none"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void uploadMany(e.dataTransfer.files);
              }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-lavender text-navy" aria-hidden>
                {uploading > 0 ? <Loader2 className="h-6 w-6 animate-spin text-orange motion-reduce:animate-none" /> : <UploadCloud className="h-6 w-6" />}
              </span>
              <span className="text-body-sm font-semibold text-ink" aria-live="polite">
                {uploading > 0 ? `Uploading ${uploading} image${uploading === 1 ? "" : "s"}…` : "Choose photos, or drop them here"}
              </span>
              <span className="text-caption text-muted">You can select several at once.</span>
              <input
                id="gallery-files"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void uploadMany(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {errors.items && (
              <p className="mt-1 text-caption font-medium text-danger" role="alert">
                {errors.items}
              </p>
            )}
          </div>
          {files.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Uploaded images">
              {files.map((f, i) => (
                <li key={f.url} className="relative animate-fade-in overflow-hidden rounded-md motion-reduce:animate-none">
                  <div className="media media-1x1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={withBasePath(f.url)} alt={f.name} />
                  </div>
                  <IconButton size="sm" icon={<X className="h-4 w-4" />} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="absolute top-1 right-1 bg-white/95 text-danger shadow-e1 hover:bg-white" />
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
        </form>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => !busy && setEditing(null)}
        title="Edit image"
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form={editFormId} loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        <form id={editFormId} onSubmit={submitEdit} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          {editing && (
            <div className="media media-16x9 rounded-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={withBasePath(editing.imageUrl)} alt="" />
            </div>
          )}
          <FormFields fields={editFields} values={values} onChange={setValues} errors={errors} disabled={busy} idPrefix="ge" />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => !busy && setDeleting(null)} onConfirm={remove} title="Delete this image?" description="The image will be removed from the website gallery. This cannot be undone." confirmLabel="Delete" danger loading={busy} />
    </div>
  );
}
