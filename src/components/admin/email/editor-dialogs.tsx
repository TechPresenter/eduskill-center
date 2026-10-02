"use client";

import * as React from "react";
import { ImagePlus, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, FormGrid } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/tabs";
import { ProgressBar } from "@/components/ui/stats";
import { Alert } from "@/components/ui/feedback";
import { formatBytes } from "@/lib/utils";
import { safeImageUrl, safeLinkUrl, uploadEmailImage } from "@/components/admin/email/html-tools";

/*
 * The rich-text editor's insert dialogs (link, image, table, button). Each is a `Modal` — a bottom
 * sheet on phones, a centred dialog from `sm` — so focus is trapped, Escape closes it and focus
 * returns to the toolbar. The parent remounts a dialog (via `key`) every time it opens, so each one
 * starts from its `initial` props without effects.
 */

const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
];

export type BlockAlign = "left" | "center" | "right";

function DialogFooter({ formId, onClose, submitLabel, busy, extra }: { formId: string; onClose: () => void; submitLabel: string; busy?: boolean; extra?: React.ReactNode }) {
  return (
    <>
      {extra}
      <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" form={formId} loading={busy}>
        {submitLabel}
      </Button>
    </>
  );
}

/* ───────────── Link ───────────── */

export interface LinkValue {
  url: string;
  text: string;
}

