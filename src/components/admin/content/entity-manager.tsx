"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { FormFields, finalizeSlugs, type FieldDef, type FormValues } from "@/components/admin/content/fields";

export interface Column<T> {
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  /**
   * Card-mode role below `md`: "full" = the card title row (defaults to the first column),
   * "hidden" drops the cell on phones. Other cells show the column header as their label.
   */
  mobile?: "full" | "hidden";
  /** Overrides the card-mode label (defaults to `header`). */
  label?: string;
}

export interface EntityManagerProps<T extends { id: string }> {
  items: T[];
  columns: Column<T>[];
  fields: FieldDef[];
  /** POST here; PUT/DELETE at `${endpoint}/${id}`; reorder POST at `${endpoint}/reorder`. */
  endpoint: string;
  toValues: (item: T) => FormValues;
  emptyValues: FormValues;
  /** Singular noun, e.g. "program". */
  itemLabel: string;
  itemName?: (item: T) => string;
  canEdit: boolean;
  canDelete?: boolean;
  reorder?: boolean;
  modalSize?: "md" | "lg" | "xl";
  addLabel?: string;
  extraActions?: (item: T) => React.ReactNode;
  deleteDescription?: (item: T) => React.ReactNode;
  emptyText?: string;
  /** Rendered above the table (e.g. counts). */
  toolbar?: React.ReactNode;
  className?: string;
}

export function EntityManager<T extends { id: string }>({
  items,
  columns,
  fields,
  endpoint,
  toValues,
  emptyValues,
  itemLabel,
  itemName,
  canEdit,
  canDelete = canEdit,
  reorder,
  modalSize = "lg",
  addLabel,
  extraActions,
  deleteDescription,
  emptyText,
  toolbar,
  className,
}: EntityManagerProps<T>) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<T | null | "new">(null);
  const [values, setValues] = React.useState<FormValues>(emptyValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<T | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const open = (item: T | "new") => {
    setEditing(item);
    setValues(item === "new" ? emptyValues : toValues(item));
    setErrors({});
    setFormError(null);
  };
  const close = () => {
    if (saving) return;
    setEditing(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = finalizeSlugs(fields, values);
      if (editing === "new") await api.post(endpoint, payload);
      else await api.put(`${endpoint}/${editing.id}`, payload);
      toast.success(editing === "new" ? `${cap(itemLabel)} created` : `${cap(itemLabel)} updated`);
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
    setBusyId(deleting.id);
    try {
      await api.delete(`${endpoint}/${deleting.id}`);
      toast.success(`${cap(itemLabel)} deleted`);
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusyId(items[index]!.id);
    try {
      await api.post(`${endpoint}/reorder`, { ids });
      router.refresh();
    } catch (err) {
      toast.error("Could not reorder", err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  };

  const hasActions = canEdit || canDelete || reorder || extraActions;

  return (
    <div className={className}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted">{toolbar ?? `${items.length} ${items.length === 1 ? itemLabel : `${itemLabel}s`}`}</div>
        {canEdit && (
          <Button size="sm" onClick={() => open("new")} leftIcon={<Plus className="h-4 w-4" />} className="w-full sm:w-auto">
            {addLabel ?? `Add ${itemLabel}`}
          </Button>
        )}
      </div>

      <TableWrap>
        <THead>
          <tr>
            {reorder && <TH className="md:w-10">#</TH>}
            {columns.map((c) => (
              <TH key={c.header} className={c.className}>
                {c.header}
              </TH>
            ))}
            {hasActions && <TH className="text-right">Actions</TH>}
          </tr>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={columns.length + (reorder ? 1 : 0) + (hasActions ? 1 : 0)}>{emptyText ?? `No ${itemLabel}s yet.`}</EmptyRow>
          ) : (
            items.map((item, idx) => (
              <TR key={item.id}>
                {reorder && (
                  <TD mobile="hidden" className="text-xs text-muted tabular-nums">
                    {idx + 1}
                  </TD>
                )}
                {columns.map((c, ci) => (
                  <TD key={c.header} label={c.label} mobile={c.mobile ?? (ci === 0 ? "full" : undefined)} className={c.className}>
                    {c.render(item)}
                  </TD>
                ))}
                {hasActions && (
                  <TD mobile="actions" className="text-right">
                    <div className="inline-flex items-center gap-1 max-md:gap-0.5">
                      {extraActions?.(item)}
                      {reorder && canEdit && (
                        <>
                          <button type="button" onClick={() => void move(idx, -1)} disabled={idx === 0 || busyId === item.id} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted tap-highlight-none md:h-8 md:w-8 hover:bg-surface hover:text-navy disabled:opacity-30" aria-label="Move up">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => void move(idx, 1)} disabled={idx === items.length - 1 || busyId === item.id} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted tap-highlight-none md:h-8 md:w-8 hover:bg-surface hover:text-navy disabled:opacity-30" aria-label="Move down">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {canEdit && (
                        <button type="button" onClick={() => open(item)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted tap-highlight-none md:h-8 md:w-8 hover:bg-surface hover:text-navy" aria-label={`Edit ${itemName?.(item) ?? itemLabel}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => setDeleting(item)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted tap-highlight-none md:h-8 md:w-8 hover:bg-danger-light hover:text-danger" aria-label={`Delete ${itemName?.(item) ?? itemLabel}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TD>
                )}
              </TR>
            ))
          )}
        </TBody>
      </TableWrap>

      <Modal open={!!editing} onClose={close} title={editing === "new" ? `Add ${itemLabel}` : `Edit ${itemLabel}`} size={modalSize}>
        <form onSubmit={save} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <FormFields fields={fields} values={values} onChange={setValues} errors={errors} disabled={saving} idPrefix={`em-${itemLabel}`} />
          <div className={cn("flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end")}>
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing === "new" ? "Create" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={`Delete ${itemLabel}?`}
        description={deleting ? (deleteDescription?.(deleting) ?? `"${itemName?.(deleting) ?? "This item"}" will be permanently removed. This cannot be undone.`) : null}
        confirmLabel="Delete"
        danger
        loading={!!busyId}
      />
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
