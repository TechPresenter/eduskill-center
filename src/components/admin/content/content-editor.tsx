"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { api, ApiClientError } from "@/lib/api-client";
import { FormFields, finalizeSlugs, type FieldDef, type FormValues } from "@/components/admin/content/fields";

export interface ContentEditorProps {
  /** Collection endpoint, e.g. `/api/admin/blog`. POST for new, PUT/DELETE at `${endpoint}/${id}`. */
  endpoint: string;
  /** Record id when editing; omit to create. */
  id?: string;
  fields: FieldDef[];
  initial: FormValues;
  /** Singular noun, e.g. "blog post". */
  itemLabel: string;
  /** List page, e.g. `/admin/blog`. New records navigate to `${backHref}/${id}` after creation. */
  backHref: string;
  canEdit: boolean;
  canDelete?: boolean;
  /** Explains why deleting is unavailable (rendered instead of the button). */
  deleteLocked?: string | null;
  /** Public URL to preview the record (shown when set). */
  viewHref?: string | null;
  /** Small status line under the actions (e.g. "Last saved …"). */
  meta?: string | null;
  /** Rendered above the form (e.g. informational alerts). */
  children?: React.ReactNode;
}

export function ContentEditor({ endpoint, id, fields, initial, itemLabel, backHref, canEdit, canDelete = canEdit, deleteLocked, viewHref, meta, children }: ContentEditorProps) {
  const router = useRouter();
  const [values, setValues] = React.useState<FormValues>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const onChange = (v: FormValues) => {
    setValues(v);
    setDirty(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = finalizeSlugs(fields, values);
      if (id) {
        await api.put(`${endpoint}/${id}`, payload);
        toast.success(`${cap(itemLabel)} saved`);
        setDirty(false);
        router.refresh();
      } else {
        const created = await api.post<{ id: string }>(endpoint, payload);
        toast.success(`${cap(itemLabel)} created`);
        setDirty(false);
        router.push(`${backHref}/${created.id}`);
        router.refresh();
      }
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
    if (!id) return;
    setSaving(true);
    try {
      await api.delete(`${endpoint}/${id}`);
      toast.success(`${cap(itemLabel)} deleted`);
      setConfirmDelete(false);
      router.push(backHref);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete", err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      {!canEdit && <Alert tone="info">You can view this {itemLabel} but need the &ldquo;Edit Website Content&rdquo; permission to change it.</Alert>}
      {children}
      <div className="card p-5">
        <FormFields fields={fields} values={values} onChange={onChange} errors={errors} disabled={!canEdit || saving} idPrefix="ce" />
      </div>
      {/* Phones / tablets: secondary controls stay in the page, Save sits in the sticky bar below. */}
      <div className="space-y-2 lg:hidden">
        <p className="text-xs text-muted">
          {meta}
          {dirty && <span className={meta ? "ml-2 font-semibold text-orange" : "font-semibold text-orange"}>Unsaved changes</span>}
        </p>
        {viewHref && (
          <a href={viewHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-navy tap-highlight-none">
            <ExternalLink className="h-4 w-4" /> View on site
          </a>
        )}
        {id && canDelete && !deleteLocked && (
          <Button type="button" variant="outline" className="w-full text-danger" onClick={() => setConfirmDelete(true)} disabled={saving} leftIcon={<Trash2 className="h-4 w-4" />}>
            Delete {itemLabel}
          </Button>
        )}
        {id && canDelete && deleteLocked && (
          <p className="text-xs text-muted" title={deleteLocked}>
            {deleteLocked}
          </p>
        )}
      </div>

      <StickyActionBar innerClassName="lg:justify-between">
        <p className="hidden text-xs text-muted lg:block">
          {meta}
          {dirty && <span className={meta ? "ml-2 font-semibold text-orange" : "font-semibold text-orange"}>Unsaved changes</span>}
        </p>
        <div className="flex w-full items-center gap-2 lg:w-auto lg:flex-wrap">
          <Link href={backHref} className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink tap-highlight-none lg:h-11 lg:flex-none hover:bg-surface">
            Back
          </Link>
          {viewHref && (
            <a href={viewHref} target="_blank" rel="noopener noreferrer" className="hidden h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-navy hover:bg-surface lg:inline-flex">
              <ExternalLink className="h-4 w-4" /> View on site
            </a>
          )}
          {id && canDelete && !deleteLocked && (
            <Button type="button" variant="outline" className="hidden text-danger hover:border-danger/40 lg:inline-flex" onClick={() => setConfirmDelete(true)} disabled={saving} leftIcon={<Trash2 className="h-4 w-4" />}>
              Delete
            </Button>
          )}
          {id && canDelete && deleteLocked && (
            <span className="hidden text-xs text-muted lg:inline" title={deleteLocked}>
              {deleteLocked}
            </span>
          )}
          {canEdit && (
            <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />} className="flex-2 lg:flex-none">
              {id ? "Save changes" : `Create ${itemLabel}`}
            </Button>
          )}
        </div>
      </StickyActionBar>
      <ConfirmDialog open={confirmDelete} onClose={() => !saving && setConfirmDelete(false)} onConfirm={remove} title={`Delete this ${itemLabel}?`} description="It will be removed from the website immediately. This cannot be undone." confirmLabel="Delete" danger loading={saving} />
    </form>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
