"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { FileUpload } from "@/components/ui/file-upload";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";

export interface BlogAuthorRow {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  bio: string | null;
  avatar: string | null;
  email: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Every post credited to this author, live or not — the delete guard, not a public count. */
  posts: number;
}

const BIO_MAX = 1000;

/**
 * Square avatar control: upload → 1:1 preview → Replace / Remove.
 *
 * It is deliberately NOT the blog's `CoverImageField`, which frames a 16:9 cover and carries an
 * alt-text input. A byline portrait is described by the author's name (that is what `Avatar`
 * renders into `alt`), so there is nothing extra to type, and the initials fallback means an
 * author without a photograph still looks finished.
 */
function AvatarField({ name, value, onChange, disabled, error }: { name: string; value: string; onChange: (url: string) => void; disabled?: boolean; error?: string }) {
  const [replacing, setReplacing] = React.useState(false);
  // Remounting the uploader resets its own error / progress state, so a failed first attempt
  // does not linger over the second.
  const [uploadKey, setUploadKey] = React.useState(0);
  const showUploader = !value || replacing;

  return (
    <Field label="Photo" error={error} className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* `Avatar` is already a fixed-size, `object-cover`, 1:1 circle with an initials fallback —
            exactly what the public byline renders — so it IS the preview rather than sitting inside a
            `media media-1x1` frame, which would stack a second lavender background and a second
            border-radius behind it. The ring is the only chrome we add. */}
        <span className="shrink-0 rounded-full p-0.5 ring-1 ring-line">
          <Avatar name={name.trim() || "New author"} src={value || null} size={96} />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          {showUploader ? (
            <>
              <FileUpload
                key={uploadKey}
                endpoint="/api/admin/uploads"
                fields={{ preset: "image", folder: "blog/authors", visibility: "public" }}
                accept=".jpg,.jpeg,.png,.webp"
                maxSizeMb={5}
                value={null}
                onChange={(f) => {
                  if (!f) return;
                  onChange(f.url);
                  setReplacing(false);
                }}
                label={value ? "Upload a new photo" : "Upload a photo"}
                hint="JPG, PNG or WEBP up to 5 MB. A square crop of at least 256×256 looks best."
                disabled={disabled}
                capture="user"
              />
              {value && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setReplacing(false)} disabled={disabled}>
                  Keep the current photo
                </Button>
              )}
              {!value && <p className="text-caption text-muted">No photo? The byline shows the author&rsquo;s initials instead.</p>}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                disabled={disabled}
                onClick={() => {
                  setUploadKey((k) => k + 1);
                  setReplacing(true);
                }}
              >
                Replace
              </Button>
              <IconButton size="md" icon={<Trash2 className="h-4 w-4" />} aria-label="Remove photo" className="hover:bg-danger-light hover:text-danger" disabled={disabled} onClick={() => onChange("")} />
            </div>
          )}
        </div>
      </div>
    </Field>
  );
}

function AuthorForm({ initial, onDone, onCancel }: { initial?: BlogAuthorRow; onDone: () => void; onCancel: () => void }) {
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [role, setRole] = React.useState(initial?.role ?? "");
  const [bio, setBio] = React.useState(initial?.bio ?? "");
  const [avatar, setAvatar] = React.useState(initial?.avatar ?? "");
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [linkedinUrl, setLinkedinUrl] = React.useState(initial?.linkedinUrl ?? "");
  const [twitterUrl, setTwitterUrl] = React.useState(initial?.twitterUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = React.useState(initial?.websiteUrl ?? "");
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 0));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name,
      role: role || null,
      bio: bio || null,
      avatar,
      email,
      linkedinUrl,
      twitterUrl,
      websiteUrl,
      isActive,
      sortOrder: Number(sortOrder) || 0,
    };
    const res = await submit(() => (initial ? api.put(`/api/admin/blog/authors/${initial.id}`, body) : api.post("/api/admin/blog/authors", body)), { silent: true });
    if (res !== undefined) {
      toast.success(initial ? "Author updated" : "Author added", name);
      onDone();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      <AvatarField name={name} value={avatar} onChange={setAvatar} disabled={loading} error={fieldErrors.avatar} />
      <FormGrid>
        <Field label="Name" htmlFor="bauth-name" required error={fieldErrors.name} hint="Shown on every article this author is credited on." className="sm:col-span-2">
          <Input
            id="bauth-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearField("name");
            }}
            required
            maxLength={120}
            invalid={!!fieldErrors.name}
            autoFocus
          />
        </Field>
        <Field label="Role" htmlFor="bauth-role" error={fieldErrors.role} hint="e.g. Programme Lead. Printed under the name.">
          <Input id="bauth-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Email" htmlFor="bauth-email" error={fieldErrors.email} hint="Internal only — it is never published.">
          <Input id="bauth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} invalid={!!fieldErrors.email} />
        </Field>
        <Field label="Short bio" htmlFor="bauth-bio" error={fieldErrors.bio} hint={`Two or three sentences. ${bio.length}/${BIO_MAX} characters.`} className="sm:col-span-2">
          <Textarea id="bauth-bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))} rows={3} maxLength={BIO_MAX} invalid={!!fieldErrors.bio} />
        </Field>
        <Field label="LinkedIn" htmlFor="bauth-linkedin" error={fieldErrors.linkedinUrl}>
          <Input id="bauth-linkedin" type="url" inputMode="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/…" invalid={!!fieldErrors.linkedinUrl} />
        </Field>
        <Field label="X (Twitter)" htmlFor="bauth-twitter" error={fieldErrors.twitterUrl}>
          <Input id="bauth-twitter" type="url" inputMode="url" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://x.com/…" invalid={!!fieldErrors.twitterUrl} />
        </Field>
        <Field label="Website" htmlFor="bauth-website" error={fieldErrors.websiteUrl} className="sm:col-span-2">
          <Input id="bauth-website" type="url" inputMode="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" invalid={!!fieldErrors.websiteUrl} />
        </Field>
        <Field label="Sort order" htmlFor="bauth-sort" error={fieldErrors.sortOrder} hint="Lower numbers come first in the author picker.">
          <Input id="bauth-sort" type="number" min={0} max={9999} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <div className="flex items-end pb-1">
          <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} label="Active" description="Inactive authors keep their published articles but are hidden from the picker." />
        </div>
      </FormGrid>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save changes" : "Add author"}
        </Button>
      </div>
    </form>
  );
}

