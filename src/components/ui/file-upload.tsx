"use client";

import * as React from "react";
import { Camera, Eye, FileText, FolderOpen, Image as ImageIcon, Images, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { withBasePath } from "@/lib/base-path";
import { useIsCoarsePointer } from "@/lib/hooks";
import { toast } from "@/components/ui/toast";
import { IconButton, iconButtonClasses } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/stats";

export interface UploadedFile {
  key: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

/** Where a phone user may pick the file from. Desktop always shows the drag-and-drop zone. */
export type FileUploadSource = "camera" | "gallery" | "files";

export interface FileUploadProps {
  /** API endpoint that accepts multipart `file` and returns `{ success, data: UploadedFile }` */
  endpoint: string;
  /** Extra fields sent with the upload */
  fields?: Record<string, string>;
  accept?: string;
  maxSizeMb?: number;
  value?: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  /** Show image thumbnails (local preview while uploading, then the stored file). Default true. */
  preview?: boolean;
  /** Camera to open for the `camera` source: rear (`environment`, documents) or front (`user`, selfies). Default rear. */
  capture?: "environment" | "user";
  /**
   * Pick sources offered as 44px tiles on touch devices. Defaults to camera + gallery + files when `accept`
   * allows images, otherwise files only (which keeps the plain tap-to-choose zone).
   */
  sources?: FileUploadSource[];
  /** Upload progress callback (0–100); the built-in progress bar is always shown. */
  onProgress?: (percent: number) => void;
}

const IMAGE_HINT = /image\/|\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)\b/i;

function acceptsImages(accept: string) {
  return IMAGE_HINT.test(accept);
}

class UploadAbortedError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadAbortedError";
  }
}

interface UploadResponse {
  success?: boolean;
  data?: UploadedFile;
  error?: { message?: string };
}

function parseResponse(text: string): UploadResponse | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as UploadResponse) : null;
  } catch {
    return null;
  }
}

/** XHR upload (fetch has no upload progress events) that resolves with the API's `data` payload. */
function uploadWithProgress(endpoint: string, body: FormData, onProgress: (pct: number) => void) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadedFile>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const json = parseResponse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300 && json?.success && json.data) resolve(json.data);
      else reject(new Error(json?.error?.message ?? `Upload failed (${xhr.status || "network"})`));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and try again."));
    xhr.onabort = () => reject(new UploadAbortedError());
    // Callers pass an app-absolute path ("/api/admin/uploads"); XHR resolves it against the origin,
    // so the deployment sub-path has to be added here the same way api-client.ts does it for fetch.
    xhr.open("POST", withBasePath(endpoint));
    xhr.send(body);
  });
  return { promise, abort: () => xhr.abort() };
}

const SOURCE_META: Record<FileUploadSource, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  camera: { label: "Camera", Icon: Camera },
  gallery: { label: "Gallery", Icon: Images },
  files: { label: "Files", Icon: FolderOpen },
};

/**
 * Single-file uploader. Desktop: drag-and-drop / click zone. Touch devices: Camera / Gallery / Files tiles
 * (native camera via `capture`). Shows a local preview immediately, filename + size, a live progress bar
 * with cancel, and a "has file" card with View (PDFs/other), Replace and Delete actions.
 */
