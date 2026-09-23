"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitMerge, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";

export interface BlogTagRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /**
   * LIVE posts only — `BlogTag.postCount` is recounted through `livePostWhere()`, so a tag that
   * only appears on drafts and scheduled posts legitimately reads 0. Every warning in this file
   * is worded so that number is never mistaken for "how many rows a rename will rewrite".
   */
  postCount: number;
}

/**
 * Renames a tag in place (and edits its archive copy). The label lives in two places — the
 * `blog_tags` lookup row and the `Blog.tags` array on every post carrying it — and the service
 * rewrites both inside one transaction, which is why this is not a quiet inline edit.
 */
function TagEditForm({ tag, onDone, onCancel }: { tag: BlogTagRow; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(tag.name);
  const [description, setDescription] = React.useState(tag.description ?? "");
  const [seoTitle, setSeoTitle] = React.useState(tag.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = React.useState(tag.seoDescription ?? "");
  const renaming = name.trim() !== tag.name;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(
      () =>
        api.put(`/api/admin/blog/tags/${tag.id}`, {
          name,
          description: description || null,
          seoTitle: seoTitle || null,
          seoDescription: seoDescription || null,
        }),
      { silent: true }
    );
    if (res !== undefined) {
      toast.success(renaming ? "Tag renamed" : "Tag updated", name);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      {renaming && (
        <Alert tone="warning" title="This rewrites the tag on every post that carries it">
          Each post&rsquo;s tag list is updated from &ldquo;{tag.name}&rdquo; to &ldquo;{name.trim()}&rdquo;, including drafts and scheduled posts.{" "}
          {tag.postCount > 0 ? `${tag.postCount} of them ${tag.postCount === 1 ? "is" : "are"} live on the website right now.` : "None of them is live on the website right now."} The archive address changes with the name, so
          existing links to the old address stop working.
        </Alert>
      )}
      <FormGrid>
        <Field label="Tag" htmlFor="btag-name" required error={fieldErrors.name} hint="Capitalisation matters: this is the exact label stored on every post." className="sm:col-span-2">
          <Input
            id="btag-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearField("name");
            }}
            required
            maxLength={60}
            invalid={!!fieldErrors.name}
            autoFocus
          />
        </Field>
        <Field label="Description" htmlFor="btag-desc" error={fieldErrors.description} hint="Shown under the heading on the tag archive page." className="sm:col-span-2">
          <Textarea id="btag-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
        </Field>
        <Field label="SEO title" htmlFor="btag-seo-title" error={fieldErrors.seoTitle} hint="Leave empty to use the tag name." className="sm:col-span-2">
          <Input id="btag-seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} />
        </Field>
        <Field label="SEO description" htmlFor="btag-seo-desc" error={fieldErrors.seoDescription} hint="Leave empty to use the description above." className="sm:col-span-2">
          <Textarea id="btag-seo-desc" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} maxLength={400} />
        </Field>
      </FormGrid>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {renaming ? "Rename tag" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/** Folds one tag into another. The source row is deleted; every post swaps the label. */
function TagMergeForm({ tag, tags, onDone, onCancel }: { tag: BlogTagRow; tags: BlogTagRow[]; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [mergeIntoId, setMergeIntoId] = React.useState("");
  const others = tags.filter((t) => t.id !== tag.id);
  const target = others.find((t) => t.id === mergeIntoId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeIntoId) return;
    const res = await submit(() => api.put(`/api/admin/blog/tags/${tag.id}`, { mergeIntoId }), { silent: true });
    if (res !== undefined) {
      toast.success("Tags merged", `"${tag.name}" is now "${target?.name ?? "the target tag"}"`);
      onDone();
    }
  };

  if (others.length === 0) {
    return (
      <div className="space-y-4">
        <Alert tone="info">There is no other tag to merge into yet.</Alert>
        <div className="flex justify-end border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <Alert tone="warning" title="Merging cannot be undone">
        Every post tagged &ldquo;{tag.name}&rdquo; — drafts and scheduled posts included — is re-tagged with the tag you pick, and &ldquo;{tag.name}&rdquo; is then deleted. Links to
        <span className="font-mono"> /blog/tag/{tag.slug}</span> stop working.
      </Alert>
      <Field label="Merge into" htmlFor="btag-merge" required error={fieldErrors.mergeIntoId} hint="The tag that survives. Posts that already carry both keep just the one.">
        <Select
          id="btag-merge"
          required
          placeholder="Choose a tag…"
          value={mergeIntoId}
          onChange={(e) => {
            setMergeIntoId(e.target.value);
            clearField("mergeIntoId");
          }}
          invalid={!!fieldErrors.mergeIntoId}
          options={others.map((t) => ({ value: t.id, label: t.postCount > 0 ? `${t.name} (${t.postCount} live)` : t.name }))}
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={loading} disabled={!mergeIntoId}>
          {target ? `Merge into ${target.name}` : "Merge"}
        </Button>
      </div>
    </form>
  );
}

export function BlogTagManager({ tags, canUpdate, canDelete }: { tags: BlogTagRow[]; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<BlogTagRow | null>(null);
  const [merging, setMerging] = React.useState<BlogTagRow | null>(null);
  const done = () => {
    setEditing(null);
    setMerging(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <TableWrap>
        <THead>
          <tr>
            <TH>Tag</TH>
            <TH>Description</TH>
            <TH className="text-right">Live posts</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {tags.length === 0 && <EmptyRow colSpan={4}>No tags yet. Tags are created by typing them on a post.</EmptyRow>}
          {tags.map((t) => (
            <TR key={t.id}>
              <TD label="Tag" primary>
                <span className="block font-semibold">{t.name}</span>
                <span className="block truncate font-mono text-caption text-muted">/blog/tag/{t.slug}</span>
              </TD>
              <TD label="Description" mobile="hidden" className="max-w-md text-body-sm text-muted">
                {t.description || "—"}
              </TD>
              <TD label="Live posts" className="text-right tabular-nums">
                {/* The admin list filters on the exact label, which is what `Blog.tags` stores — and it
                    shows drafts and scheduled posts too, so it is the honest way to see everything the
                    count leaves out. */}
                <Link href={`/admin/blog?tag=${encodeURIComponent(t.name)}`} className="ring-focus inline-flex min-h-11 items-center rounded-md px-1 font-semibold text-navy underline-offset-2 tap-highlight-none hover:underline md:min-h-0">
                  {t.postCount}
                  <span className="sr-only"> live posts tagged {t.name} — open the post list</span>
                </Link>
              </TD>
              <TD actions className="text-right">
                <span className="inline-flex flex-wrap justify-end gap-1">
                  {canUpdate && (
                    <>
                      <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(t)}>
                        Rename
                      </Button>
                      <Button size="sm" variant="ghost" leftIcon={<GitMerge className="h-3.5 w-3.5" />} onClick={() => setMerging(t)}>
                        Merge
                        <span className="sr-only"> {t.name} into another tag</span>
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <ConfirmAction
                      danger
                      method="delete"
                      url={`/api/admin/blog/tags/${t.id}`}
                      title={`Delete "${t.name}"?`}
                      description={`The tag is removed from every post that carries it${t.postCount > 0 ? ` (${t.postCount} of them ${t.postCount === 1 ? "is" : "are"} live)` : ""}. The posts themselves are not touched. To keep the posts grouped, merge the tag instead.`}
                      confirmLabel="Delete tag"
                      successMessage="Tag deleted"
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit "${editing.name}"` : ""} size="lg">
        {editing && <TagEditForm tag={editing} onCancel={() => setEditing(null)} onDone={done} />}
      </Modal>
      <Modal open={!!merging} onClose={() => setMerging(null)} title={merging ? `Merge "${merging.name}"` : ""}>
        {merging && <TagMergeForm tag={merging} tags={tags} onCancel={() => setMerging(null)} onDone={done} />}
      </Modal>
    </div>
  );
}
