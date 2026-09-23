"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/ui/icon";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { IconPicker } from "@/components/admin/shared/icon-picker";

export interface BlogCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  colorTone: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Every post in the category, live or not — this is the delete guard, not a public count. */
  posts: number;
}

/**
 * The seven `BadgeTone` values, in the same order as `CATEGORY_TONES` in `src/server/blog.ts`
 * (which is what the Zod enum accepts). Written out rather than imported from the service,
 * because that module opens a database connection and this is a client component.
 */
const TONES: BadgeTone[] = ["neutral", "navy", "orange", "success", "warning", "danger", "info"];

/**
 * `""` and `"neutral"` paint the identical grey chip, so the picker offers the empty value only —
 * two options that look the same is a choice nobody can make correctly. Colour names are used
 * rather than token names because "Amber" is what an editor sees; "warning" is what we store.
 */
const TONE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Grey (default)" },
  { value: "navy", label: "Navy" },
  { value: "orange", label: "Orange" },
  { value: "info", label: "Blue" },
  { value: "success", label: "Green" },
  { value: "warning", label: "Amber" },
  { value: "danger", label: "Red" },
];

/** Narrows the free-form `colorTone` column to a tone `Badge` actually knows. */
export function categoryTone(value: string | null | undefined): BadgeTone {
  return TONES.includes(value as BadgeTone) ? (value as BadgeTone) : "neutral";
}

function CategoryForm({ initial, onDone, onCancel }: { initial?: BlogCategoryRow; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [icon, setIcon] = React.useState(initial?.icon ?? "");
  // A stored "neutral" folds onto the empty option, which is the same grey — otherwise the select
  // would render with nothing selected for a value it perfectly well supports.
  const [colorTone, setColorTone] = React.useState(initial?.colorTone && initial.colorTone !== "neutral" ? initial.colorTone : "");
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true);
  const [seoTitle, setSeoTitle] = React.useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = React.useState(initial?.seoDescription ?? "");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name,
      description: description || null,
      icon: icon || null,
      // "" is a value the server accepts and stores as null ("no tone"), so it is sent as-is.
      colorTone,
      sortOrder: Number(sortOrder) || 0,
      isActive,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
    };
    const res = await submit(() => (initial ? api.put(`/api/admin/blog/categories/${initial.id}`, body) : api.post("/api/admin/blog/categories", body)), { silent: true });
    if (res !== undefined) {
      toast.success(initial ? "Category updated" : "Category added", name);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <FormGrid>
        <Field label="Name" htmlFor="bcat-name" required error={fieldErrors.name} hint="The web address is derived from the name and only moves when you rename the category." className="sm:col-span-2">
          <Input
            id="bcat-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearField("name");
            }}
            required
            maxLength={80}
            invalid={!!fieldErrors.name}
            autoFocus
          />
        </Field>
        <Field label="Description" htmlFor="bcat-desc" error={fieldErrors.description} hint="Shown under the heading on the category page." className="sm:col-span-2">
          <Textarea id="bcat-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
        </Field>
        <Field label="Icon" htmlFor="bcat-icon" error={fieldErrors.icon} className="sm:col-span-2">
          <IconPicker id="bcat-icon" value={icon} onChange={setIcon} />
        </Field>
        <Field label="Colour" htmlFor="bcat-tone" error={fieldErrors.colorTone} hint="Tints the category chip on the blog.">
          <Select id="bcat-tone" value={colorTone} onChange={(e) => setColorTone(e.target.value)} options={TONE_OPTIONS} invalid={!!fieldErrors.colorTone} />
        </Field>
        <div className="flex items-end pb-1">
          {/* A live sample: "Amber" and "Blue" mean very little until the chip is actually in front of you. */}
          <span className="flex items-center gap-2">
            <span className="text-caption text-muted">Preview</span>
            <Badge tone={categoryTone(colorTone)}>{name.trim() || "Category"}</Badge>
          </span>
        </div>
        <Field label="Sort order" htmlFor="bcat-sort" error={fieldErrors.sortOrder} hint="Lower numbers come first in the chip row.">
          <Input id="bcat-sort" type="number" min={0} max={9999} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <div className="flex items-end pb-1">
          <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" description="Inactive categories are hidden on the website." />
        </div>
        <Field label="SEO title" htmlFor="bcat-seo-title" error={fieldErrors.seoTitle} hint="Leave empty to use the category name." className="sm:col-span-2">
          <Input id="bcat-seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} />
        </Field>
        <Field label="SEO description" htmlFor="bcat-seo-desc" error={fieldErrors.seoDescription} hint="Leave empty to use the description above." className="sm:col-span-2">
          <Textarea id="bcat-seo-desc" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} maxLength={400} />
        </Field>
      </FormGrid>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save changes" : "Add category"}
        </Button>
      </div>
    </form>
  );
}