export function FileUpload({
  endpoint,
  fields,
  accept = ".jpg,.jpeg,.png,.pdf",
  maxSizeMb = 5,
  value,
  onChange,
  label = "Upload file",
  hint,
  disabled,
  className,
  preview = true,
  capture = "environment",
  sources,
  onProgress,
}: FileUploadProps) {
  const coarse = useIsCoarsePointer();
  const sourceList = React.useMemo<FileUploadSource[]>(() => sources ?? (acceptsImages(accept) ? ["camera", "gallery", "files"] : ["files"]), [sources, accept]);
  const tiles = coarse && sourceList.length > 1;

  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [pending, setPending] = React.useState<{ name: string; size: number; type: string } | null>(null);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const abortRef = React.useRef<(() => void) | null>(null);
  const inputs = React.useRef<Partial<Record<FileUploadSource, HTMLInputElement | null>>>({});
  const id = React.useId();

  // Revoke object URLs when they are replaced and on unmount.
  const previewRef = React.useRef<string | null>(null);
  const setPreviewUrl = React.useCallback((url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setLocalPreview(url);
  }, []);
  React.useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      abortRef.current?.();
    },
    []
  );

  const fail = (title: string, description?: string) => {
    setError(description ? `${title}: ${description}` : title);
    toast.error(title, description);
  };

  const upload = async (file: File) => {
    setError(null);
    if (file.size > maxSizeMb * 1024 * 1024) {
      fail("File too large", `Maximum size is ${maxSizeMb} MB (this file is ${formatBytes(file.size)})`);
      return;
    }
    setPending({ name: file.name, size: file.size, type: file.type });
    setPreviewUrl(preview && file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setProgress(0);
    onProgress?.(0);
    setBusy(true);
    setPicking(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(fields ?? {})) fd.append(k, v);
      const { promise, abort } = uploadWithProgress(endpoint, fd, (pct) => {
        setProgress(pct);
        onProgress?.(pct);
      });
      abortRef.current = abort;
      const uploaded = await promise;
      setProgress(100);
      onProgress?.(100);
      onChange(uploaded);
    } catch (err) {
      if (err instanceof UploadAbortedError) {
        setPreviewUrl(null);
      } else {
        fail("Upload failed", err instanceof Error ? err.message : undefined);
        setPreviewUrl(null);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setPending(null);
    }
  };

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f && !disabled && !busy) void upload(f);
  };

  const openPicker = (source?: FileUploadSource) => {
    if (disabled || busy) return;
    if (!source && tiles) {
      setPicking(true);
      return;
    }
    const target = inputs.current[source ?? (sourceList.includes("files") ? "files" : sourceList[0]!)];
    target?.click();
  };

  const hiddenInputs = (
    <>
      {sourceList.map((s) => (
        <input
          key={s}
          ref={(el) => {
            inputs.current[s] = el;
          }}
          id={s === "files" ? id : `${id}-${s}`}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={s === "files" ? accept : "image/*"}
          capture={s === "camera" ? capture : undefined}
          disabled={disabled || busy}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      ))}
    </>
  );

  const sourceTiles = (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={label}>
      {sourceList.map((s) => {
        const { label: sLabel, Icon } = SOURCE_META[s];
        return (
          <button
            key={s}
            type="button"
            disabled={disabled || busy}
            onClick={() => openPicker(s)}
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface/60 px-2 py-3 text-xs font-semibold text-ink transition-colors tap-highlight-none active:bg-lavender disabled:opacity-60"
          >
            <Icon className="h-6 w-6 text-navy" />
            {sLabel}
          </button>
        );
      })}
    </div>
  );

  const hintText = hint ?? `${tiles ? "Take a photo or choose a file." : "Drag & drop or click."} ${accept.replace(/\./g, "").toUpperCase()} up to ${maxSizeMb} MB`;

  /* ── Uploading ── */
  if (busy && pending) {
    const isImg = pending.type.startsWith("image/");
    return (
      <div className={cn("rounded-xl border border-line bg-white p-3", className)} aria-busy="true">
        <div className="flex items-center gap-3">
          {localPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={localPreview} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-lavender text-navy">{isImg ? <ImageIcon className="h-6 w-6" /> : <FileText className="h-6 w-6" />}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{pending.name}</p>
            <p className="text-xs text-muted">
              {formatBytes(pending.size)} · Uploading {progress}%
            </p>
          </div>
          <IconButton size="sm" aria-label="Cancel upload" icon={<X className="h-4 w-4" />} onClick={() => abortRef.current?.()} />
        </div>
        <ProgressBar value={progress} className="mt-3" />
        {hiddenInputs}
      </div>
    );
  }

  /* ── Has a file ── */
  if (value) {
    const isImage = value.mimeType?.startsWith("image/");
    const thumb = preview && isImage ? value.url : null;
    return (
      <div className={className}>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt={value.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" decoding="async" width={56} height={56} />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-lavender text-navy">{isImage ? <ImageIcon className="h-6 w-6" /> : <FileText className="h-6 w-6" />}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{value.name}</p>
            <p className="text-xs text-muted">{formatBytes(value.size)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {!isImage && value.url && (
              <a href={value.url} target="_blank" rel="noreferrer" className={iconButtonClasses({ size: "sm" })} aria-label={`View ${value.name}`}>
                <Eye className="h-4 w-4" />
              </a>
            )}
            {!disabled && (
              <>
                <IconButton size="sm" aria-label="Replace file" icon={<RefreshCw className="h-4 w-4" />} onClick={() => openPicker()} />
                <IconButton size="sm" aria-label="Remove file" icon={<Trash2 className="h-4 w-4" />} className="hover:bg-danger-light hover:text-danger" onClick={() => onChange(null)} />
              </>
            )}
          </div>
        </div>
        {picking && tiles && (
          <div className="mt-2 space-y-2">
            {sourceTiles}
            <button type="button" className="min-h-11 w-full text-sm font-medium text-muted hover:text-ink" onClick={() => setPicking(false)}>
              Keep the current file
            </button>
          </div>
        )}
        {hiddenInputs}
      </div>
    );
  }

  /* ── Empty: tiles on touch, dropzone elsewhere ── */
  if (tiles) {
    return (
      <div className={className}>
        <p className="mb-2 text-sm font-semibold text-ink">{label}</p>
        {sourceTiles}
        <p className="mt-1.5 text-xs text-muted">{hintText}</p>
        {error && (
          <p className="mt-1.5 text-[13px] font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        {hiddenInputs}
      </div>
    );
  }

  return (
    <div className={className}>
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
          if (!disabled) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-[7.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors tap-highlight-none",
          drag ? "border-orange bg-orange-light/40" : "border-line bg-surface/60 hover:border-navy/40 active:bg-lavender/60",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin text-orange" /> : <UploadCloud className="h-6 w-6 text-navy" />}
        <span className="text-sm font-semibold text-ink">{busy ? "Uploading…" : label}</span>
        <span className="text-xs text-muted">{hintText}</span>
      </label>
      {error && (
        <p className="mt-1.5 text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      {hiddenInputs}
    </div>
  );
}

/** Simple chip list for multi-value text (skills, languages). */
export function TagInput({ value, onChange, placeholder = "Type and press Enter", className }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; className?: string }) {
  const [text, setText] = React.useState("");
  const add = () => {
    const t = text.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setText("");
  };
  return (
    <div className={cn("flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-1.5 focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15", className)}>
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-lavender px-2.5 py-0.5 text-xs font-semibold text-navy">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
            className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full tap-highlight-none hover:bg-navy/10 hover:text-orange pointer-coarse:-my-1.5 pointer-coarse:h-8 pointer-coarse:w-8"
          >
            <X className="h-3 w-3 pointer-coarse:h-3.5 pointer-coarse:w-3.5" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-base sm:text-sm outline-none placeholder:text-muted/70"
      />
    </div>
  );
}
