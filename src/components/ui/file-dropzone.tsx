"use client";

import * as React from "react";
import { AlertCircle, FileText, Trash2, UploadCloud } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { IconButton } from "@/components/ui/button";

export interface FileDropzoneProps {
  /** The chosen file, or null. Owned by the caller so the form can submit it as multipart. */
  value: File | null;
  onChange: (file: File | null) => void;
  /** Accept attribute AND the extension allow-list, e.g. ".pdf,.doc,.docx". */
  accept: string;
  maxSizeMb: number;
  /** Id of the real `<input type="file">`, so a `<Field label>` / error summary can point at it. */
  id: string;
  label?: string;
  /** Server-side message for this field; shown with the same chrome as a local one. */
  error?: string | null;
  /** Called when the local checks reject a file, so the caller can clear a stale server error. */
  onError?: (message: string | null) => void;
  disabled?: boolean;
  className?: string;
  describedBy?: string;
}

/** ".pdf,.doc,.docx" → "PDF, DOC, DOCX" */
function formatAccept(accept: string) {
  return accept
    .split(",")
    .map((p) => p.trim().replace(/^\./, "").toUpperCase())
    .filter(Boolean)
    .join(", ");
}

function extensionOf(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

/**
 * A drop zone that HOLDS a file locally instead of uploading it.
 *
 * `FileUpload` (file-upload.tsx) posts the moment a file is picked, which is right when the record
 * it attaches to already exists. The short teacher form has no record yet — the resume is part of
 * the one submission — so this variant keeps the `File` in React state and lets the form send it.
 *
 * Accessibility: the control is a real `<input type="file">` behind a `<label>`, so it is in the
 * tab order, Space/Enter opens the picker and screen readers announce it. Drag-and-drop is an
 * addition on top of that, never the only way in.
 */
export function FileDropzone({ value, onChange, accept, maxSizeMb, id, label = "Upload file", error, onError, disabled, className, describedBy }: FileDropzoneProps) {
  const [drag, setDrag] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const allowed = React.useMemo(() => accept.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean), [accept]);

  const shown = localError ?? error ?? null;
  const errorId = `${id}-file-error`;

  const fail = (message: string) => {
    setLocalError(message);
    onError?.(message);
    onChange(null);
  };

  const accept_ = (file: File | undefined) => {
    if (!file) return;
    const ext = extensionOf(file.name);
    if (!ext || !allowed.includes(ext)) {
      fail(`${ext || "That file"} is not an accepted format. Upload a ${formatAccept(accept)} file.`);
      return;
    }
    if (file.size === 0) {
      fail("That file is empty. Choose your resume file and try again.");
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      fail(`That file is ${formatBytes(file.size)}. The maximum size is ${maxSizeMb} MB.`);
      return;
    }
    setLocalError(null);
    onError?.(null);
    onChange(file);
  };

  const clear = () => {
    setLocalError(null);
    onError?.(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  return (
    <div className={className}>
      {/* `peer` lends the hidden input's focus ring to the zone, so keyboard focus is visible. */}
      <input
        ref={inputRef}
        id={id}
        name={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-invalid={shown ? true : undefined}
        aria-describedby={[describedBy, shown ? errorId : null].filter(Boolean).join(" ") || undefined}
        className="peer sr-only"
        onChange={(e) => {
          accept_(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) accept_(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition duration-micro tap-highlight-none motion-reduce:transition-none",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-orange peer-focus-visible:ring-offset-2",
          drag
            ? "border-orange bg-orange-light/60"
            : shown
              ? "border-danger/60 bg-danger-light/40 hover:border-danger"
              : "border-navy/25 bg-lavender/40 hover:border-orange hover:bg-orange-light/30 active:bg-orange-light/50"
        )}
      >
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-micro motion-reduce:transition-none",
            drag ? "bg-orange text-white" : "bg-navy text-white"
          )}
          aria-hidden
        >
          <UploadCloud className="h-7 w-7" />
        </span>
        <span className="text-base font-bold text-navy">{drag ? "Drop your file to attach it" : label}</span>
        <span className="text-sm text-muted">
          Drag and drop here, or <span className="font-semibold text-orange underline underline-offset-2">browse your files</span>
        </span>
        <span className="text-xs text-muted">
          {formatAccept(accept)} · up to {maxSizeMb} MB
        </span>
      </label>

      {value && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success-light/50 p-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-navy" aria-hidden>
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{value.name}</span>
            <span className="block text-xs text-muted">{formatBytes(value.size)} · ready to submit</span>
          </span>
          <IconButton
            size="md"
            aria-label={`Remove ${value.name}`}
            icon={<Trash2 className="h-4 w-4" />}
            className="shrink-0 hover:bg-danger-light hover:text-danger"
            onClick={clear}
            disabled={disabled}
          />
        </div>
      )}

      {shown && (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{shown}</span>
        </p>
      )}
    </div>
  );
}