export function BlogCategoryManager({ categories, canCreate, canUpdate, canDelete }: { categories: BlogCategoryRow[]; canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<BlogCategoryRow | null>(null);
  const done = () => {
    setCreating(false);
    setEditing(null);
    router.refresh();
  };
  const anyInUse = categories.some((c) => c.posts > 0);

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Add category
          </Button>
        </div>
      )}
      {canDelete && anyInUse && (
        // The server refuses that delete with `Errors.conflict`, because the foreign key is SetNull:
        // an unguarded delete would quietly strip the category off every post instead of failing.
        // Saying so once, above the table, beats a disabled button with no explanation beside it.
        <Alert tone="info">A category that still holds posts cannot be deleted. Move those posts to another category first, or simply untick Active to take it off the website.</Alert>
      )}
      <TableWrap>
        <THead>
          <tr>
            <TH>Category</TH>
            <TH>Description</TH>
            <TH className="text-right">Posts</TH>
            <TH className="text-right">Order</TH>
            <TH>Status</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {categories.length === 0 && <EmptyRow colSpan={6}>No blog categories yet.</EmptyRow>}
          {categories.map((c) => (
            <TR key={c.id}>
              <TD label="Category" primary>
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lavender text-navy" aria-hidden>
                    <DynamicIcon name={c.icon ?? undefined} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <Badge tone={categoryTone(c.colorTone)}>{c.name}</Badge>
                    <span className="mt-1 block truncate font-mono text-caption text-muted">/blog/category/{c.slug}</span>
                  </span>
                </span>
              </TD>
              <TD label="Description" mobile="hidden" className="max-w-md text-body-sm text-muted">
                {c.description || "—"}
              </TD>
              <TD label="Posts" className="text-right tabular-nums">
                {c.posts > 0 ? (
                  // The count is the delete guard, so it is also the way out of it: this lands on the
                  // post list already filtered to the posts that have to move.
                  <Link href={`/admin/blog?categoryId=${c.id}`} className="ring-focus inline-flex min-h-11 items-center rounded-md px-1 font-semibold text-navy underline-offset-2 tap-highlight-none hover:underline md:min-h-0">
                    {c.posts}
                    <span className="sr-only"> posts in {c.name}</span>
                  </Link>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </TD>
              <TD label="Order" mobile="hidden" className="text-right tabular-nums">
                {c.sortOrder}
              </TD>
              <TD label="Status">
                <Badge tone={c.isActive ? "success" : "neutral"} dot>
                  {c.isActive ? "Active" : "Inactive"}
                </Badge>
              </TD>
              <TD actions className="text-right">
                <span className="inline-flex gap-1">
                  {canUpdate && (
                    <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <ConfirmAction
                      danger
                      method="delete"
                      url={`/api/admin/blog/categories/${c.id}`}
                      title={`Delete ${c.name}?`}
                      description={c.posts > 0 ? `${c.posts} post(s) still use this category. Move them first, or untick Active to hide it.` : "This permanently removes the category. No post is affected."}
                      confirmLabel="Delete"
                      successMessage="Category deleted"
                      disabled={c.posts > 0}
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Delete
                    </ConfirmAction>
                  )}
                </span>
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
      <Modal open={creating} onClose={() => setCreating(false)} title="Add a blog category" size="lg">
        <CategoryForm onCancel={() => setCreating(false)} onDone={done} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} size="lg">
        {editing && <CategoryForm initial={editing} onCancel={() => setEditing(null)} onDone={done} />}
      </Modal>
    </div>
  );
}
