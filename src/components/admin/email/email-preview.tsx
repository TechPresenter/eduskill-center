"use client";

import * as React from "react";
import { FileText, Monitor, Paperclip, Smartphone } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SegmentedControl } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/admin/shared/copy-button";
import { attachmentUrl } from "@/components/admin/email/html-tools";
import type { EmailAttachment } from "@/components/admin/email/types";

/*
 * Email previews. The HTML is the SERVER's rendering (sanitised body + signature + layout), shown in
 * an <iframe sandbox=""> — no scripts, no same-origin access, no navigation — at a real desktop
 * (640px) and phone (375px) width. The HTML tab shows that same source read-only.
 */

type View = "desktop" | "mobile" | "html" | "text";

/** One sandboxed frame. The desktop frame keeps its 640px width and scrolls sideways on narrow screens. */
export function EmailFrame({ html, view, title, className }: { html: string; view: "desktop" | "mobile"; title: string; className?: string }) {
  if (view === "mobile") {
    return (
      <div className={cn("flex justify-center", className)}>
        <div className="w-[375px] max-w-full overflow-hidden rounded-[2rem] border-[6px] border-ink/85 bg-white shadow-e2">
          <iframe title={title} sandbox="" srcDoc={html} className="block h-[min(70dvh,667px)] w-full bg-white" />
        </div>
      </div>
    );
  }
  return (
    // `relative`: an overflow-x container must be the containing block of anything absolutely positioned inside it.
    <div className={cn("relative overflow-x-auto rounded-card border border-line bg-[#f4f6fb]", className)}>
      <iframe title={title} sandbox="" srcDoc={html} className="mx-auto block h-[70dvh] w-[680px] max-w-none bg-[#f4f6fb]" />
    </div>
  );
}

export function EmailPreviewTabs({ html, text, label = "Email preview", initialView = "desktop" }: { html: string; text?: string | null; label?: string; initialView?: View }) {
  const [view, setView] = React.useState<View>(initialView);
  const items = [
    { value: "desktop", label: "Desktop" },
    { value: "mobile", label: "Mobile" },
    { value: "html", label: "HTML" },
    ...(text ? [{ value: "text", label: "Plain text" }] : []),
  ];
  return (
    <div className="space-y-3">
      <SegmentedControl aria-label={`${label}: view`} value={view} onChange={(v) => setView(v as View)} items={items} scrollable className="max-w-full" />
      {view === "desktop" && <EmailFrame html={html} view="desktop" title={`${label} at desktop width`} />}
      {view === "mobile" && <EmailFrame html={html} view="mobile" title={`${label} at phone width`} />}
      {view === "html" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-muted">The exact HTML that is sent, after sanitising. Read-only.</p>
            <CopyButton text={html} label="Copy HTML" />
          </div>
          <textarea readOnly value={html} aria-label="Email HTML source" spellCheck={false} className="block h-[60dvh] w-full resize-y rounded-md border border-line bg-[#0f1b33] p-3 font-mono text-[13px] leading-relaxed text-[#e5ecff] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange" />
        </div>
      )}
      {view === "text" && text && (
        <div className="space-y-2">
          <p className="text-caption text-muted">The plain-text version sent alongside the HTML, for mail apps that do not show HTML.</p>
          <pre className="max-h-[60dvh] overflow-auto rounded-md border border-line bg-surface/60 p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{text}</pre>
        </div>
      )}
    </div>
  );
}

function AttachmentList({ attachments }: { attachments: EmailAttachment[] }) {
  if (!attachments.length) return null;
  const total = attachments.reduce((s, a) => s + a.size, 0);
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-caption font-semibold tracking-wide text-muted uppercase">
        <Paperclip className="h-3.5 w-3.5" aria-hidden />
        {attachments.length} attachment{attachments.length === 1 ? "" : "s"} · {formatBytes(total)}
      </p>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <li key={a.key}>
            <a
              href={a.url ?? attachmentUrl(a.key)}
              target="_blank"
              rel="noopener noreferrer"
              className="ring-focus inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-navy/40 sm:min-h-9"
            >
              <FileText className="h-4 w-4 shrink-0 text-navy" aria-hidden />
              <span className="max-w-[14rem] truncate">{a.name}</span>
              <span className="shrink-0 text-caption text-muted">{formatBytes(a.size)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface PreviewSheetProps {
  open: boolean;
  onClose: () => void;
  html: string | null;
  text?: string | null;
  subject: string;
  from: string;
  replyTo?: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  attachments: EmailAttachment[];
  /** Footer action (e.g. "Send…"), shown beside Close. */
  action?: React.ReactNode;
}

/** Composer preview: envelope summary, Desktop / Mobile / HTML / Plain text, attachments. */
export function PreviewSheet({ open, onClose, html, text, subject, from, replyTo, to, cc, bcc, attachments, action }: PreviewSheetProps) {
  const line = (label: string, value: React.ReactNode) => (
    <div className="flex min-w-0 gap-2">
      <dt className="w-16 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{value}</dd>
    </div>
  );
  const list = (a: string[]) => (a.length > 3 ? `${a.slice(0, 3).join(", ")} and ${a.length - 3} more` : a.join(", "));
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="xl"
      height="full"
      title="Preview"
      description="Exactly what recipients will see, rendered by the server."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Back to editing
          </Button>
          {action}
        </>
      }
    >
      <div className="space-y-4">
        <dl className="space-y-1 rounded-card border border-line bg-surface/60 p-3 text-sm">
          {line("Subject", <span className="font-semibold">{subject || "(no subject)"}</span>)}
          {line("From", from || "—")}
          {replyTo ? line("Reply-To", replyTo) : null}
          {line("To", to.length ? list(to) : "—")}
          {cc.length ? line("Cc", list(cc)) : null}
          {bcc.length ? line("Bcc", `${bcc.length} hidden recipient${bcc.length === 1 ? "" : "s"}`) : null}
        </dl>
        <AttachmentList attachments={attachments} />
        {html ? (
          <EmailPreviewTabs html={html} text={text} />
        ) : (
          <div className="flex items-center justify-center gap-3 py-16 text-muted" aria-busy="true">
            <Monitor className="h-5 w-5" aria-hidden />
            <Smartphone className="h-5 w-5" aria-hidden />
            Rendering preview…
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