export function BlogAuthorManager({ authors, canCreate, canUpdate, canDelete }: { authors: BlogAuthorRow[]; canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<BlogAuthorRow | null>(null);
  const done = () => {
    setCreating(false);
    setEditing(null);
    router.refresh();
  };
  const anyInUse = authors.some((a) => a.posts > 0);

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Add author
          </Button>
        </div>
      )}
      {canDelete && anyInUse && (
        // Same SetNull guard as categories: deleting a credited author would silently strip the
        // byline off published articles, so the server refuses with `Errors.conflict`.
        <Alert tone="info">An author who is credited on a post cannot be deleted. Reassign those posts first, or untick Active to keep the byline while removing them from the picker.</Alert>
      )}
      <TableWrap>
        <THead>
          <tr>
            <TH>Author</TH>
            <TH>Bio</TH>
            <TH className="text-right">Posts</TH>
            <TH className="text-right">Order</TH>
            <TH>Status</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {authors.length === 0 && <EmptyRow colSpan={6}>No blog authors yet.</EmptyRow>}
          {authors.map((a) => (
            <TR key={a.id}>
              <TD label="Author" primary>
                <span className="flex items-center gap-3">
                  <Avatar name={a.name} src={a.avatar} size={40} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{a.name}</span>
                    {a.role && <span className="block text-caption text-muted">{a.role}</span>}
                    <span className="mt-0.5 block truncate font-mono text-caption text-muted">/blog/author/{a.slug}</span>
                  </span>
                </span>
              </TD>
              <TD label="Bio" mobile="hidden" className="max-w-md text-body-sm text-muted">
                {a.bio || "—"}
              </TD>
              <TD label="Posts" className="text-right tabular-nums">
                {a.posts > 0 ? (
                  <Link href={`/admin/blog?authorId=${a.id}`} className="ring-focus inline-flex min-h-11 items-center rounded-md px-1 font-semibold text-navy underline-offset-2 tap-highlight-none hover:underline md:min-h-0">
                    {a.posts}
                    <span className="sr-only"> posts by {a.name}</span>
                  </Link>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </TD>
              <TD label="Order" mobile="hidden" className="text-right tabular-nums">
                {a.sortOrder}
              </TD>
              <TD label="Status">
                <Badge tone={a.isActive ? "success" : "neutral"} dot>
                  {a.isActive ? "Active" : "Inactive"}
                </Badge>
              </TD>
              <TD actions className="text-right">
                <span className="inline-flex gap-1">
                  {/* Only worth offering once the archive has something on it — an author with no live
                      post renders an empty page, and an inactive author is off the website entirely. */}
                  {a.posts > 0 && a.isActive && (
                    <ButtonLink href={`/blog/author/${a.slug}`} target="_blank" rel="noopener" size="sm" variant="ghost" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                      View
                      <span className="sr-only"> {a.name} on the website</span>
                    </ButtonLink>
                  )}
                  {canUpdate && (
                    <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <ConfirmAction
                      danger
                      method="delete"
                      url={`/api/admin/blog/authors/${a.id}`}
                      title={`Delete ${a.name}?`}
                      description={a.posts > 0 ? `${a.name} is credited on ${a.posts} post(s). Reassign them first, or untick Active.` : "This permanently removes the author. No post is affected."}
                      confirmLabel="Delete"
                      successMessage="Author deleted"
                      disabled={a.posts > 0}
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
      <Modal open={creating} onClose={() => setCreating(false)} title="Add a blog author" size="lg">
        <AuthorForm onCancel={() => setCreating(false)} onDone={done} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} size="lg">
        {editing && <AuthorForm initial={editing} onCancel={() => setEditing(null)} onDone={done} />}
      </Modal>
    </div>
  );
}
