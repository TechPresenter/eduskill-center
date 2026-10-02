"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, FlaskConical, Plus, Save, Send, Settings } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { toast } from "@/components/ui/toast";
import { SaveStatus } from "@/components/admin/content/app-list";
import { useUnsavedChangesWarning } from "@/components/admin/content/use-unsaved";
import { RichTextEditor } from "@/components/admin/email/rich-text-editor";
import { RecipientInput } from "@/components/admin/email/recipient-input";
import { AttachmentsField } from "@/components/admin/email/attachments-field";
import { PreviewSheet } from "@/components/admin/email/email-preview";
import { isHtmlEmpty, isValidEmail } from "@/components/admin/email/html-tools";
import { EMAIL_PROSE } from "@/components/admin/email/prose";
import type { ComposerConfig, EmailAttachment, EmailMessageResult, PreviewResult, TemplateOption } from "@/components/admin/email/types";

/*
 * Admin → Send Email → Compose. Everything is sent by the server through the Foundation's SMTP
 * account; this component only collects the email and talks to /api/admin/email/*:
 *
 *   Preview     POST /preview  → server-rendered HTML (sanitised body + signature + layout)
 *   Send test   POST /test     → a "[TEST]" copy to one address (default: your own)
 *   Save draft  POST /drafts   → creates / updates the draft (URL becomes ?draft=<id>)
 *   Send        POST /send     → after a confirmation; more than `bulkConfirmThreshold` recipients
 *                                needs an explicit "I confirm" tick (sent as confirmBulk)
 */

export interface ComposerInitial {
  draftId: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  includeSignature: boolean;
  attachments: EmailAttachment[];
  templateId: string | null;
  savedAt: string | null;
}

export interface EmailComposerProps {
  config: ComposerConfig;
  starters: TemplateOption[];
  templates: TemplateOption[];
  initial: ComposerInitial;
  userEmail: string | null;
  canViewHistory: boolean;
  canEditSignature: boolean;
  notice?: { tone: "info" | "warning"; title: string; body: string } | null;
}

type Busy = null | "preview" | "test" | "draft" | "send";
type FieldKey = "to" | "cc" | "bcc" | "subject" | "html" | "attachments" | "testTo" | "confirmBulk";

const GENERIC_422 = "Please correct the highlighted fields.";