export function LinkDialog({ open, onClose, initial, editing, onSubmit, onRemove }: { open: boolean; onClose: () => void; initial: LinkValue; editing: boolean; onSubmit: (v: LinkValue) => void; onRemove?: () => void }) {
  const formId = React.useId();
  const [url, setUrl] = React.useState(initial.url);
  const [text, setText] = React.useState(initial.text);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const safe = safeLinkUrl(url);
    if (!safe) {
      setError("Enter an https:// web address or an email address (mailto:).");
      return;
    }
    onSubmit({ url: safe, text: text.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={editing ? "Edit link" : "Insert link"}
      initialFocus="first"
      footer={
        <DialogFooter
          formId={formId}
          onClose={onClose}
          submitLabel={editing ? "Update link" : "Insert link"}
          extra={
            editing && onRemove ? (
              <Button type="button" variant="ghost" leftIcon={<Unlink className="h-4 w-4" />} onClick={onRemove} className="sm:mr-auto">
                Remove link
              </Button>
            ) : undefined
          }
        />
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Web address or email" required error={error} hint="https:// links and mailto: addresses only.">
          <Input
            type="text"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="https://eduskillindia.com/courses"
            leftIcon={<Link2 className="h-4 w-4" />}
          />
        </Field>
        <Field label="Text to show" hint="Leave empty to use the selected text, or the address itself.">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
        </Field>
      </form>
    </Modal>
  );
}

/* ───────────── Image ───────────── */

export interface ImageValue {
  src: string;
  alt: string;
  width: number | null;
  align: BlockAlign;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_MAX_MB = 5;

export function ImageDialog({ open, onClose, initialFile, onSubmit }: { open: boolean; onClose: () => void; initialFile?: File | null; onSubmit: (v: ImageValue) => void }) {
  const formId = React.useId();
  const fileInputId = React.useId();
  const [mode, setMode] = React.useState<"upload" | "url">("upload");
  const [file, setFile] = React.useState<File | null>(initialFile ?? null);
  const [url, setUrl] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [width, setWidth] = React.useState("");
  const [align, setAlign] = React.useState<BlockAlign>("center");
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);

  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const pickFile = (f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Choose a PNG, JPG or WebP image.");
      return;
    }
    if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
      setError(`Images can be at most ${IMAGE_MAX_MB} MB.`);
      return;
    }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const w = width.trim() ? Number.parseInt(width, 10) : null;
    if (w !== null && (!Number.isFinite(w) || w < 16 || w > 1200)) {
      setError("Width must be between 16 and 1200 pixels, or empty for full width.");
      return;
    }
    if (mode === "url") {
      const src = safeImageUrl(url);
      if (!src) {
        setError("Enter a full https:// address of an image.");
        return;
      }
      onSubmit({ src, alt: alt.trim(), width: w, align });
      return;
    }
    if (!file) {
      setError("Choose an image to upload.");
      return;
    }
    try {
      setProgress(0);
      const src = await uploadEmailImage(file, setProgress);
      onSubmit({ src, alt: alt.trim(), width: w, align });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress(null);
    }
  };

  const busy = progress !== null && progress < 100;

  return (
    <Modal open={open} onClose={() => !busy && onClose()} size="md" title="Insert image" description="Images are linked from the website, so every mail app can load them." footer={<DialogFooter formId={formId} onClose={onClose} submitLabel={mode === "upload" ? "Upload & insert" : "Insert image"} busy={busy} />}>
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <SegmentedControl
          aria-label="Image source"
          fullWidth
          value={mode}
          onChange={(v) => {
            setMode(v as "upload" | "url");
            setError(null);
          }}
          items={[
            { value: "upload", label: "Upload" },
            { value: "url", label: "Web address" },
          ]}
        />
        {error && <Alert tone="danger">{error}</Alert>}
        {mode === "upload" ? (
          <div className="space-y-3">
            <input id={fileInputId} type="file" accept={IMAGE_TYPES.join(",")} className="peer sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            <label
              htmlFor={fileInputId}
              className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-surface/70 px-4 py-5 text-center tap-highlight-none transition-colors duration-micro peer-focus-visible:ring-2 peer-focus-visible:ring-orange peer-focus-visible:ring-offset-2 hover:border-navy/40 motion-reduce:transition-none"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview of the chosen file
                <img src={preview} alt="" className="max-h-40 max-w-full rounded-md object-contain" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-lavender text-navy" aria-hidden>
                  <ImagePlus className="h-5 w-5" />
                </span>
              )}
              <span className="text-sm font-semibold text-ink">{file ? file.name : "Choose an image"}</span>
              <span className="text-xs text-muted">{file ? formatBytes(file.size) : `PNG, JPG or WebP · up to ${IMAGE_MAX_MB} MB`}</span>
            </label>
            {progress !== null && <ProgressBar value={progress} label={`Uploading ${progress}%`} />}
          </div>
        ) : (
          <Field label="Image address" required hint="A public https:// link to a PNG, JPG, GIF or WebP image.">
            <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://eduskillindia.com/media/banner.jpg" autoComplete="off" />
          </Field>
        )}
        <Field label="Alternative text" hint="Read aloud by screen readers and shown when images are blocked.">
          <Input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="e.g. Students at the Patna training centre" />
        </Field>
        <FormGrid>
          <Field label="Width (px)" hint="Empty = full width (up to 640px).">
            <Input type="number" inputMode="numeric" min={16} max={1200} value={width} onChange={(e) => setWidth(e.target.value)} />
          </Field>
          <Field label="Alignment">
            <Select value={align} onChange={(e) => setAlign(e.target.value as BlockAlign)} options={ALIGN_OPTIONS} />
          </Field>
        </FormGrid>
      </form>
    </Modal>
  );
}

/* ───────────── Table ───────────── */

export interface TableValue {
  rows: number;
  cols: number;
  header: boolean;
}

