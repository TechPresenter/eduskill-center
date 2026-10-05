"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Images, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Checkbox } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { CourseMediaKind } from "@/generated/prisma/enums";
import type { CourseMediaDto } from "@/server/course-cms";
import { ImageField } from "@/components/admin/shared/image-field";
import { DragHandle, ReorderButtons, SortInstructions, SortStatus, sortableRowClasses, useSortable } from "@/components/admin/courses/sortable";

/**
 * Course media: the four single slots on `Course` itself, plus the two repeatable `CourseMedia`
 * sets (gallery and promotional), each with its own order and alt text.
 *
 * Every image goes through `ImageField` → POST /api/admin/uploads → `src/lib/storage`. Nothing is
 * inlined as base64: the services reject a `data:` URL outright.
 */

export interface MediaSlots {
  bannerImage: string;
  instructorImage: string;
  promoVideoUrl: string;
  videoThumbnail: string;
}

/* ───────────────────────────── The four single slots ───────────────────────────── */

const same = (a: MediaSlots, b: MediaSlots) => JSON.stringify(a) === JSON.stringify(b);

function SlotsCard({ courseId, slots, canEdit }: { courseId: string; slots: MediaSlots; canEdit: boolean }) {
  const router = useRouter();
  const [values, setValues] = React.useState<MediaSlots>(slots);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // New server values (after a save, or someone else's edit) become the baseline. Adjusted during
  // render, not in an effect: the prop is a fresh object every time, so the comparison is by value.
  const slotsKey = JSON.stringify(slots);
  const [syncedKey, setSyncedKey] = React.useState(slotsKey);
  const stale = syncedKey !== slotsKey;
  if (stale) {
    setSyncedKey(slotsKey);
    setValues(slots);
  }
  const form = stale ? slots : values;

  const dirty = !same(form, slots);
  const set = <K extends keyof MediaSlots>(k: K, v: MediaSlots[K]) => setValues((cur) => ({ ...cur, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      await api.put(`/api/admin/courses/${courseId}/media-slots`, form);
      toast.success("Course media saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <Card>
        <CardHeader title="Key images and video" description="One of each. These are the images the course page leads with." />
        <CardBody className="space-y-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <FormGrid>
            <Field label="Banner image" error={errors.bannerImage} hint="The wide image across the top of the course page.">
              <ImageField value={form.bannerImage} onChange={(v) => set("bannerImage", v)} folder={`courses/${courseId}`} disabled={saving} />
            </Field>
            <Field label="Instructor photo" error={errors.instructorImage} hint="The trainer shown beside the course introduction.">
              <ImageField value={form.instructorImage} onChange={(v) => set("instructorImage", v)} folder={`courses/${courseId}`} disabled={saving} />
            </Field>
            <Field label="Promo video" error={errors.promoVideoUrl} hint="A YouTube or Vimeo link for the course trailer.">
              <Input value={form.promoVideoUrl} onChange={(e) => set("promoVideoUrl", e.target.value)} disabled={saving} inputMode="url" placeholder="https://www.youtube.com/watch?v=…" />
            </Field>
            <Field label="Video thumbnail" error={errors.videoThumbnail} hint="The still shown before the video plays.">
              <ImageField value={form.videoThumbnail} onChange={(v) => set("videoThumbnail", v)} folder={`courses/${courseId}`} disabled={saving} />
            </Field>
          </FormGrid>
        </CardBody>
      </Card>
      {canEdit && dirty && (
        <StickyActionBar>
          <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-caption text-muted sm:mr-auto" role="status">
              {saving ? "Saving…" : "Unsaved changes to the key images"}
            </p>
            <Button type="button" variant="ghost" onClick={() => setValues(slots)} disabled={saving} leftIcon={<RotateCcw className="h-4 w-4" />}>
              Reset
            </Button>
            <Button type="submit" loading={saving}>
              Save media
            </Button>
          </div>
        </StickyActionBar>
      )}
    </form>
  );
}

/* ───────────────────────────── A repeatable, ordered set ───────────────────────────── */

interface MediaForm {
  url: string;
  alt: string;
  caption: string;
  isActive: boolean;
}

const blankForm: MediaForm = { url: "", alt: "", caption: "", isActive: true };
const toForm = (m: CourseMediaDto): MediaForm => ({ url: m.url, alt: m.alt ?? "", caption: m.caption ?? "", isActive: m.isActive });

function MediaSet({ courseId, kind, items, title, description, canEdit }: { courseId: string; kind: CourseMediaKind; items: CourseMediaDto[]; title: string; description: string; canEdit: boolean }) {
  const router = useRouter();
  const formId = React.useId();
  const [editing, setEditing] = React.useState<CourseMediaDto | "new" | null>(null);
  const [values, setValues] = React.useState<MediaForm>(blankForm);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CourseMediaDto | null>(null);
  const [removing, setRemoving] = React.useState(false);

  const ids = React.useMemo(() => items.map((m) => m.id), [items]);
  const byId = React.useMemo(() => new Map(items.map((m) => [m.id, m])), [items]);
  const labelOf = React.useCallback((id: string) => byId.get(id)?.alt || byId.get(id)?.caption || "Image", [byId]);

  const onCommit = React.useCallback(
    async (next: string[]) => {
      try {
        await api.post(`/api/admin/courses/${courseId}/media/reorder`, { kind, ids: next });
        router.refresh();
      } catch (err) {
        toast.error("Could not save the new order", errorMessage(err));
        throw err;
      }
    },
    [courseId, kind, router]
  );

  const sortable = useSortable({ ids, labelOf, onCommit, disabled: !canEdit });
  const ordered = sortable.order.map((id) => byId.get(id)).filter((m): m is CourseMediaDto => !!m);

  const set = <K extends keyof MediaForm>(k: K, v: MediaForm[K]) => setValues((cur) => ({ ...cur, [k]: v }));

  const open = (target: CourseMediaDto | "new") => {
    setValues(target === "new" ? blankForm : toForm(target));
    setErrors({});
    setFormError(null);
    setEditing(target);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    const payload = { kind, ...values };
    try {
      if (editing === "new") await api.post(`/api/admin/courses/${courseId}/media`, payload);
      else await api.put(`/api/admin/courses/${courseId}/media/${editing.id}`, payload);
      toast.success(editing === "new" ? "Image added" : "Image updated");
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await api.delete(`/api/admin/courses/${courseId}/media/${deleting.id}`);
      toast.success("Image removed");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete the image", errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={title}
        description={items.length === 0 ? description : `${items.length} image${items.length === 1 ? "" : "s"} · ${items.filter((m) => m.isActive).length} shown`}
        action={
          canEdit ? (
            <Button size="sm" variant="outline" onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />}>
              Add image
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        {items.length === 0 ? (
          <EmptyState size="sm" icon={<Images className="h-6 w-6" />} title="No images yet" description={description} action={canEdit ? <Button size="sm" onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />}>Add the first image</Button> : undefined} />
        ) : (
          <>
            <SortInstructions id={sortable.instructionsId} itemLabel="image" />
            <SortStatus message={sortable.message} />
            {canEdit && items.length > 1 && <p className="mb-3 text-caption text-muted">Drag the handle to reorder, or focus it and use the arrow keys.</p>}
            <ul className="space-y-2">
              {ordered.map((item) => {
                const label = item.alt || item.caption || "this image";
                const actions = (
                  <>
                    {canEdit && <ReorderButtons sortable={sortable} id={item.id} what={label} />}
                    {canEdit && <IconButton size="sm" icon={<Pencil className="h-4 w-4" />} aria-label={`Edit ${label}`} onClick={() => open(item)} />}
                    {canEdit && <IconButton size="sm" icon={<Trash2 className="h-4 w-4" />} aria-label={`Delete ${label}`} onClick={() => setDeleting(item)} className="hover:bg-danger-light hover:text-danger" />}
                  </>
                );
                return (
                  <li key={item.id}>
                    <div {...sortable.rowProps(item.id)} className={cn("flex items-start gap-1 rounded-card border border-line bg-white pr-1.5", sortableRowClasses(sortable, item.id), sortable.saving && "opacity-70")}>
                      {canEdit && <DragHandle sortable={sortable} id={item.id} className="mt-3" />}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={withBasePath(item.url)} alt={item.alt ?? ""} className="mt-3 h-14 w-20 shrink-0 rounded-md border border-line object-cover" />
                      <div className="min-w-0 flex-1 py-3 pl-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="min-w-0 font-medium text-ink">{item.alt || <span className="text-danger">Alt text missing</span>}</span>
                          {!item.isActive && <Badge tone="neutral">Hidden</Badge>}
                        </div>
                        {item.caption && <p className="mt-1 text-caption text-muted">{item.caption}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-0.5 sm:hidden">{actions}</div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-0.5 py-3 sm:flex">{actions}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardBody>

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        size="lg"
        title={editing === "new" ? `Add to ${title.toLowerCase()}` : "Edit image"}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              {editing === "new" ? "Add image" : "Save changes"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={save} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Image" required error={errors.url}>
            <ImageField value={values.url} onChange={(v) => set("url", v)} folder={`courses/${courseId}/${kind.toLowerCase()}`} disabled={saving} />
          </Field>
          <Field label="Alt text" error={errors.alt} hint="What the image shows, for someone who cannot see it. Screen readers read this out.">
            <Input value={values.alt} onChange={(e) => set("alt", e.target.value)} disabled={saving} maxLength={200} placeholder="Students at a computer in the Kolkata centre" />
          </Field>
          <Field label="Caption" error={errors.caption} hint="Optional text printed under the image.">
            <Input value={values.caption} onChange={(e) => set("caption", e.target.value)} disabled={saving} maxLength={300} />
          </Field>
          <Checkbox checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} disabled={saving} label="Show on the course page" />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete this image?" description="It will be removed from this course. The uploaded file itself is kept in storage." confirmLabel="Delete" danger loading={removing} />
    </Card>
  );
}

/* ───────────────────────────── The tab ───────────────────────────── */

export function MediaManager({ courseId, slots, gallery, promotional, canEdit }: { courseId: string; slots: MediaSlots; gallery: CourseMediaDto[]; promotional: CourseMediaDto[]; canEdit: boolean }) {
  const missingAlt = [...gallery, ...promotional].filter((m) => !m.alt).length;
  return (
    <div className="space-y-4">
      <SlotsCard courseId={courseId} slots={slots} canEdit={canEdit} />
      {missingAlt > 0 && (
        <Alert tone="warning" title="Alt text missing">
          {missingAlt} image{missingAlt === 1 ? " has" : "s have"} no alt text. Without it, a screen reader announces nothing at all for the image.
        </Alert>
      )}
      <MediaSet courseId={courseId} kind="GALLERY" items={gallery} title="Gallery" description="Photographs of the course being taught — the classroom, the equipment, the work students produce." canEdit={canEdit} />
      <MediaSet courseId={courseId} kind="PROMOTIONAL" items={promotional} title="Promotional set" description="Artwork for campaigns and social posts about this course." canEdit={canEdit} />
      {!canEdit && (
        <p className="flex items-center gap-2 text-caption text-muted">
          <ImageIcon className="h-4 w-4" aria-hidden /> You can view this course&apos;s media but not change it.
        </p>
      )}
    </div>
  );
}
