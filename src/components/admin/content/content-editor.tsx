"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe, ImageIcon, Save, Trash2 } from "lucide-react";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { api, ApiClientError } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { slugify, truncate } from "@/lib/utils";
import { FormFields, finalizeSlugs, str, type FieldDef, type FormValues } from "@/components/admin/content/fields";
import { SaveStatus, type SaveState } from "@/components/admin/content/app-list";
import { useUnsavedChangesWarning } from "@/components/admin/content/use-unsaved";

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
  /** Public URL to preview the record (shown when set). App-absolute paths get the deployment base path. */
  viewHref?: string | null;
  /** Small status line under the actions (e.g. "Last saved …"). */
  meta?: string | null;
  /**
   * Public URL prefix of the record (`/blog`, `/events`, `` for pages). Enables the live listing and
   * search-result preview beside the form on wide screens.
   */
  publicPrefix?: string;
  /** Rendered above the form (e.g. informational alerts). */
  children?: React.ReactNode;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** How the record will look in a listing card and as a search result, updated as the author types. */
function LivePreview({ values, publicPrefix }: { values: FormValues; publicPrefix: string }) {
  const title = str(values.title) || "Untitled";
  const summary = str(values.excerpt) || str(values.summary);
  const image = str(values.coverImage) || str(values.image);
  const slug = str(values.slug) || slugify(str(values.title)) || "your-address";
  const status = str(values.status);
  const seoTitle = str(values.seoTitle) || title;
  const seoDescription = str(values.seoDescription) || summary;
  return (
    <div className="space-y-4">
      <section aria-labelledby="pv-card" className="card overflow-hidden">
        <h2 id="pv-card" className="sr-only">
          Listing preview
        </h2>
        <div className="media media-16x9 rounded-none">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBasePath(image)} alt="" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-navy/40" aria-hidden>
              <ImageIcon className="h-8 w-8" />
            </span>
          )}
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-overline text-muted">Listing preview</p>
            {status && <StatusBadge status={status} />}
          </div>
          <p className="text-h4 break-words text-navy">{title}</p>
          <p className="text-body-sm text-muted">{summary ? truncate(summary, 160) : "Add a summary to show a line of text here."}</p>
        </div>
      </section>
      <section aria-labelledby="pv-seo" className="card space-y-1 p-4">
        <h2 id="pv-seo" className="mb-2 flex items-center gap-2 text-overline text-muted">
          <Globe className="h-4 w-4" aria-hidden /> Search result
        </h2>
        <p className="truncate font-mono text-caption text-success-dark">
          {publicPrefix}/{slug}
        </p>
        <p className="text-body font-semibold break-words text-navy-light">{truncate(seoTitle, 70)}</p>
        <p className="text-body-sm text-muted">{seoDescription ? truncate(seoDescription, 160) : "Search engines will pick text from the page."}</p>
      </section>
    </div>
  );
}

export function ContentEditor({ endpoint, id, fields, initial, itemLabel, backHref, canEdit, canDelete = canEdit, deleteLocked, viewHref, meta, publicPrefix, children }: ContentEditorProps) {
  const router = useRouter();
  const [saved, setSaved] = React.useState<FormValues>(initial);
  const [values, setValues] = React.useState<FormValues>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty && canEdit && !saving);
  const state: SaveState = saving ? "saving" : formError ? "error" : dirty ? "dirty" : justSaved ? "saved" : "clean";
  const idle = meta ?? (id ? undefined : `New ${itemLabel} – not saved yet`);

  const onChange = (v: FormValues) => {
    setValues(v);
    setJustSaved(false);
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
        setSaved(values);
        setJustSaved(true);
        router.refresh();
      } else {
        const created = await api.post<{ id: string }>(endpoint, payload);
        toast.success(`${cap(itemLabel)} created`);
        setSaved(values);
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
      setSaved(values);
      router.push(backHref);
      router.refresh();
    } catch (err) {
      toast.error("Could not delete", err instanceof Error ? err.message : undefined);
      setSaving(false);
    }
  };

  const view = viewHref ? withBasePath(viewHref) : null;
  const preview = publicPrefix !== undefined;

  return (
    <form onSubmit={save} className="space-y-4 lg:space-y-6" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      {!canEdit && <Alert tone="info">You can view this {itemLabel} but need the &ldquo;Edit Website Content&rdquo; permission to change it.</Alert>}
      {children}

      <div className={preview ? "grid gap-4 xl:grid-cols-3 xl:gap-6" : undefined}>
        <div className={preview ? "xl:col-span-2" : undefined}>
          <div className="card card-p">
            <FormFields fields={fields} values={values} onChange={onChange} errors={errors} disabled={!canEdit || saving} idPrefix="ce" />
          </div>
        </div>
        {preview && (
          <aside className="hidden xl:block" aria-label="Live preview">
            <div className="sticky top-20">
              <LivePreview values={values} publicPrefix={publicPrefix} />
            </div>
          </aside>
        )}
      </div>

      {/* Phones / tablets: secondary controls stay in the page, Save sits in the sticky bar below. */}
      {(view || (id && canDelete)) && (
        <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
          {view && (
            <a href={view} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "outline", size: "md", fullWidth: true })}>
              <ExternalLink className="h-4 w-4" aria-hidden /> View on site
            </a>
          )}
          {id && canDelete && !deleteLocked && (
            <Button type="button" variant="outline" fullWidth className="text-danger" onClick={() => setConfirmDelete(true)} disabled={saving} leftIcon={<Trash2 className="h-4 w-4" />}>
              Delete {itemLabel}
            </Button>
          )}
          {id && canDelete && deleteLocked && <p className="text-caption text-muted sm:col-span-2">{deleteLocked}</p>}
        </div>
      )}

      <StickyActionBar innerClassName="flex-col lg:flex-row lg:items-center lg:justify-between">
        <SaveStatus state={state} idle={idle} className="justify-center lg:justify-start" />
        <div className="flex w-full items-center gap-2 lg:w-auto lg:flex-wrap">
          <ButtonLink href={backHref} variant="outline" className="flex-1 lg:flex-none">
            Back
          </ButtonLink>
          {view && (
            <a href={view} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "outline", className: "hidden lg:inline-flex" })}>
              <ExternalLink className="h-4 w-4" aria-hidden /> View on site
            </a>
          )}
          {id && canDelete && !deleteLocked && (
            <Button type="button" variant="outline" className="hidden text-danger hover:border-danger/40 lg:inline-flex" onClick={() => setConfirmDelete(true)} disabled={saving} leftIcon={<Trash2 className="h-4 w-4" />}>
              Delete
            </Button>
          )}
          {id && canDelete && deleteLocked && (
            <span className="hidden max-w-xs text-caption text-muted lg:inline" title={deleteLocked}>
              {deleteLocked}
            </span>
          )}
          {canEdit && (
            <Button type="submit" loading={saving} disabled={!!id && !dirty} leftIcon={<Save className="h-4 w-4" />} className="flex-2 lg:flex-none">
              {id ? "Save changes" : `Create ${itemLabel}`}
            </Button>
          )}
        </div>
      </StickyActionBar>
      <ConfirmDialog open={confirmDelete} onClose={() => !saving && setConfirmDelete(false)} onConfirm={remove} title={`Delete this ${itemLabel}?`} description="It will be removed from the website immediately. This cannot be undone." confirmLabel="Delete" danger loading={saving} />
    </form>
  );
}