export function TableDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (v: TableValue) => void }) {
  const formId = React.useId();
  const [rows, setRows] = React.useState("3");
  const [cols, setCols] = React.useState("2");
  const [header, setHeader] = React.useState(true);
  const [hover, setHover] = React.useState<{ r: number; c: number } | null>(null);
  const r = Math.min(20, Math.max(1, Number.parseInt(rows, 10) || 1));
  const c = Math.min(8, Math.max(1, Number.parseInt(cols, 10) || 1));
  const shownR = hover?.r ?? r;
  const shownC = hover?.c ?? c;

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Insert table" initialFocus="first" footer={<DialogFooter formId={formId} onClose={onClose} submitLabel={`Insert ${r} × ${c} table`} />}>
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ rows: r, cols: c, header });
        }}
        className="space-y-4"
        noValidate
      >
        <FormGrid>
          <Field label="Rows" hint="1 to 20">
            <Input type="number" inputMode="numeric" min={1} max={20} value={rows} onChange={(e) => setRows(e.target.value)} />
          </Field>
          <Field label="Columns" hint="1 to 8">
            <Input type="number" inputMode="numeric" min={1} max={8} value={cols} onChange={(e) => setCols(e.target.value)} />
          </Field>
        </FormGrid>
        {/* Pointer shortcut: pick a size on the grid (the number fields above stay the keyboard path). */}
        <div className="hidden sm:block" aria-hidden>
          <p className="mb-2 text-caption text-muted">
            Or pick a size: {shownR} × {shownC}
          </p>
          <div className="inline-grid grid-cols-8 gap-1" onMouseLeave={() => setHover(null)}>
            {Array.from({ length: 8 * 8 }).map((_, i) => {
              const row = Math.floor(i / 8) + 1;
              const col = (i % 8) + 1;
              const on = row <= shownR && col <= shownC;
              return (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setHover({ r: row, c: col })}
                  onClick={() => {
                    setRows(String(row));
                    setCols(String(col));
                  }}
                  className={on ? "h-5 w-5 rounded-xs border border-orange bg-orange-light" : "h-5 w-5 rounded-xs border border-line bg-white"}
                />
              );
            })}
          </div>
        </div>
        <Checkbox label="First row is a heading row" checked={header} onChange={(e) => setHeader(e.target.checked)} />
      </form>
    </Modal>
  );
}

/* ───────────── Button / call to action ───────────── */

export interface CtaValue {
  text: string;
  url: string;
  background: string;
  color: string;
  align: BlockAlign;
}

const CTA_SWATCHES = [
  { value: "#ea580c", label: "Orange" },
  { value: "#12357a", label: "Navy" },
  { value: "#15803d", label: "Green" },
  { value: "#172033", label: "Charcoal" },
];

export function CtaDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (v: CtaValue) => void }) {
  const formId = React.useId();
  const [text, setText] = React.useState("Learn more");
  const [url, setUrl] = React.useState("https://");
  const [background, setBackground] = React.useState("#ea580c");
  const [color, setColor] = React.useState("#ffffff");
  const [align, setAlign] = React.useState<BlockAlign>("left");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const safe = safeLinkUrl(url);
    if (!text.trim()) next.text = "Enter the button text";
    if (!safe) next.url = "Enter an https:// web address or an email address";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({ text: text.trim(), url: safe!, background, color, align });
  };

  return (
    <Modal open={open} onClose={onClose} size="md" title="Insert button" description="A call-to-action link styled as a button. It works in every mail app." initialFocus="first" footer={<DialogFooter formId={formId} onClose={onClose} submitLabel="Insert button" />}>
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <FormGrid>
          <Field label="Button text" required error={errors.text}>
            <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Link" required error={errors.url}>
            <Input type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
          </Field>
        </FormGrid>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">Button colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {CTA_SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setBackground(s.value)}
                aria-pressed={background === s.value}
                aria-label={s.label}
                className="ring-focus flex h-11 w-11 items-center justify-center rounded-md border border-line tap-highlight-none aria-pressed:border-ink aria-pressed:ring-2 aria-pressed:ring-ink/30"
              >
                <span className="h-7 w-7 rounded-sm" style={{ background: s.value }} aria-hidden />
              </button>
            ))}
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-sm text-ink">
              <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" />
              Custom
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-sm text-ink">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" />
              Text colour
            </label>
          </div>
        </fieldset>
        <Field label="Alignment">
          <Select value={align} onChange={(e) => setAlign(e.target.value as BlockAlign)} options={ALIGN_OPTIONS} />
        </Field>
        <div className="rounded-card border border-line bg-surface/60 p-4" style={{ textAlign: align }}>
          <p className="mb-2 text-left text-caption text-muted">Preview</p>
          <span style={{ display: "inline-block", background, color, padding: "12px 22px", borderRadius: 8, fontWeight: 600, fontSize: 15 }}>{text || "Button"}</span>
        </div>
      </form>
    </Modal>
  );
}
