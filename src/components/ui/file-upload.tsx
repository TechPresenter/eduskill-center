"use client";

import * as React from "react";
import { AlertCircle, Camera, Eye, FileText, FolderOpen, Image as ImageIcon, Images, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
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

/** ".jpg,.jpeg,.png,.pdf" → "JPG, JPEG, PNG, PDF"; anything else (e.g. "image/*") passes through. */
function formatAccept(accept: string) {
  const parts = accept
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length || !parts.every((p) => p.startsWith("."))) return accept.toUpperCase();
  return parts.map((p) => p.slice(1).toUpperCase()).join(", ");
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

/** The upload card's own error line — same size, icon and tone as `<Field error>`. */
function UploadError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** 56px square that shows the image itself, or a typed glyph on lavender when there is nothing to show. */
function FileThumb({ src, alt, image }: { src?: string | null; alt?: string; image: boolean }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ""} width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-md border border-line object-cover" />;
  }
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-lavender text-navy" aria-hidden>
      {image ? <ImageIcon className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
    </span>
  );
}

/**
 * Single-file uploader with one card anatomy across all four states.
 *
 *   resting    a dashed drop zone (desktop) or Camera / Gallery / Files tiles (touch), with the accepted
 *              formats and size limit always spelled out;
 *   dragging   the same zone in orange;
 *   uploading  thumbnail, file name, size, live percentage, progress bar and a cancel control;
 *   uploaded   thumbnail, name, size, and View / Replace / Delete — 44px targets that move to their own
 *              row below `sm` so the file name keeps its width on a 360px phone.
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

  // Only the drop-zone state has no visible control of its own, so only there does the hidden
  // "files" input join the tab order (and lend its focus ring to the zone through `peer`).
  const dropzone = !tiles && !value && !(busy && pending);

  const hiddenInputs = (
    <>
      {sourceList.map((s) => {
        const primary = s === "files" && dropzone;
        return (
          <input
            key={s}
            ref={(el) => {
              inputs.current[s] = el;
            }}
            id={s === "files" ? id : `${id}-${s}`}
            type="file"
            className={cn("sr-only", primary && "peer")}
            tabIndex={primary ? undefined : -1}
            accept={s === "files" ? accept : "image/*"}
            capture={s === "camera" ? capture : undefined}
            disabled={disabled || busy}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        );
      })}
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
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-surface/70 px-2 py-3 text-xs font-semibold text-ink transition duration-micro tap-highlight-none ring-focus focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-[0.98] active:bg-lavender disabled:opacity-60 motion-reduce:transition-none"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-lavender text-navy" aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
            {sLabel}
          </button>
        );
      })}
    </div>
  );

  const hintText = hint ?? `${tiles ? "Take a photo or choose a file." : "Drag and drop, or click to browse."} ${formatAccept(accept)} · up to ${maxSizeMb} MB`;

  /* ── Uploading ── */
  if (busy && pending) {
    return (
      <div className={cn("rounded-lg border border-line bg-white p-3 shadow-e1", className)} aria-busy="true">
        <div className="flex items-center gap-3">
          <FileThumb src={localPreview} image={pending.type.startsWith("image/")} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{pending.name}</p>
            <p className="text-xs text-muted">
              {formatBytes(pending.size)} · Uploading <span className="tabular-nums">{progress}%</span>
            </p>
          </div>
          <IconButton size="md" aria-label="Cancel upload" icon={<X className="h-4 w-4" />} onClick={() => abortRef.current?.()} />
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
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3 shadow-e1">
          <FileThumb src={thumb} alt={value.name} image={isImage} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{value.name}</p>
            <p className="text-xs text-muted">{formatBytes(value.size)}</p>
          </div>
          {/* Below sm the actions take their own row, so the file name keeps its width at 360px. */}
          <div className="flex w-full shrink-0 items-center justify-end gap-1 border-t border-line/70 pt-2 sm:w-auto sm:border-0 sm:pt-0">
            {!isImage && value.url && (
              <a href={value.url} target="_blank" rel="noreferrer" className={iconButtonClasses({ size: "md" })} aria-label={`View ${value.name}`}>
                <Eye className="h-4 w-4" />
              </a>
            )}
            {!disabled && (
              <>
                <IconButton size="md" aria-label="Replace file" icon={<RefreshCw className="h-4 w-4" />} onClick={() => openPicker()} />
                <IconButton size="md" aria-label="Remove file" icon={<Trash2 className="h-4 w-4" />} className="hover:bg-danger-light hover:text-danger" onClick={() => onChange(null)} />
              </>
            )}
          </div>
        </div>
        {picking && tiles && (
          <div className="mt-2 space-y-2">
            {sourceTiles}
            <button
              type="button"
              className="min-h-11 w-full rounded-md text-sm font-semibold text-muted ring-focus transition-colors duration-micro hover:text-ink focus-visible:ring-0 focus-visible:ring-offset-0 motion-reduce:transition-none"
              onClick={() => setPicking(false)}
            >
              Keep the current file
            </button>
          </div>
        )}
        {error && <UploadError>{error}</UploadError>}
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
        <p className="mt-2 text-xs text-muted">{hintText}</p>
        {error && <UploadError>{error}</UploadError>}
        {hiddenInputs}
      </div>
    );
  }

  return (
    <div className={className}>
      {hiddenInputs}
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
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition duration-micro tap-highlight-none motion-reduce:transition-none",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-orange peer-focus-visible:ring-offset-2",
          drag ? "border-orange bg-orange-light/50" : "border-line bg-surface/70 hover:border-navy/40 hover:bg-surface active:bg-lavender/60",
          disabled && "pointer-events-none cursor-not-allowed opacity-60"
        )}
      >
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-micro motion-reduce:transition-none",
            drag ? "bg-orange text-white" : "bg-lavender text-navy"
          )}
          aria-hidden
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
        </span>
        <span className="text-sm font-semibold text-ink">{busy ? "Uploading…" : drag ? "Drop the file to upload" : label}</span>
        <span className="text-xs text-muted">{hintText}</span>
      </label>
      {error && <UploadError>{error}</UploadError>}
    </div>
  );
}

/** Simple chip list for multi-value text (skills, languages); wears the shared control chrome. */
export function TagInput({ value, onChange, placeholder = "Type and press Enter", className }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; className?: string }) {
  const [text, setText] = React.useState("");
  const add = () => {
    const t = text.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setText("");
  };
  return (
    <div
      className={cn(
        "flex min-h-11 sm:min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1.5 transition-colors duration-micro focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/20 motion-reduce:transition-none",
        className
      )}
    >
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-lavender px-2.5 py-0.5 text-xs font-semibold text-navy">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
            className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full tap-highlight-none ring-focus transition-colors duration-micro hover:bg-navy/10 hover:text-orange focus-visible:ring-0 focus-visible:ring-offset-0 pointer-coarse:-my-1.5 pointer-coarse:h-8 pointer-coarse:w-8 motion-reduce:transition-none"
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
        className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-base sm:text-sm text-ink outline-none placeholder:text-muted/70"
      />
    </div>
  );
}
