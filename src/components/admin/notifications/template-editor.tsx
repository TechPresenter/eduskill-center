"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

export interface TemplateData {
  key: string;
  event: string;
  channel: string;
  name: string;
  variables: string[];
  defaults: { subject: string; body: string };
  subject: string;
  body: string;
  isActive: boolean;
  custom: { subject: string | null; body: string; isActive: boolean; updatedAt: string | Date } | null;
  sample: Record<string, string>;
}

function render(template: string, data: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => data[key] ?? "");
}

export function TemplateEditor({ template, canEdit }: { template: TemplateData; canEdit: boolean }) {
  const router = useRouter();
  const needsSubject = template.channel === "EMAIL" || template.channel === "IN_APP";
  const [subject, setSubject] = React.useState(template.subject);
  const [body, setBody] = React.useState(template.body);
  const [isActive, setIsActive] = React.useState(template.isActive);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmRestore, setConfirmRestore] = React.useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const insert = (v: string) => {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await api.put(`/api/admin/notifications/templates/${encodeURIComponent(template.key)}`, { subject: needsSubject ? subject : subject || null, body, isActive });
      toast.success("Template saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/admin/notifications/templates/${encodeURIComponent(template.key)}`);
      setSubject(template.defaults.subject);
      setBody(template.defaults.body);
      setIsActive(true);
      setConfirmRestore(false);
      toast.success("Default template restored");
      router.refresh();
    } catch (err) {
      toast.error("Could not restore default", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const previewSubject = render(subject, template.sample);
  const previewBody = render(body, template.sample);
  const isSms = template.channel === "SMS" || template.channel === "WHATSAPP";

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-6 lg:grid-cols-5" noValidate>
      <div className="space-y-4 lg:col-span-3">
        {formError && <Alert tone="danger">{formError}</Alert>}
        {!canEdit && <Alert tone="info">You can view this template but need the &ldquo;Manage Templates&rdquo; permission to change it.</Alert>}
        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy">{template.channel.replace("_", "-")}</Badge>
            {template.custom ? <Badge tone="orange">Customised · {formatDateTime(template.custom.updatedAt)}</Badge> : <Badge tone="neutral">Built-in default</Badge>}
            {!isActive && <Badge tone="warning">Inactive – default will be used</Badge>}
          </div>
          {needsSubject && (
            <Field label={template.channel === "EMAIL" ? "Email subject" : "Notification title"} htmlFor="tpl-subject" required error={errors.subject}>
              <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} invalid={!!errors.subject} disabled={!canEdit || busy} />
            </Field>
          )}
          <Field label={isSms ? "Message text" : "Message body"} htmlFor="tpl-body" required error={errors.body} hint={isSms ? `${body.length} characters · SMS segments of 160 characters` : "Plain text. Line breaks are preserved."}>
            <Textarea id="tpl-body" ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={isSms ? 5 : 12} invalid={!!errors.body} disabled={!canEdit || busy} className="font-mono text-[13px]" />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Variables – click to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map((v) => (
                <button key={v} type="button" onClick={() => insert(v)} disabled={!canEdit} className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-xs text-navy hover:border-navy/40 hover:bg-white disabled:opacity-60">
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
          <Checkbox label="Template active" description="When inactive, the built-in default text is sent instead." checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={!canEdit || busy} />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Link href="/admin/notifications/templates" className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink hover:bg-surface">
            Back to templates
          </Link>
          {canEdit && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" disabled={!template.custom || busy} onClick={() => setConfirmRestore(true)} leftIcon={<RotateCcw className="h-4 w-4" />}>
                Restore default
              </Button>
              <Button type="submit" loading={busy} leftIcon={<Save className="h-4 w-4" />}>
                Save template
              </Button>
            </div>
          )}
        </div>
      </div>

      <aside className="lg:col-span-2">
        <div className="card sticky top-20 p-5">
          <p className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">Live preview (sample data)</p>
          {needsSubject && <p className="mb-2 text-sm font-bold text-navy">{previewSubject || <span className="text-muted">No subject</span>}</p>}
          <div className={isSms ? "rounded-2xl rounded-bl-sm bg-success-light px-4 py-3 text-sm whitespace-pre-wrap text-ink" : "rounded-xl border border-line bg-surface/40 p-4 text-sm whitespace-pre-wrap text-ink"}>{previewBody || <span className="text-muted">Nothing to preview.</span>}</div>
          <p className="mt-3 text-xs text-muted">Sample values are illustrative; real messages use live data.</p>
        </div>
      </aside>

      <ConfirmDialog open={confirmRestore} onClose={() => !busy && setConfirmRestore(false)} onConfirm={restore} title="Restore the default template?" description="Your customised text will be deleted and the built-in wording used again." confirmLabel="Restore default" danger loading={busy} />
    </form>
  );
}
