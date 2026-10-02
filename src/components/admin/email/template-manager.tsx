"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Eye, LayoutTemplate, Pencil, PenLine, Plus, Trash2 } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/feedback";
import { Field, FormGrid } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Fab } from "@/components/ui/fab";
import { toast } from "@/components/ui/toast";
import { AppList, AppListRow, IconTile, ListSection } from "@/components/admin/content/app-list";
import { RichTextEditor } from "@/components/admin/email/rich-text-editor";
import { EmailPreviewTabs } from "@/components/admin/email/email-preview";
import { escapeHtml, isHtmlEmpty } from "@/components/admin/email/html-tools";

/*
 * Admin → Send Email → Templates. Starter layouts (built in, read-only) and the Foundation's saved
 * templates. Anyone who may send can "Use" a template (Compose opens with it); `email.templates`
 * may create, edit and delete saved ones with the same rich-text editor as Compose.
 */

export interface StarterTemplateItem {
  id: string;
  name: string;
  subject: string;
  html: string;
}

export interface SavedTemplateItem extends StarterTemplateItem {
  description: string | null;
  isActive: boolean;
  updatedAt: string;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  isActive: boolean;
}

type Item = { kind: "starter"; t: StarterTemplateItem } | { kind: "saved"; t: SavedTemplateItem };

