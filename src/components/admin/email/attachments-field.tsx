"use client";

import * as React from "react";
import { File as FileIcon, FileArchive, FileImage, FileSpreadsheet, FileText, Paperclip, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { IconButton } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/stats";
import { toast } from "@/components/ui/toast";
import { attachmentUrl, uploadWithProgress } from "@/components/admin/email/html-tools";
import type { EmailAttachment } from "@/components/admin/email/types";

/*
 * Attachments for the composer: drop or pick files, upload each one (with progress) as a PRIVATE file
 * through POST /api/admin/email/attachments, list them with name / type / size and a preview link, and
 * keep the running total under the Foundation's limit. The server re-checks extension, content
 * (magic bytes), size and ownership; these checks only save a pointless upload.
 */

const MAX_FILES = 10;

interface Pending {
  id: string;
  name: string;
  size: number;
  progress: number;
  error?: string;
  abort?: AbortController;
}

function iconFor(a: { name: string; mimeType?: string }) {
  const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
  if (a.mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) return FileImage;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (ext === "zip") return FileArchive;
  if (["pdf", "doc", "docx", "txt"].includes(ext)) return FileText;
  return FileIcon;
}

const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

export interface AttachmentsFieldProps {
  id: string;
  attachments: EmailAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<EmailAttachment[]>>;
  maxTotalMb: number;
  exts: readonly string[];
  disabled?: boolean;
  /** Told whenever uploads start or finish, so the composer can hold Send until they are done. */
  onBusyChange?: (busy: boolean) => void;
  "aria-describedby"?: string;
}

export function AttachmentsField({ id, attachments, setAttachments, maxTotalMb, exts, disabled, onBusyChange, "aria-describedby": describedBy }: AttachmentsFieldProps) {
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [drag, setDrag] = React.useState(false);
  const active = React.useRef(0);
  const maxBytes = maxTotalMb * 1024 * 1024;
  const total = attachments.reduce((s, a) => s + a.size, 0);
  const accept = exts.map((e) => `.${e}`).join(",");

  const setBusy = (delta: number) => {
    const before = active.current > 0;
    active.current = Math.max(0, active.current + delta);
    const after = active.current > 0;
    if (before !== after) onBusyChange?.(after);
  };

  const upload = async (file: File) => {
    const pid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const abort = new AbortController();
    setPending((p) => [...p, { id: pid, name: file.name, size: file.size, progress: 0, abort }]);
    setBusy(1);
    try {
      const form = new FormData();
      form.append("file", file);
      const a = await uploadWithProgress<EmailAttachment>("/api/admin/email/attachments", form, (pct) => setPending((p) => p.map((x) => (x.id === pid ? { ...x, progress: pct } : x))), abort.signal);
      setAttachments((list) => (list.some((x) => x.key === a.key) ? list : [...list, { key: a.key, name: a.name, size: a.size, mimeType: a.mimeType, url: a.url }]));
      setPending((p) => p.filter((x) => x.id !== pid));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      if (abort.signal.aborted) setPending((p) => p.filter((x) => x.id !== pid));
      else setPending((p) => p.map((x) => (x.id === pid ? { ...x, error: message, abort: undefined } : x)));
    } finally {
      setBusy(-1);
    }
  };

  const addFiles = (list: FileList | File[] | null) => {
    if (!list || disabled) return;
    const files = Array.from(list);
    let count = attachments.length + pending.filter((p) => !p.error).length;
    let running = total + pending.filter((p) => !p.error).reduce((s, p) => s + p.size, 0);
    const problems: string[] = [];
    for (const f of files) {
      const ext = extOf(f.name);
      if (!exts.includes(ext)) problems.push(`${f.name}: .${ext || "?"} files cannot be attached`);
      else if (f.size === 0) problems.push(`${f.name}: the file is empty`);
      else if (count >= MAX_FILES) problems.push(`${f.name}: at most ${MAX_FILES} attachments per email`);
      else if (running + f.size > maxBytes) problems.push(`${f.name}: attachments may total at most ${maxTotalMb} MB`);
      else {
        count++;
        running += f.size;
        void upload(f);
      }
    }
    if (problems.length) toast.error(problems.length === 1 ? "File not attached" : `${problems.length} files not attached`, problems.slice(0, 3).join(" · "));
  };

  const remove = (key: string) => setAttachments((list) => list.filter((a) => a.key !== key));

  return (
    <div className="space-y-3">
      <input
        id={id}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        aria-describedby={describedBy}
        className="peer sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 tap-highlight-none transition-colors duration-micro motion-reduce:transition-none",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-orange peer-focus-visible:ring-offset-2",
          drag ? "border-orange bg-orange-light/50" : "border-line bg-surface/70 hover:border-navy/40 hover:bg-surface",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", drag ? "bg-orange text-white" : "bg-lavender text-navy")} aria-hidden>
          <Paperclip className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{drag ? "Drop to attach" : "Attach files"}</span>
          <span className="block text-xs text-muted">
            {exts.map((e) => e.toUpperCase()).join(", ")} · up to {MAX_FILES} files, {maxTotalMb} MB in total
          </span>
        </span>
      </label>

      {(attachments.length > 0 || pending.length > 0) && (
        <ul className="divide-y divide-line rounded-card border border-line" aria-label="Attachments">
          {attachments.map((a) => {
            const Icon = iconFor(a);
            const url = a.url ?? attachmentUrl(a.key);
            const isImage = a.mimeType.startsWith("image/");
            return (
              <li key={a.key} className="flex items-center gap-3 px-3 py-2">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, access-controlled file; next/image cannot forward the session
                  <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-md border border-line object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy" aria-hidden>
                    <Icon className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="ring-focus block truncate rounded-xs text-sm font-semibold text-ink hover:text-navy hover:underline">
                    {a.name}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <span className="block text-caption text-muted">
                    {extOf(a.name).toUpperCase() || "File"} · {formatBytes(a.size)}
                  </span>
                </span>
                <IconButton aria-label={`Remove ${a.name}`} icon={<X className="h-4 w-4" />} size="sm" onClick={() => remove(a.key)} disabled={disabled} />
              </li>
            );
          })}
          {pending.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", p.error ? "bg-danger-light text-danger" : "bg-surface text-muted")} aria-hidden>
                <Paperclip className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                {p.error ? (
                  <span className="block text-caption text-danger" role="alert">
                    {p.error}
                  </span>
                ) : (
                  <ProgressBar value={p.progress} label="Uploading…" />
                )}
              </span>
              <IconButton
                aria-label={p.error ? `Dismiss ${p.name}` : `Cancel uploading ${p.name}`}
                icon={<X className="h-4 w-4" />}
                size="sm"
                onClick={() => {
                  if (p.abort) p.abort.abort();
                  else setPending((list) => list.filter((x) => x.id !== p.id));
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {attachments.length > 0 && (
        <ProgressBar
          value={Math.min(total, maxBytes)}
          max={maxBytes}
          tone={total > maxBytes * 0.9 ? "warning" : "navy"}
          label={`${attachments.length} of ${MAX_FILES} files · ${formatBytes(total)} of ${maxTotalMb} MB`}
        />
      )}
    </div>
  );
}
