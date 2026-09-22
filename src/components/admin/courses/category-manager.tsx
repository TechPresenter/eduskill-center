"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/ui/icon";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";
import { IconPicker } from "@/components/admin/shared/icon-picker";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  courses: number;
}

function CategoryForm({ initial, onDone, onCancel }: { initial?: CategoryRow; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [icon, setIcon] = React.useState(initial?.icon ?? "");
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name, description: description || null, icon: icon || null, sortOrder: Number(sortOrder) || 0, isActive };
    const res = await submit(() => (initial ? api.put(`/api/admin/courses/categories/${initial.id}`, body) : api.post("/api/admin/courses/categories", body)), { silent: true });
    if (res !== undefined) {
      toast.success(initial ? "Category updated" : "Category added", name);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <FormGrid>
        <Field label="Name" htmlFor="cat-name" required error={fieldErrors.name} className="sm:col-span-2">
          <Input id="cat-name" value={name} onChange={(e) => { setName(e.target.value); clearField("name"); }} required maxLength={80} invalid={!!fieldErrors.name} autoFocus />
        </Field>
        <Field label="Description" htmlFor="cat-desc" error={fieldErrors.description} className="sm:col-span-2">
          <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
        </Field>
        <Field label="Icon" htmlFor="cat-icon" error={fieldErrors.icon} className="sm:col-span-2">
          <IconPicker id="cat-icon" value={icon} onChange={setIcon} />
        </Field>
        <Field label="Sort order" htmlFor="cat-sort" error={fieldErrors.sortOrder}>
          <Input id="cat-sort" type="number" min={0} max={10000} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <div className="flex items-end pb-1">
          <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" description="Inactive categories are hidden on the website." />
        </div>
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

export function CategoryManager({ categories, canCreate, canUpdate, canDelete }: { categories: CategoryRow[]; canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const done = () => {
    setCreating(false);
    setEditing(null);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Add category
          </Button>
        </div>
      )}
      <TableWrap>
        <THead>
          <tr>
            <TH>Category</TH>
            <TH>Description</TH>
            <TH className="text-right">Courses</TH>
            <TH className="text-right">Order</TH>
            <TH>Status</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {categories.length === 0 && <EmptyRow colSpan={6}>No categories yet.</EmptyRow>}
          {categories.map((c) => (
            <TR key={c.id}>
              <TD>
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
                    <DynamicIcon name={c.icon ?? undefined} className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block font-mono text-caption text-muted">{c.slug}</span>
                  </span>
                </span>
              </TD>
              <TD className="max-w-md text-body-sm text-muted">{c.description || "—"}</TD>
              <TD className="text-right tabular-nums">{c.courses}</TD>
              <TD className="text-right tabular-nums">{c.sortOrder}</TD>
              <TD>
                <Badge tone={c.isActive ? "success" : "neutral"} dot>
                  {c.isActive ? "Active" : "Inactive"}
                </Badge>
              </TD>
              <TD className="text-right">
                <span className="inline-flex gap-1">
                  {canUpdate && (
                    <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <ConfirmAction danger method="delete" url={`/api/admin/courses/categories/${c.id}`} title={`Delete ${c.name}?`} description={c.courses > 0 ? `${c.courses} course(s) use this category. Move them first or deactivate the category.` : "This permanently removes the category."} confirmLabel="Delete" successMessage="Category deleted" disabled={c.courses > 0} icon={<Trash2 className="h-3.5 w-3.5" />}>
                      Delete
                    </ConfirmAction>
                  )}
                </span>
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
      <Modal open={creating} onClose={() => setCreating(false)} title="Add a course category" size="lg">
        <CategoryForm onCancel={() => setCreating(false)} onDone={done} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} size="lg">
        {editing && <CategoryForm initial={editing} onCancel={() => setEditing(null)} onDone={done} />}
      </Modal>
    </div>
  );
}
