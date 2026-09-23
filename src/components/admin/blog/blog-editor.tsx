"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ListTree, Save, Trash2 } from "lucide-react";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FormGrid, FormSection } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { ErrorSummary } from "@/components/ui/error-summary";
import { ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { toast } from "@/components/ui/toast";
import { MediaPlaceholder } from "@/components/site/safe-image";
import { SaveStatus, type SaveState } from "@/components/admin/content/app-list";
import { useUnsavedChangesWarning } from "@/components/admin/content/use-unsaved";
import { api, ApiClientError } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { displayStatus } from "@/lib/blog/visibility";
import { slugify, truncate } from "@/lib/utils";
import { CoverImageField } from "@/components/admin/blog/cover-image-field";
import { BlogMarkdownEditor } from "@/components/admin/blog/markdown-editor";
import { OutlinePanel } from "@/components/admin/blog/outline-panel";
import { RelatedPicker } from "@/components/admin/blog/related-picker";
import { ScheduleField } from "@/components/admin/blog/schedule-field";
import { SeoPanel } from "@/components/admin/blog/seo-panel";
import { BlogTagField } from "@/components/admin/blog/tag-field";
import type { BlogFormValues, BlogOption, RelatedOption } from "@/components/admin/blog/types";

/**
 * The blog's own editor shell.
 *
 * It is a FORK of `ContentEditor`, not an extension of it. That shared editor is driven by a flat
 * `FieldDef[]`, which is exactly why it can serve `/admin/cms/pages` and `/admin/events` from one
 * file — and exactly why the blog cannot use it any more. A category select, an author select, a
 * three-way schedule control, a 16:9 cover uploader with alt text, a related-post picker, a live
 * SEO panel and a document outline would each need a new `FieldDef` variant, and every one of
 * those variants would ship to the two screens that do not want them. Forking keeps ~20 blog
 * fields out of a component two other modules depend on.
 *
 * What is duplicated (dirty tracking, the unsaved-changes warning, save / delete, field errors,
 * the sticky action bar) is copied deliberately and should be kept in step with `ContentEditor`
 * by hand — see the note in the plan's risk list.
 *
 * Layout is grouped rather than one flat grid: with this many fields, a single two-column grid
 * puts the canonical URL next to the excerpt and nobody can find anything. Each group is its own
 * card, the outline and the listing preview ride along on `xl+`, and below that the outline drops
 * into the Post section as a disclosure.
 */

export interface BlogEditorProps {
  /** Record id when editing; omit to create. */
  id?: string;
  initial: BlogFormValues;
  /** Loaded server-side and passed down — this file is a client component and cannot query the DB. */
  categories: BlogOption[];
  authors: BlogOption[];
  /** Titles for the posts already pinned in `initial.relatedPostIds`. */
  relatedInitial: RelatedOption[];
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  /** `/blog/<slug>` when the post is live, `/blog/preview/<id>` otherwise. */
  viewHref?: string | null;
  /** Small status line beside the save button (e.g. "Last saved …"). */
  meta?: string | null;
  backHref?: string;
}

/**
 * Field → anchor, in form order. The form is now roughly 20 fields and two screens tall, so a
 * server-side error on `canonicalUrl` is invisible from the top of the page; `ErrorSummary` turns
 * each one into a link that scrolls to and focuses the control.
 */
const FIELD_ANCHORS: { key: string; id: string; label: string }[] = [
  { key: "title", id: "bl-title", label: "Title" },
  { key: "slug", id: "bl-slug", label: "Address" },
  { key: "excerpt", id: "bl-excerpt", label: "Excerpt" },
  { key: "content", id: "bl-content", label: "Content" },
  { key: "status", id: "bl-publishing", label: "Publishing" },
  { key: "publishedAt", id: "blog-publish-at", label: "Go-live time" },
  { key: "isFeatured", id: "bl-featured", label: "Featured" },
  { key: "authorId", id: "bl-author", label: "Author" },
  { key: "authorName", id: "bl-author-name", label: "Byline" },
  { key: "categoryId", id: "bl-category", label: "Category" },
  { key: "coverImage", id: "bl-cover", label: "Cover image" },
  { key: "coverImageAlt", id: "bl-cover-alt", label: "Image description" },
  { key: "tags", id: "bl-tags", label: "Tags" },
  { key: "relatedPostIds", id: "blog-related-search", label: "Related articles" },
  { key: "seoTitle", id: "blog-seo-title", label: "Search engine title" },
  { key: "seoDescription", id: "blog-seo-description", label: "Search engine description" },
  { key: "canonicalUrl", id: "blog-canonical-url", label: "Original address" },
  { key: "ogImage", id: "blog-seo-heading", label: "Social preview image" },
];

/** How the post will look in the blog listing, updated as the author types. */
function ListingPreview({ values }: { values: BlogFormValues }) {
  const slug = values.slug.trim() || slugify(values.title) || "your-address";
  const title = values.title.trim() || "Untitled";
  const summary = values.excerpt.trim();
  return (
    <section aria-labelledby="bl-listing-preview" className="card overflow-hidden">
      <h2 id="bl-listing-preview" className="sr-only">
        Listing preview
      </h2>
      <span className="media media-16x9 block rounded-none">
        {values.coverImage ? (
          /* The stored value already carries the deployment base path (`saveUpload` applied it),
             so it goes straight into `src` — `withBasePath` here would prefix it twice. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={values.coverImage} alt={values.coverImageAlt || ""} loading="lazy" decoding="async" />
        ) : (
          <MediaPlaceholder seed={slug} mark={title} />
        )}
      </span>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-overline text-muted">Listing preview</p>
          <StatusBadge status={displayStatus({ status: values.status, publishedAt: values.publishedAt || null })} />
        </div>
        <p className="text-h4 break-words text-navy">{title}</p>
        <p className="text-body-sm text-muted">{summary ? truncate(summary, 160) : "Add an excerpt to show a line of text here."}</p>
      </div>
    </section>
  );
}

export function BlogEditor({ id, initial, categories, authors, relatedInitial, canEdit, canPublish, canDelete, viewHref, meta, backHref = "/admin/blog" }: BlogEditorProps) {
  const router = useRouter();
  const [saved, setSaved] = React.useState<BlogFormValues>(initial);
  const [values, setValues] = React.useState<BlogFormValues>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // Bumped on every failed submit so ErrorSummary takes focus again, even when the same field
  // fails twice in a row.
  const [failures, setFailures] = React.useState(0);

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  useUnsavedChangesWarning(dirty && canEdit && !saving);
  const state: SaveState = saving ? "saving" : formError ? "error" : dirty ? "dirty" : justSaved ? "saved" : "clean";
  const idle = meta ?? (id ? undefined : "New blog post – not saved yet");
  const locked = !canEdit || saving;

  /** Merge a patch and clear the server errors for exactly the keys that were just edited. */
  const patch = React.useCallback((next: Partial<BlogFormValues>) => {
    setValues((v) => ({ ...v, ...next }));
    setJustSaved(false);
    setErrors((e) => {
      const keys = Object.keys(next);
      if (!keys.some((k) => e[k])) return e;
      const copy = { ...e };
      for (const k of keys) delete copy[k];
      return copy;
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      // The service derives a unique slug from the title when none is given; sending the derived
      // value keeps what the author saw in the field and what gets stored in agreement.
      const payload: BlogFormValues = { ...values, slug: values.slug.trim() || slugify(values.title) };
      if (id) {
        await api.put(`/api/admin/blog/${id}`, payload);
        toast.success("Blog post saved");
        setSaved(values);
        setJustSaved(true);
        router.refresh();
      } else {
        const created = await api.post<{ id: string }>("/api/admin/blog", payload);
        toast.success("Blog post created");
        setSaved(values);
        router.push(`${backHref}/${created.id}`);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
      setFailures((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.delete(`/api/admin/blog/${id}`);
      toast.success("Blog post deleted");
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
  const summary = FIELD_ANCHORS.filter((f) => errors[f.key]).map((f) => ({ id: f.id, message: `${f.label}: ${errors[f.key]}` }));
  const slugPreview = values.slug || slugify(values.title);

  return (
    <form onSubmit={save} className="space-y-4 lg:space-y-6" noValidate>
      <ErrorSummary errors={summary} message={formError} focusSignal={failures} />
      {!canEdit && <Alert tone="info">You can read this post but need the &ldquo;Edit Website Content&rdquo; permission to change it.</Alert>}

      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="space-y-4 lg:space-y-6 xl:col-span-2">
          <div className="card card-p">
            <FormSection id="bl-post" title="Post" description="The article itself. The body is Markdown — headings become the table of contents on the live page.">
              <FormGrid>
                <Field label="Title" htmlFor="bl-title" required error={errors.title} className="sm:col-span-2">
                  <Input id="bl-title" value={values.title} onChange={(e) => patch({ title: e.target.value })} maxLength={200} invalid={!!errors.title} disabled={locked} required />
                </Field>
                <Field label="Address" htmlFor="bl-slug" error={errors.slug} hint={`Public address: /blog/${slugPreview || "…"}`} className="sm:col-span-2">
                  <Input
                    id="bl-slug"
                    value={slugPreview}
                    onChange={(e) => patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
                    placeholder="auto-generated-from-title"
                    invalid={!!errors.slug}
                    disabled={locked}
                    className="font-mono"
                  />
                </Field>
                <Field label="Excerpt" htmlFor="bl-excerpt" error={errors.excerpt} hint="One or two sentences for the blog listing and link previews." className="sm:col-span-2">
                  <Textarea id="bl-excerpt" value={values.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} rows={2} maxLength={500} invalid={!!errors.excerpt} disabled={locked} />
                </Field>
                {/* `autoWire={false}`: the markdown editor is a composite (toolbar + textarea +
                    preview), so Field must point its label at the textarea id rather than try to
                    clone aria attributes onto the wrapper. */}
                <Field label="Content" htmlFor="bl-content" required error={errors.content} autoWire={false} className="sm:col-span-2">
                  <BlogMarkdownEditor id="bl-content" value={values.content} onChange={(content) => patch({ content })} error={errors.content} disabled={locked} />
                </Field>
              </FormGrid>

              {/* Below xl the outline has nowhere to sit beside the form, so it folds into it. */}
              <details className="rounded-card border border-line bg-surface/50 xl:hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-body-sm font-semibold text-navy tap-highlight-none">
                  <ListTree className="h-4 w-4" aria-hidden /> Document outline
                </summary>
                <div className="border-t border-line p-3">
                  <OutlinePanel content={values.content} />
                </div>
              </details>
            </FormSection>
          </div>

          <div className="card card-p">
            <FormSection id="bl-publishing" title="Publishing" description="Nothing goes live until this says so — a scheduled post stays invisible everywhere until its time passes.">
              <ScheduleField
                status={values.status}
                publishedAt={values.publishedAt}
                onChange={(next) => patch(next)}
                canPublish={canPublish}
                disabled={locked}
                error={errors.publishedAt}
                showArchive={!!id}
              />
              <div id="bl-featured">
                <Checkbox
                  checked={values.isFeatured}
                  onChange={(e) => patch({ isFeatured: e.target.checked })}
                  disabled={locked}
                  label="Feature this post"
                  description="Featured posts get the large card at the top of the blog. Keep it to one or two at a time."
                />
              </div>
            </FormSection>
          </div>

          <div className="card card-p">
            <FormSection id="bl-byline" title="Author & category" description="The byline and the archive this post belongs to.">
              <FormGrid>
                <Field label="Author" htmlFor="bl-author" error={errors.authorId} hint="An author profile adds a photo, a short bio and an archive page.">
                  <Select id="bl-author" value={values.authorId} onChange={(e) => patch({ authorId: e.target.value })} options={authors} placeholder="No author profile" invalid={!!errors.authorId} disabled={locked} />
                </Field>
                <Field label="Category" htmlFor="bl-category" error={errors.categoryId}>
                  <Select id="bl-category" value={values.categoryId} onChange={(e) => patch({ categoryId: e.target.value })} options={categories} placeholder="No category" invalid={!!errors.categoryId} disabled={locked} />
                </Field>
                {/* Only useful without a profile: a one-off guest byline. With a profile chosen the
                    public page shows the profile, so the field would be a lie. */}
                {!values.authorId && (
                  <Field label="Byline" htmlFor="bl-author-name" error={errors.authorName} hint="Shown when no author profile is chosen." className="sm:col-span-2">
                    <Input id="bl-author-name" value={values.authorName} onChange={(e) => patch({ authorName: e.target.value })} maxLength={120} placeholder="e.g. EduSkill Team" invalid={!!errors.authorName} disabled={locked} />
                  </Field>
                )}
              </FormGrid>
            </FormSection>
          </div>

          <div className="card card-p">
            <FormSection id="bl-cover" title="Cover image" description="Shown at the top of the article and on every card that links to it.">
              <CoverImageField
                value={values.coverImage}
                alt={values.coverImageAlt}
                onChange={(coverImage) => patch({ coverImage })}
                onAltChange={(coverImageAlt) => patch({ coverImageAlt })}
                altId="bl-cover-alt"
                error={errors.coverImage}
                altError={errors.coverImageAlt}
                disabled={locked}
              />
            </FormSection>
          </div>

          <div className="card card-p">
            <FormSection id="bl-tags" title="Tags" description="Each tag gets its own archive page. Reuse an existing one wherever you can.">
              <Field label="Tags" error={errors.tags} autoWire={false}>
                <BlogTagField value={values.tags} onChange={(tags) => patch({ tags })} disabled={locked} />
              </Field>
            </FormSection>
          </div>

          <div className="card card-p">
            <FormSection id="bl-related" title="Related articles" description="Pin up to three follow-on reads for the end of the article.">
              <RelatedPicker value={values.relatedPostIds} onChange={(relatedPostIds) => patch({ relatedPostIds })} initial={relatedInitial} excludeId={id} disabled={locked} error={errors.relatedPostIds} />
            </FormSection>
          </div>

          <SeoPanel values={values} onChange={patch} errors={errors} disabled={locked} />
        </div>

        <aside className="hidden xl:block" aria-label="Outline and preview">
          <div className="sticky top-20 space-y-4">
            <div className="card card-p">
              <OutlinePanel content={values.content} />
            </div>
            <ListingPreview values={values} />
          </div>
        </aside>
      </div>

      {/* Phones / tablets: secondary controls stay in the page, Save sits in the sticky bar below. */}
      {(view || (id && canDelete)) && (
        <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
          {view && (
            <a href={view} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "outline", size: "md", fullWidth: true })}>
              <ExternalLink className="h-4 w-4" aria-hidden /> View on site
            </a>
          )}
          {id && canDelete && (
            <Button type="button" variant="outline" fullWidth className="text-danger" onClick={() => setConfirmDelete(true)} disabled={saving} leftIcon={<Trash2 className="h-4 w-4" />}>
              Delete post
            </Button>
          )}
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
          {id && canDelete && (
            <Button type="button" variant="outline" className="hidden text-danger hover:border-danger/40 lg:inline-flex" onClick={() => setConfirmDelete(true)} disabled={saving} leftIcon={<Trash2 className="h-4 w-4" />}>
              Delete
            </Button>
          )}
          {canEdit && (
            <Button type="submit" loading={saving} disabled={!!id && !dirty} leftIcon={<Save className="h-4 w-4" />} className="flex-2 lg:flex-none">
              {id ? "Save changes" : "Create post"}
            </Button>
          )}
        </div>
      </StickyActionBar>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !saving && setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this blog post?"
        description="It will be removed from the website immediately. This cannot be undone."
        confirmLabel="Delete"
        danger
        loading={saving}
      />
    </form>
  );
}