/** A light stand-in for the email layout (640px white card on the grey canvas) for template previews. */
function layoutPreview(html: string, subject: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f4f6fb"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb"><tr><td style="padding:28px 28px 32px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#172033">${html}</td></tr></table></td></tr></table></body></html>`;
}

function TemplateEditorSheet({ open, initial, onClose, onSaved }: { open: boolean; initial: Draft; onClose: () => void; onSaved: () => void }) {
  const uid = React.useId();
  const [form, setForm] = React.useState<Draft>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Enter a name (at least 2 characters)";
    if (!form.subject.trim()) e.subject = "Enter a subject";
    if (isHtmlEmpty(form.html)) e.html = "Write the template's message";
    setErrors(e);
    if (Object.keys(e).length) {
      const first = ["name", "subject", "html"].find((k) => e[k]);
      if (first) document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const body = { name: form.name.trim(), description: form.description.trim() || null, subject: form.subject.trim(), html: form.html, isActive: form.isActive };
    try {
      if (form.id) await api.put(`/api/admin/email/templates/${form.id}`, body);
      else await api.post("/api/admin/email/templates", body);
      toast.success(form.id ? "Template updated" : "Template created", form.isActive ? "It is offered in Compose." : "It is switched off, so Compose does not offer it.");
      onSaved();
    } catch (err) {
      if (err instanceof ApiClientError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      toast.error("The template was not saved", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => !busy && onClose()}
      size="xl"
      height="full"
      title={form.id ? "Edit template" : "New template"}
      description="Templates fill the subject and message in Compose. Recipients, attachments and the signature are chosen per email."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={`${uid}-form`} loading={busy}>
            {form.id ? "Save changes" : "Create template"}
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={save} className="space-y-4" noValidate>
        <FormGrid>
          <Field label="Name" htmlFor={`${uid}-name`} required error={errors.name} hint="Shown in the Compose template picker.">
            <Input id={`${uid}-name`} value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
          </Field>
          <Field label="Description" htmlFor={`${uid}-description`} error={errors.description} hint="Optional: when to use it.">
            <Input id={`${uid}-description`} value={form.description} maxLength={300} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </FormGrid>
        <Field label="Subject" htmlFor={`${uid}-subject`} required error={errors.subject}>
          <Input id={`${uid}-subject`} value={form.subject} maxLength={200} onChange={(e) => set("subject", e.target.value.replace(/[\r\n]+/g, " "))} invalid={!!errors.subject} />
        </Field>
        <div className="space-y-1.5">
          <span id={`${uid}-html-label`} className="block text-sm font-semibold text-ink">
            Message
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          </span>
          <RichTextEditor id={`${uid}-html`} value={form.html} onChange={(v) => set("html", v)} aria-labelledby={`${uid}-html-label`} aria-describedby={errors.html ? `${uid}-html-error` : undefined} invalid={!!errors.html} placeholder="Write the template…" />
          {errors.html && (
            <p id={`${uid}-html-error`} role="alert" className="text-sm font-medium text-danger">
              {errors.html}
            </p>
          )}
        </div>
        <Checkbox checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} label="Active" description="Offered in the Compose template picker." />
      </form>
    </BottomSheet>
  );
}

export function TemplateManager({ starters, templates, canManage, canSend }: { starters: StarterTemplateItem[]; templates: SavedTemplateItem[]; canManage: boolean; canSend: boolean }) {
  const router = useRouter();
  const [editor, setEditor] = React.useState<{ open: boolean; key: number; initial: Draft } | null>(null);
  const [preview, setPreview] = React.useState<{ open: boolean; name: string; subject: string; html: string } | null>(null);
  const [menu, setMenu] = React.useState<Item | null>(null);
  const [deleting, setDeleting] = React.useState<SavedTemplateItem | null>(null);
  const [busy, setBusy] = React.useState(false);

  const openEditor = (initial: Draft) => setEditor((e) => ({ open: true, key: (e?.key ?? 0) + 1, initial }));
  const newTemplate = () => openEditor({ name: "", description: "", subject: "", html: "", isActive: true });
  const editTemplate = (t: SavedTemplateItem) => openEditor({ id: t.id, name: t.name, description: t.description ?? "", subject: t.subject, html: t.html, isActive: t.isActive });
  const copyStarter = (t: StarterTemplateItem) => openEditor({ name: `${t.name} (copy)`, description: "", subject: t.subject, html: t.html, isActive: true });
  const showPreview = (t: StarterTemplateItem) => setPreview({ open: true, name: t.name, subject: t.subject, html: t.html });

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/email/templates/${deleting.id}`);
      toast.success("Template deleted", `“${deleting.name}” is no longer offered in Compose.`);
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error("The template was not deleted", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const menuItems = (item: Item): ActionSheetItem[] => {
    const t = item.t;
    const active = item.kind === "starter" || item.t.isActive;
    return [
      { label: "Use in a new email", icon: <PenLine className="h-5 w-5" />, href: `/admin/email?template=${t.id}`, hidden: !canSend || !active },
      { label: "Preview", icon: <Eye className="h-5 w-5" />, onSelect: () => showPreview(t) },
      { label: "Edit", icon: <Pencil className="h-5 w-5" />, onSelect: () => item.kind === "saved" && editTemplate(item.t), hidden: !canManage || item.kind !== "saved" },
      { label: "Save a copy to edit", icon: <CopyPlus className="h-5 w-5" />, onSelect: () => copyStarter(t), hidden: !canManage || item.kind !== "starter" },
      { label: "Delete", icon: <Trash2 className="h-5 w-5" />, danger: true, onSelect: () => item.kind === "saved" && setDeleting(item.t), hidden: !canManage || item.kind !== "saved" },
    ];
  };

  const inlineActions = (item: Item) => {
    const t = item.t;
    const active = item.kind === "starter" || item.t.isActive;
    return (
      <span className="hidden items-center gap-1 md:flex">
        {canSend && active && (
          <ButtonLink href={`/admin/email?template=${t.id}`} variant="outline" size="sm" leftIcon={<PenLine className="h-4 w-4" aria-hidden />}>
            Use
          </ButtonLink>
        )}
        <IconButton aria-label={`Preview ${t.name}`} icon={<Eye className="h-4 w-4" />} size="sm" onClick={() => showPreview(t)} />
        {canManage && item.kind === "saved" && (
          <>
            <IconButton aria-label={`Edit ${t.name}`} icon={<Pencil className="h-4 w-4" />} size="sm" onClick={() => editTemplate(item.t)} />
            <IconButton aria-label={`Delete ${t.name}`} icon={<Trash2 className="h-4 w-4" />} size="sm" onClick={() => setDeleting(item.t)} className="hover:text-danger" />
          </>
        )}
        {canManage && item.kind === "starter" && <IconButton aria-label={`Save a copy of ${t.name} to edit`} icon={<CopyPlus className="h-4 w-4" />} size="sm" onClick={() => copyStarter(t)} />}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email templates"
        mobileTitle="Email templates"
        description="Reusable subjects and messages for Compose. Starter layouts are built in; saved templates belong to the Foundation."
        actions={
          canManage ? (
            <Button type="button" onClick={newTemplate} leftIcon={<Plus className="h-4 w-4" />}>
              New template
            </Button>
          ) : undefined
        }
      />

      <ListSection title="Saved templates" id="saved-templates" count={templates.length}>
        {templates.length ? (
          <AppList aria-labelledby="saved-templates">
            {templates.map((t) => (
              <AppListRow
                key={t.id}
                onClick={() => setMenu({ kind: "saved", t })}
                aria-label={`${t.name}: actions`}
                leading={
                  <IconTile tone={t.isActive ? "navy" : "neutral"}>
                    <LayoutTemplate />
                  </IconTile>
                }
                title={t.name}
                subtitle={t.description || t.subject}
                clamp={1}
                meta={
                  <>
                    {t.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Off</Badge>}
                    <span className="text-caption text-muted">Updated {formatDate(t.updatedAt)}</span>
                  </>
                }
                chevron={false}
                actions={inlineActions({ kind: "saved", t })}
              />
            ))}
          </AppList>
        ) : (
          <EmptyState
            size="sm"
            icon={<LayoutTemplate className="h-6 w-6" />}
            title="No saved templates yet"
            description={canManage ? "Create one from scratch, or save a copy of a starter layout below and adapt it." : "Administrators with the Email templates permission can create them."}
            action={
              canManage ? (
                <Button type="button" variant="navy" size="sm" onClick={newTemplate} leftIcon={<Plus className="h-4 w-4" />}>
                  New template
                </Button>
              ) : undefined
            }
          />
        )}
      </ListSection>

      <ListSection title="Starter layouts" id="starter-templates" count={starters.length}>
        <AppList aria-labelledby="starter-templates">
          {starters.map((t) => (
            <AppListRow
              key={t.id}
              onClick={() => setMenu({ kind: "starter", t })}
              aria-label={`${t.name}: actions`}
              leading={
                <IconTile tone="orange">
                  <LayoutTemplate />
                </IconTile>
              }
              title={t.name}
              subtitle={t.subject}
              clamp={1}
              meta={<Badge tone="neutral">Built in</Badge>}
              chevron={false}
              actions={inlineActions({ kind: "starter", t })}
            />
          ))}
        </AppList>
      </ListSection>

      {canManage && <Fab aria-label="New template" icon={<Plus className="h-6 w-6" aria-hidden />} onClick={newTemplate} />}

      <ActionSheet open={!!menu} onClose={() => setMenu(null)} title={menu?.t.name} description={menu?.t.subject} items={menu ? menuItems(menu) : []} />

      {editor && (
        <TemplateEditorSheet
          key={editor.key}
          open={editor.open}
          initial={editor.initial}
          onClose={() => setEditor((e) => (e ? { ...e, open: false } : e))}
          onSaved={() => {
            setEditor((e) => (e ? { ...e, open: false } : e));
            router.refresh();
          }}
        />
      )}

      <BottomSheet open={!!preview?.open} onClose={() => setPreview((p) => (p ? { ...p, open: false } : p))} size="xl" height="full" title={preview?.name ?? "Preview"} description={preview ? `Subject: ${preview.subject} · shown without a signature` : undefined}>
        {preview && <EmailPreviewTabs html={layoutPreview(preview.html, preview.subject)} label={`${preview.name} template`} />}
      </BottomSheet>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Delete this template?"
        description={deleting ? `“${deleting.name}” will no longer be offered in Compose. Emails already sent with it are not affected.` : undefined}
        confirmLabel="Delete template"
      />
    </div>
  );
}
