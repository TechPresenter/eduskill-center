"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Mail, MessageCircle, MessageSquare, RotateCcw, Save } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/tabs";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";
import { IconTile, SaveStatus, type SaveState } from "@/components/admin/content/app-list";
import { useUnsavedChangesWarning } from "@/components/admin/content/use-unsaved";

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

/** GSM-7 SMS segments: 160 characters in one message, 153 per part once it is split. */
function smsSegments(length: number) {
  if (length === 0) return 0;
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = { EMAIL: Mail, SMS: MessageSquare, WHATSAPP: MessageCircle, IN_APP: Bell };
const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", SMS: "SMS", WHATSAPP: "WhatsApp", IN_APP: "In-app" };

/** What the recipient will actually see, drawn in the shape of the channel (chat bubble, email, inbox row). */
function Preview({ channel, subject, body }: { channel: string; subject: string; body: string }) {
  const empty = <span className="text-muted">Nothing to preview yet.</span>;
  if (channel === "SMS" || channel === "WHATSAPP") {
    const wa = channel === "WHATSAPP";
    return (
      <div className="rounded-card bg-surface p-4">
        <p className="mb-3 text-center text-caption text-muted">{wa ? "WhatsApp" : "Text message"} · now</p>
        <div className={cn("max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-body-sm break-words whitespace-pre-wrap text-ink shadow-e1", wa ? "bg-success-light" : "bg-white")}>{body || empty}</div>
      </div>
    );
  }
  if (channel === "IN_APP") {
    return (
      <div className="rounded-card bg-surface p-3">
        <div className="card flex items-start gap-3 p-4">
          <IconTile tone="orange" size="sm">
            <Bell />
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-bold text-navy">{subject || <span className="font-normal text-muted">No title</span>}</p>
            <p className="mt-0.5 text-body-sm break-words whitespace-pre-wrap text-muted">{body || empty}</p>
            <p className="mt-1.5 text-caption text-muted">Just now</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="space-y-1 border-b border-line bg-surface px-4 py-3">
        <p className="text-caption text-muted">Email · inbox view</p>
        <p className="text-body-sm font-bold break-words text-navy">{subject || <span className="font-normal text-muted">No subject</span>}</p>
      </div>
      <div className="bg-white px-4 py-4 text-body-sm break-words whitespace-pre-wrap text-ink">{body || empty}</div>
    </div>
  );
}

export function TemplateEditor({ template, canEdit }: { template: TemplateData; canEdit: boolean }) {
  const router = useRouter();
  const needsSubject = template.channel === "EMAIL" || template.channel === "IN_APP";
  const isSms = template.channel === "SMS" || template.channel === "WHATSAPP";
  const [saved, setSaved] = React.useState({ subject: template.subject, body: template.body, isActive: template.isActive });
  const [subject, setSubject] = React.useState(template.subject);
  const [body, setBody] = React.useState(template.body);
  const [isActive, setIsActive] = React.useState(template.isActive);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [confirmRestore, setConfirmRestore] = React.useState(false);
  const [pane, setPane] = React.useState<"edit" | "preview">("edit");
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const dirty = subject !== saved.subject || body !== saved.body || isActive !== saved.isActive;
  useUnsavedChangesWarning(dirty && canEdit);
  const state: SaveState = busy ? "saving" : formError ? "error" : dirty ? "dirty" : justSaved ? "saved" : "clean";

  const insert = (v: string) => {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    setJustSaved(false);
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
      setSaved({ subject, body, isActive });
      setJustSaved(true);
      toast.success("Template saved", "New messages use this wording immediately.");
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
      const next = { subject: template.defaults.subject, body: template.defaults.body, isActive: true };
      setSubject(next.subject);
      setBody(next.body);
      setIsActive(true);
      setSaved(next);
      setJustSaved(true);
      setConfirmRestore(false);
      toast.success("Default template restored");
      router.refresh();
    } catch (err) {
      toast.error("Could not restore default", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const ChannelIcon = CHANNEL_ICON[template.channel] ?? Bell;
  const previewSubject = render(subject, template.sample);
  const previewBody = render(body, template.sample);
  const segments = smsSegments(previewBody.length);
  const idle = template.custom ? `Customised · saved ${formatDateTime(template.custom.updatedAt)}` : "Using the built-in default";

  const previewCard = (
    <div className="card card-p space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-overline text-muted">Live preview</h2>
        <span className="text-caption text-muted">Sample data</span>
      </div>
      <Preview channel={template.channel} subject={previewSubject} body={previewBody} />
      {isSms && (
        <p className="text-caption text-muted tabular-nums">
          {previewBody.length} characters with sample data · {segments} SMS part{segments === 1 ? "" : "s"}
        </p>
      )}
      <p className="text-caption text-muted">Sample values are illustrative; real messages use live data.</p>
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      {/* Identity strip: channel tile, state badges. */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <IconTile tone="lavender">
          <ChannelIcon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-ink">{CHANNEL_LABEL[template.channel] ?? template.channel} template</p>
          <p className="truncate font-mono text-caption text-muted">{template.event}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {template.custom ? <Badge tone="orange">Customised</Badge> : <Badge tone="neutral">Built-in default</Badge>}
          {!isActive && <Badge tone="warning">Inactive – default is sent</Badge>}
        </div>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}
      {!canEdit && <Alert tone="info">You can view this template but need the &ldquo;Manage Templates&rdquo; permission to change it.</Alert>}

      {/* Phones: Edit / Preview switch instead of a long scroll past the editor. */}
      <SegmentedControl
        fullWidth
        size="lg"
        className="lg:hidden"
        value={pane}
        onChange={(v) => setPane(v as "edit" | "preview")}
        items={[
          { value: "edit", label: "Edit" },
          { value: "preview", label: "Preview" },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <div className={cn("space-y-4 lg:col-span-3", pane === "preview" && "max-lg:hidden")}>
          <div className="card card-p space-y-5">
            {needsSubject && (
              <Field label={template.channel === "EMAIL" ? "Email subject" : "Notification title"} htmlFor="tpl-subject" required error={errors.subject}>
                <Input
                  id="tpl-subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setJustSaved(false);
                  }}
                  invalid={!!errors.subject}
                  disabled={!canEdit || busy}
                />
              </Field>
            )}
            <Field label={isSms ? "Message text" : "Message body"} htmlFor="tpl-body" required error={errors.body} hint={isSms ? `${body.length} characters as typed · keep it short, long texts are split into several SMS parts` : "Plain text. Line breaks are preserved."}>
              <Textarea
                id="tpl-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setJustSaved(false);
                }}
                rows={isSms ? 5 : 12}
                invalid={!!errors.body}
                disabled={!canEdit || busy}
                className="font-mono"
              />
            </Field>

            {template.variables.length > 0 && (
              <div>
                <p className="mb-2 text-body-sm font-medium text-ink">
                  Variables <span className="font-normal text-muted">– tap to insert at the cursor</span>
                </p>
                <div className="hscroll gap-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  {template.variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insert(v)}
                      disabled={!canEdit || busy}
                      className="ring-focus inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-3.5 font-mono text-body-sm text-navy tap-highlight-none transition-colors duration-micro ease-soft active:scale-[0.97] motion-reduce:transition-none hover:border-navy/40 hover:bg-white disabled:opacity-60 sm:min-h-9"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Checkbox
              label="Template active"
              description="When switched off, the built-in default text is sent instead."
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                setJustSaved(false);
              }}
              disabled={!canEdit || busy}
            />
          </div>
        </div>

        <aside className={cn("lg:col-span-2", pane === "edit" && "max-lg:hidden")}>
          <div className="lg:sticky lg:top-20">{previewCard}</div>
        </aside>
      </div>

      {/* Phones: restore sits in the page (the sticky bar keeps only Back + Save). */}
      {canEdit && template.custom && (
        <Button type="button" variant="ghost" fullWidth disabled={busy} onClick={() => setConfirmRestore(true)} leftIcon={<RotateCcw className="h-4 w-4" />} className="sm:hidden">
          Restore the default wording
        </Button>
      )}

      <StickyActionBar innerClassName="lg:justify-between">
        <SaveStatus state={state} idle={idle} className="hidden lg:inline-flex" />
        <div className="flex w-full flex-col gap-2 lg:w-auto">
          <SaveStatus state={state} idle={idle} className="lg:hidden" />
          <div className="flex w-full items-center gap-2 lg:w-auto">
            <ButtonLink href="/admin/notifications/templates" variant="outline" className="flex-1 lg:flex-none">
              Back
            </ButtonLink>
            {canEdit && (
              <>
                <Button type="button" variant="outline" disabled={!template.custom || busy} onClick={() => setConfirmRestore(true)} leftIcon={<RotateCcw className="h-4 w-4" />} className="hidden sm:inline-flex">
                  Restore default
                </Button>
                <Button type="submit" loading={busy} disabled={!dirty} leftIcon={<Save className="h-4 w-4" />} className="flex-2 lg:flex-none">
                  Save template
                </Button>
              </>
            )}
          </div>
        </div>
      </StickyActionBar>

      <ConfirmDialog open={confirmRestore} onClose={() => !busy && setConfirmRestore(false)} onConfirm={restore} title="Restore the default template?" description="Your customised text will be deleted and the built-in wording used again." confirmLabel="Restore default" danger loading={busy} />
    </form>
  );
}
