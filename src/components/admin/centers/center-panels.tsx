"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { FileUpload, type UploadedFile } from "@/components/ui/file-upload";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { titleCase } from "@/lib/utils";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { withBasePath } from "@/lib/base-path";

export interface CourseChoice {
  id: string;
  name: string;
  code: string;
  status: string;
  durationText: string;
}

/** Checkbox editor that replaces the set of courses offered at a center (PUT /courses). */
export function CenterCoursesEditor({ centerId, courses, selected, canEdit }: { centerId: string; courses: CourseChoice[]; selected: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [ids, setIds] = React.useState<string[]>(selected);
  const { loading, error, submit } = useApiForm();
  const dirty = ids.length !== selected.length || ids.some((i) => !selected.includes(i));

  const save = async () => {
    const res = await submit(() => api.put(`/api/admin/centers/${centerId}/courses`, { courseIds: ids }), { silent: true });
    if (res !== undefined) {
      toast.success("Courses updated", `${ids.length} course${ids.length === 1 ? "" : "s"} offered at this center.`);
      router.refresh();
    }
  };

  if (courses.length === 0) return <EmptyState title="No courses exist yet" description="Create courses under Academics → Courses, then add them to this center." />;

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Checkbox key={c.id} checked={ids.includes(c.id)} disabled={!canEdit} onChange={() => setIds((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]))} label={c.name} description={`${c.code} · ${c.durationText}${c.status !== "ACTIVE" ? ` · ${titleCase(c.status)}` : ""}`} className="rounded-md border border-line bg-white p-3" />
        ))}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-caption text-muted">A course with upcoming or ongoing batches at this center cannot be removed.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIds(selected)} disabled={!dirty || loading}>
              Reset
            </Button>
            <Button type="button" size="sm" onClick={save} loading={loading} disabled={!dirty}>
              Save courses
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface GalleryImage {
  id: string;
  url: string;
  caption: string | null;
}

/** Upload photos to the center gallery and remove them. */
export function CenterGalleryManager({ centerId, images, canEdit }: { centerId: string; images: GalleryImage[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<UploadedFile | null>(null);
  const [caption, setCaption] = React.useState("");
  const { loading, error, fieldErrors, submit } = useApiForm();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const res = await submit(() => api.post(`/api/admin/centers/${centerId}/gallery`, { url: file.url, caption: caption || null }), { silent: true });
    if (res !== undefined) {
      toast.success("Photo added");
      setOpen(false);
      setFile(null);
      setCaption("");
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" leftIcon={<ImagePlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Add photo
          </Button>
        </div>
      )}
      {images.length === 0 ? (
        <EmptyState icon={<ImagePlus className="h-7 w-7" />} title="No photos yet" description="Photos appear in the gallery on the public center page." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={withBasePath(img.url)} alt={img.caption ?? "Center photo"} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="truncate text-caption text-muted">{img.caption || "No caption"}</p>
                {canEdit && (
                  <ConfirmAction method="delete" url={`/api/admin/centers/${centerId}/gallery/${img.id}`} title="Remove this photo?" description="The photo is removed from the gallery on the website." confirmLabel="Remove" danger successMessage="Photo removed" icon={<Trash2 className="h-3.5 w-3.5" />}>
                    Remove
                  </ConfirmAction>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Add a gallery photo">
        <form onSubmit={add} className="space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Photo" required error={fieldErrors.url}>
            <FileUpload endpoint="/api/admin/uploads" fields={{ preset: "image", folder: "centers/gallery", visibility: "public" }} accept=".jpg,.jpeg,.png,.webp" value={file} onChange={setFile} label="Upload photo" />
          </Field>
          <Field label="Caption" htmlFor="gal-caption" error={fieldErrors.caption}>
            <Input id="gal-caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={160} placeholder="e.g. Computer lab" />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!file}>
              Add photo
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