function mapFieldErrors(details: Record<string, string>): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  for (const [k, v] of Object.entries(details)) {
    const key = k.split(".")[0] as FieldKey;
    if (["to", "cc", "bcc", "subject", "html", "attachments", "testTo", "confirmBulk"].includes(key) && !out[key]) out[key] = v;
  }
  return out;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function EmailComposer({ config, starters, templates, initial, userEmail, canViewHistory, canEditSignature, notice }: EmailComposerProps) {
  const router = useRouter();
  const uid = React.useId();
  const ids = {
    to: `${uid}-to`,
    cc: `${uid}-cc`,
    bcc: `${uid}-bcc`,
    subject: `${uid}-subject`,
    template: `${uid}-template`,
    html: `${uid}-body`,
    htmlLabel: `${uid}-body-label`,
    htmlError: `${uid}-body-error`,
    attachments: `${uid}-attachments`,
    testTo: `${uid}-test-to`,
  };

  const [draftId, setDraftId] = React.useState(initial.draftId);
  const [to, setTo] = React.useState(initial.to);
  const [cc, setCc] = React.useState(initial.cc);
  const [bcc, setBcc] = React.useState(initial.bcc);
  const [showCc, setShowCc] = React.useState(initial.cc.length > 0);
  const [showBcc, setShowBcc] = React.useState(initial.bcc.length > 0);
  const [subject, setSubject] = React.useState(initial.subject);
  const [html, setHtml] = React.useState(initial.html);
  const [includeSignature, setIncludeSignature] = React.useState(initial.includeSignature);
  const [attachments, setAttachments] = React.useState<EmailAttachment[]>(initial.attachments);
  const [templateId, setTemplateId] = React.useState(initial.templateId);
  const [uploading, setUploading] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [dirty, setDirty] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(initial.savedAt);
  const [busy, setBusy] = React.useState<Busy>(null);
  const [preview, setPreview] = React.useState<{ open: boolean; data: PreviewResult | null }>({ open: false, data: null });
  const [testOpen, setTestOpen] = React.useState(false);
  const [testTo, setTestTo] = React.useState(userEmail ?? "");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [bulkOk, setBulkOk] = React.useState(false);
  const [pendingTemplate, setPendingTemplate] = React.useState<TemplateOption | null>(null);
  const [result, setResult] = React.useState<EmailMessageResult | null>(null);

  useUnsavedChangesWarning(dirty);

  const recipients = React.useMemo(() => new Set([...to, ...cc, ...bcc]).size, [to, cc, bcc]);
  const bulk = recipients > config.bulkConfirmThreshold;
  const overLimit = recipients > config.maxRecipients;
  const attachmentBytes = attachments.reduce((s, a) => s + a.size, 0);
  const canSend = config.configured;

  const touch = (field?: FieldKey) => {
    setDirty(true);
    if (field) setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const focusField = (field: FieldKey) => {
    const target = field === "html" ? ids.html : field === "attachments" ? ids.attachments : field === "confirmBulk" ? null : ids[field as "to" | "cc" | "bcc" | "subject" | "testTo"];
    if (target) document.getElementById(target)?.focus();
  };

  const showErrors = (e: Partial<Record<FieldKey, string>>, title = "Please check the email") => {
    setErrors(e);
    const first = (["to", "cc", "bcc", "subject", "html", "attachments"] as FieldKey[]).find((k) => e[k]);
    if (first) {
      toast.error(title, e[first]);
      focusField(first);
    }
  };

  const validate = (purpose: "send" | "test" | "draft") => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (purpose === "send") {
      for (const [key, list] of [
        ["to", to],
        ["cc", cc],
        ["bcc", bcc],
      ] as const) {
        const bad = list.filter((a) => !isValidEmail(a));
        if (bad.length) e[key] = `Not a valid email address: ${bad.slice(0, 3).join(", ")}`;
      }
      if (!to.length) e.to ??= "Add at least one recipient";
      if (overLimit) e.to ??= `At most ${config.maxRecipients} recipients per email (To + Cc + Bcc). Split the list.`;
    }
    if (!subject.trim()) e.subject = "Enter a subject";
    if (purpose !== "draft" && isHtmlEmpty(html)) e.html = "Write a message";
    if (uploading) e.attachments = "Wait for the attachments to finish uploading";
    return e;
  };

  const handleError = (err: unknown, title: string) => {
    if (err instanceof ApiClientError) {
      const fields = mapFieldErrors(err.fieldErrors);
      if (Object.keys(fields).length) {
        setErrors((e) => ({ ...e, ...fields }));
        const first = (["to", "cc", "bcc", "subject", "html", "attachments", "testTo", "confirmBulk"] as FieldKey[]).find((k) => fields[k]);
        toast.error(title, err.message === GENERIC_422 && first ? fields[first] : err.message);
        if (first) focusField(first);
        return;
      }
      toast.error(title, err.message);
      return;
    }
    toast.error(title, errorMessage(err));
  };

  const payload = () => ({
    to,
    cc,
    bcc,
    subject: subject.trim(),
    html,
    includeSignature,
    attachments: attachments.map(({ key, name, size, mimeType }) => ({ key, name, size, mimeType })),
    templateId,
  });

  /* ── Templates ── */

  const applyTemplate = (t: TemplateOption) => {
    setSubject(t.subject);
    setHtml(t.html);
    setTemplateId(t.starter ? null : t.id);
    setPendingTemplate(null);
    setErrors((e) => ({ ...e, subject: undefined, html: undefined }));
    setDirty(true);
    toast.info(`“${t.name}” applied`, "Edit the subject and message before sending.");
  };

  const chooseTemplate = (id: string) => {
    const t = [...starters, ...templates].find((x) => x.id === id);
    if (!t) return;
    if (!isHtmlEmpty(html) || subject.trim()) setPendingTemplate(t);
    else applyTemplate(t);
  };

  /* ── Actions ── */

  const openPreview = async () => {
    setBusy("preview");
    setPreview({ open: true, data: null });
    try {
      const r = await api.post<PreviewResult>("/api/admin/email/preview", { html, includeSignature, subject: subject.trim() });
      setPreview({ open: true, data: r });
    } catch (err) {
      setPreview({ open: false, data: null });
      handleError(err, "Preview failed");
    } finally {
      setBusy(null);
    }
  };

  const openTest = () => {
    const e = validate("test");
    if (Object.keys(e).length) {
      showErrors(e, "Finish the email before testing it");
      return;
    }
    setErrors((x) => ({ ...x, testTo: undefined }));
    setTestOpen(true);
  };

  const sendTest = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const address = testTo.trim().toLowerCase();
    if (!isValidEmail(address)) {
      setErrors((x) => ({ ...x, testTo: "Enter a valid email address" }));
      return;
    }
    setBusy("test");
    try {
      const r = await api.post<EmailMessageResult>("/api/admin/email/test", { ...payload(), testTo: address });
      setTestOpen(false);
      if (r.status === "FAILED") toast.error("The test email could not be sent", r.error ?? "The mail server refused the message.");
      else toast.success("Test email sent", `Check the inbox of ${address}. Its subject starts with [TEST].`);
    } catch (err) {
      handleError(err, "Test email not sent");
    } finally {
      setBusy(null);
    }
  };

  const saveDraft = async () => {
    const e = validate("draft");
    if (Object.keys(e).length) {
      showErrors(e, "The draft was not saved");
      return;
    }
    setBusy("draft");
    try {
      const r = await api.post<EmailMessageResult>("/api/admin/email/drafts", { ...payload(), draftId });
      setDraftId(r.id);
      setDirty(false);
      setSavedAt(new Date().toISOString());
      setResult(null);
      // Keep the URL pointing at the draft (a reload reopens it) without a server round trip.
      window.history.replaceState(null, "", withBasePath(`/admin/email?draft=${r.id}`));
      toast.success("Draft saved", "It is listed under Drafts until you send or delete it.");
    } catch (err) {
      handleError(err, "The draft was not saved");
    } finally {
      setBusy(null);
    }
  };

  const requestSend = () => {
    const e = validate("send");
    if (Object.keys(e).length) {
      showErrors(e, "The email is not ready to send");
      return;
    }
    setBulkOk(false);
    setErrors((x) => ({ ...x, confirmBulk: undefined }));
    setPreview((p) => ({ ...p, open: false }));
    setConfirmOpen(true);
  };

  const reset = () => {
    setDraftId(null);
    setTo([]);
    setCc([]);
    setBcc([]);
    setShowCc(false);
    setShowBcc(false);
    setSubject("");
    setHtml("");
    setAttachments([]);
    setTemplateId(null);
    setIncludeSignature(config.signatureDefault);
    setSavedAt(null);
    setDirty(false);
    setErrors({});
  };

  const send = async () => {
    if (bulk && !bulkOk) {
      setErrors((x) => ({ ...x, confirmBulk: `Tick the box to confirm sending to ${recipients} people.` }));
      return;
    }
    setBusy("send");
    try {
      const r = await api.post<EmailMessageResult>("/api/admin/email/send", { ...payload(), draftId, confirmBulk: bulk ? true : undefined });
      setConfirmOpen(false);
      if (r.status === "FAILED") {
        // The draft (if any) is kept by the server, so the next save or send still uses it.
        setResult(r);
        toast.error("The email could not be sent", r.error ?? "The mail server refused the message.");
        return;
      }
      // Sent: the draft it came from is gone; this is now a history entry.
      setDraftId(null);
      window.history.replaceState(null, "", withBasePath("/admin/email"));
      setDirty(false);
      if (r.error) toast.warning("Sent, but some addresses were refused", r.error);
      else toast.success("Email sent", `Handed to the mail server for ${plural(recipients, "recipient")}.`);
      if (canViewHistory) {
        router.push(`/admin/email/history/${r.id}`);
        return;
      }
      reset();
      setResult(r);
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors.confirmBulk) {
        setErrors((x) => ({ ...x, confirmBulk: err.fieldErrors.confirmBulk }));
        return;
      }
      setConfirmOpen(false);
      handleError(err, "The email was not sent");
    } finally {
      setBusy(null);
    }
  };

  const saveState = busy === "draft" ? "saving" : dirty ? "dirty" : savedAt ? "saved" : "clean";

  return (
    <div className="space-y-4">
      {(draftId || dirty) && (
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <SaveStatus state={saveState} idle={draftId ? "Draft" : "New email"} />
        </div>
      )}
      {notice && (
        <Alert tone={notice.tone} title={notice.title}>
          {notice.body}
        </Alert>
      )}
      {!config.configured && (
        <Alert
          tone="warning"
          title="Email is not set up yet"
          action={
            <ButtonLink href="/admin/settings/comms" variant="outline" size="sm" leftIcon={<Settings className="h-4 w-4" />} className="shrink-0">
              Open settings
            </ButtonLink>
          }
        >
          Sending is turned off until a Super Admin enters the SMTP account in Settings → Communication. You can still write, preview and save drafts.
        </Alert>
      )}
      {result?.status === "FAILED" && (
        <Alert tone="danger" title="The email could not be sent">
          <p className="break-words">{result.error ?? "The mail server refused the message."}</p>
          <p className="mt-1">
            Your email is still here: fix the problem and send it again.
            {canViewHistory && (
              <>
                {" "}
                <Link href={`/admin/email/history/${result.id}`} className="font-semibold underline">
                  See the failed attempt
                </Link>
              </>
            )}
          </p>
        </Alert>
      )}
      {result?.status === "SENT" && (
        <Alert tone="success" title="Email sent">
          “{result.subject}” was handed to the mail server{result.messageId ? ` (Message-ID ${result.messageId})` : ""}.
        </Alert>
      )}

      <Card>
        <CardHeader title="Recipients" description={config.from ? `Sent from ${config.from}${config.replyTo ? ` · replies go to ${config.replyTo}` : ""}` : "The From address is set in Settings → Communication."} />
        <CardBody className="space-y-4">
          <Field label="To" htmlFor={ids.to} required error={errors.to} hint="Type or paste addresses; separate them with commas, spaces or new lines.">
            <RecipientInput
              id={ids.to}
              value={to}
              onChange={(v) => {
                setTo(v);
                touch("to");
              }}
              invalid={!!errors.to}
            />
          </Field>
          {showCc && (
            <Field label="Cc" htmlFor={ids.cc} error={errors.cc} hint="Everyone sees who was copied.">
              <RecipientInput
                id={ids.cc}
                value={cc}
                onChange={(v) => {
                  setCc(v);
                  touch("cc");
                }}
                invalid={!!errors.cc}
              />
            </Field>
          )}
          {showBcc && (
            <Field label="Bcc" htmlFor={ids.bcc} error={errors.bcc} hint="Hidden from every other recipient. Use Bcc for large lists so addresses stay private.">
              <RecipientInput
                id={ids.bcc}
                value={bcc}
                onChange={(v) => {
                  setBcc(v);
                  touch("bcc");
                }}
                invalid={!!errors.bcc}
              />
            </Field>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {!showCc && (
              <Button
                type="button"
                variant="link"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setShowCc(true);
                  window.setTimeout(() => document.getElementById(ids.cc)?.focus(), 0);
                }}
              >
                Add Cc
              </Button>
            )}
            {!showBcc && (
              <Button
                type="button"
                variant="link"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setShowBcc(true);
                  window.setTimeout(() => document.getElementById(ids.bcc)?.focus(), 0);
                }}
              >
                Add Bcc
              </Button>
            )}
            <p className={cn("text-caption sm:ml-auto", overLimit ? "font-semibold text-danger" : bulk ? "font-semibold text-warning-dark" : "text-muted")} aria-live="polite">
              {recipients} of {config.maxRecipients} recipients
              {bulk && !overLimit ? ` · more than ${config.bulkConfirmThreshold} needs a confirmation` : ""}
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Message" />
        <CardBody className="space-y-4">
          <Field label="Start from a template" htmlFor={ids.template} hint="Replaces the subject and message. Recipients and attachments stay.">
            <Select id={ids.template} value="" onChange={(e) => chooseTemplate(e.target.value)} options={[]} placeholder="Choose a template…">
              {starters.length > 0 && (
                <optgroup label="Starter layouts">
                  {starters.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {templates.length > 0 && (
                <optgroup label="Saved templates">
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </Field>

          <Field label="Subject" htmlFor={ids.subject} required error={errors.subject}>
            <Input
              id={ids.subject}
              value={subject}
              maxLength={200}
              onChange={(e) => {
                // Line breaks can never reach a mail header.
                setSubject(e.target.value.replace(/[\r\n]+/g, " "));
                touch("subject");
              }}
              invalid={!!errors.subject}
              placeholder="What is this email about?"
              autoComplete="off"
            />
          </Field>

          <div className="space-y-1.5">
            <span id={ids.htmlLabel} className="block text-sm font-semibold text-ink">
              Message
              <span className="ml-0.5 text-danger" aria-hidden>
                *
              </span>
            </span>
            <RichTextEditor
              id={ids.html}
              value={html}
              onChange={(v) => {
                setHtml(v);
                if (v !== html) touch("html");
              }}
              aria-labelledby={ids.htmlLabel}
              aria-describedby={errors.html ? ids.htmlError : undefined}
              invalid={!!errors.html}
            />
            {errors.html && (
              <p id={ids.htmlError} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{errors.html}</span>
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-card border border-line bg-surface/40 p-4">
            <Checkbox
              checked={includeSignature}
              onChange={(e) => {
                setIncludeSignature(e.target.checked);
                touch();
              }}
              label="Add signature"
              description="Appended below the message, after a thin divider."
            />
            {includeSignature &&
              (config.signatureHtml ? (
                <div className={cn("rounded-md border border-line bg-white px-4 py-3 text-[15px]", EMAIL_PROSE)} aria-label="Signature preview" role="note" dangerouslySetInnerHTML={{ __html: config.signatureHtml }} />
              ) : (
                <p className="text-body-sm text-muted">
                  No signature has been set up yet.{" "}
                  {canEditSignature && (
                    <Link href="/admin/settings/email" className="font-semibold text-navy underline">
                      Set it up in Settings → Email
                    </Link>
                  )}
                </p>
              ))}
            {includeSignature && config.signatureHtml && canEditSignature && (
              <Link href="/admin/settings/email" className="ring-focus inline-flex min-h-11 items-center rounded-xs text-sm font-semibold text-navy hover:underline sm:min-h-0">
                Edit the signature in Settings → Email
              </Link>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Attachments" description="Private files: only you can attach your uploads, and they are sent with the email." />
        <CardBody className="space-y-2">
          <AttachmentsField
            id={ids.attachments}
            attachments={attachments}
            setAttachments={(next) => {
              setAttachments(next);
              touch("attachments");
            }}
            maxTotalMb={config.maxAttachmentMb}
            exts={config.attachmentExts}
            onBusyChange={setUploading}
          />
          {errors.attachments && (
            <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{errors.attachments}</span>
            </p>
          )}
        </CardBody>
      </Card>

      <p className="text-caption text-muted">
        Limits: {config.maxRecipients} recipients per email, {config.maxAttachmentMb} MB of attachments, {config.dailyLimit} emails per administrator per day. Every email is logged in the Sent history.
      </p>

      <StickyActionBar>
        <SaveStatus state={saveState} idle={savedAt ? `Draft saved ${formatDateTime(savedAt)}` : draftId ? "Draft" : "New email"} className="mr-auto hidden lg:inline-flex" />
        <Button type="button" variant="outline" onClick={openPreview} loading={busy === "preview"} disabled={!!busy && busy !== "preview"} leftIcon={<Eye className="h-4 w-4" />} aria-label="Preview" className="shrink-0 max-lg:w-12 max-lg:px-0">
          <span className="hidden lg:inline">Preview</span>
        </Button>
        <Button type="button" variant="outline" onClick={openTest} disabled={!canSend || !!busy} leftIcon={<FlaskConical className="h-4 w-4" />} aria-label="Send test email" className="shrink-0 max-lg:w-12 max-lg:px-0">
          <span className="hidden lg:inline">Send test</span>
        </Button>
        <Button type="button" variant="outline" onClick={saveDraft} loading={busy === "draft"} disabled={!!busy && busy !== "draft"} leftIcon={<Save className="h-4 w-4" />} aria-label="Save as draft" className="shrink-0 max-lg:w-12 max-lg:px-0">
          <span className="hidden lg:inline">Save draft</span>
        </Button>
        <Button type="button" onClick={requestSend} disabled={!canSend || !!busy} leftIcon={<Send className="h-4 w-4" />} className="flex-1 lg:flex-none">
          Send
        </Button>
      </StickyActionBar>

      <PreviewSheet
        open={preview.open}
        onClose={() => setPreview((p) => ({ ...p, open: false }))}
        html={preview.data?.html ?? null}
        text={preview.data?.text}
        subject={subject}
        from={config.from}
        replyTo={config.replyTo}
        to={to}
        cc={cc}
        bcc={bcc}
        attachments={attachments}
        action={
          canSend ? (
            <Button type="button" onClick={requestSend} leftIcon={<Send className="h-4 w-4" />} disabled={!!busy}>
              Send…
            </Button>
          ) : undefined
        }
      />

      <Modal
        open={testOpen}
        onClose={() => busy !== "test" && setTestOpen(false)}
        size="sm"
        title="Send a test email"
        description="Only this address receives it, with “[TEST]” in front of the subject. It is logged in the Sent history."
        initialFocus="first"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setTestOpen(false)} disabled={busy === "test"}>
              Cancel
            </Button>
            <Button type="submit" form={`${uid}-test-form`} loading={busy === "test"} leftIcon={<FlaskConical className="h-4 w-4" />}>
              Send test
            </Button>
          </>
        }
      >
        <form id={`${uid}-test-form`} onSubmit={sendTest} noValidate>
          <Field label="Send the test to" htmlFor={ids.testTo} required error={errors.testTo}>
            <Input
              id={ids.testTo}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={testTo}
              onChange={(e) => {
                setTestTo(e.target.value);
                setErrors((x) => ({ ...x, testTo: undefined }));
              }}
              invalid={!!errors.testTo}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => busy !== "send" && setConfirmOpen(false)}
        size="sm"
        title="Send this email?"
        description="It goes out immediately through the Foundation's mail account and cannot be recalled."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy === "send"}>
              Cancel
            </Button>
            <Button type="button" onClick={send} loading={busy === "send"} disabled={bulk && !bulkOk} leftIcon={<Send className="h-4 w-4" />}>
              {busy === "send" ? "Sending…" : `Send to ${plural(recipients, "recipient")}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted">Subject</dt>
              <dd className="min-w-0 font-semibold break-words text-ink">{subject}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted">Recipients</dt>
              <dd className="min-w-0 text-ink">
                {plural(to.length, "To")}
                {cc.length ? ` · ${cc.length} Cc` : ""}
                {bcc.length ? ` · ${bcc.length} Bcc` : ""}
                <span className="block text-caption text-muted">{plural(recipients, "unique address")}</span>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted">Attachments</dt>
              <dd className="min-w-0 text-ink">{attachments.length ? `${plural(attachments.length, "file")} · ${formatBytes(attachmentBytes)}` : "None"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted">Signature</dt>
              <dd className="text-ink">{includeSignature && config.signatureHtml ? "Included" : "Not included"}</dd>
            </div>
            {config.from && (
              <div className="flex gap-3">
                <dt className="w-24 shrink-0 text-muted">From</dt>
                <dd className="min-w-0 break-words text-ink">{config.from}</dd>
              </div>
            )}
          </dl>
          {bulk && (
            <div className="space-y-2 rounded-card border border-warning/30 bg-warning-light p-3">
              <p className="text-sm font-semibold text-amber-900">This is a bulk email to {recipients} people.</p>
              <Checkbox
                checked={bulkOk}
                onChange={(e) => {
                  setBulkOk(e.target.checked);
                  setErrors((x) => ({ ...x, confirmBulk: undefined }));
                }}
                label={`I confirm sending this email to ${recipients} people`}
              />
              {errors.confirmBulk && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {errors.confirmBulk}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingTemplate}
        onClose={() => setPendingTemplate(null)}
        onConfirm={() => {
          if (pendingTemplate) applyTemplate(pendingTemplate);
        }}
        title="Replace your message?"
        description={pendingTemplate ? `The subject and message will be replaced with the “${pendingTemplate.name}” template. Recipients and attachments stay as they are.` : undefined}
        confirmLabel="Replace"
      />

    </div>
  );
}
