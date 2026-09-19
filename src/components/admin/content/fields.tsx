"use client";

import * as React from "react";
import { Eye, EyeOff, Link2, X } from "lucide-react";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Field, FormGrid } from "@/components/ui/form";
import { FileUpload, TagInput } from "@/components/ui/file-upload";
import { DynamicIcon } from "@/components/ui/icon";
import { LocationCascade } from "@/components/shared/location-cascade";
import { CMS_ICONS } from "@/lib/cms/sections";
import { cn, slugify } from "@/lib/utils";
import { MarkdownPreview } from "@/components/admin/content/markdown";

export type FormValues = Record<string, unknown>;

interface Base {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Column span in the 2-column grid (default 1). */
  span?: 1 | 2;
  disabled?: boolean;
}

export type FieldDef = Base &
  (
    | { type: "text" | "url" | "email" | "number" | "date" | "datetime" }
    | { type: "textarea"; rows?: number; markdown?: boolean }
    | { type: "boolean"; description?: string }
    | { type: "select"; options: SelectOption[]; placeholder?: string }
    | { type: "image"; folder: string }
    | { type: "tags" }
    | { type: "icon" }
    /** Writes `stateId` / `districtId` / `blockId` directly onto the values object. */
    | { type: "location"; depth: "state" | "district" | "block" }
    /** Auto-derived from another field until edited by hand. */
    | { type: "slug"; from: string }
  );

export function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/** ISO/Date → value for <input type="datetime-local"> (local time). */
export function toDateTimeLocal(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO/Date → value for <input type="date">. */
export function toDateInput(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Image upload that stores only the resulting URL string. */
export function ImageField({ value, onChange, folder, disabled, hint }: { value: string; onChange: (url: string) => void; folder: string; disabled?: boolean; hint?: string }) {
  const [manual, setManual] = React.useState(false);
  if (value) {
    const fileName = value.split("/").pop() ?? "image";
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className="h-14 w-14 rounded-lg bg-surface object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{fileName}</p>
          <p className="truncate text-xs text-muted">{value}</p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange("")} className="rounded-lg p-2 text-muted hover:bg-danger-light hover:text-danger" aria-label="Remove image">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {manual ? (
        <div className="flex gap-2">
          <Input placeholder="https://… or /api/files/public/…" onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} onBlur={(e) => e.target.value.trim() && onChange(e.target.value.trim())} disabled={disabled} />
          <button type="button" onClick={() => setManual(false)} className="inline-flex min-h-11 items-center text-xs font-medium text-muted tap-highlight-none md:min-h-0 md:hover:text-navy">
            Upload instead
          </button>
        </div>
      ) : (
        <>
          <FileUpload endpoint="/api/admin/uploads" fields={{ preset: "image", folder, visibility: "public" }} accept=".jpg,.jpeg,.png,.webp" maxSizeMb={5} value={null} onChange={(f) => f && onChange(f.url)} label="Upload image" hint={hint ?? "JPG, PNG or WEBP up to 5 MB"} disabled={disabled} />
          <button type="button" onClick={() => setManual(true)} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted tap-highlight-none md:min-h-0 md:hover:text-navy">
            <Link2 className="h-3.5 w-3.5" /> Use an image URL instead
          </button>
        </>
      )}
    </div>
  );
}

export function IconPicker({ value, onChange, disabled, id }: { value: string; onChange: (v: string) => void; disabled?: boolean; id?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavender text-navy" aria-hidden>
        <DynamicIcon name={value || undefined} className="h-5 w-5" />
      </span>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} options={CMS_ICONS.map((i) => ({ value: i, label: i }))} placeholder="No icon" disabled={disabled} />
    </div>
  );
}

function MarkdownTextarea({ id, value, onChange, rows, placeholder, invalid, disabled }: { id: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; invalid?: boolean; disabled?: boolean }) {
  const [preview, setPreview] = React.useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Markdown: # headings, **bold**, *italic*, - lists, [links](https://…)</p>
        <button type="button" onClick={() => setPreview((p) => !p)} className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-navy tap-highlight-none md:min-h-0 md:hover:text-orange" aria-pressed={preview}>
          {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {preview ? "Hide preview" : "Show preview"}
        </button>
      </div>
      <div className={cn("grid gap-3", preview && "lg:grid-cols-2")}>
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows ?? 12} placeholder={placeholder} invalid={invalid} disabled={disabled} className="font-mono text-[13px]" />
        {preview && (
          <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-line bg-surface/40 p-4" aria-live="polite">
            <MarkdownPreview content={value} />
          </div>
        )}
      </div>
    </div>
  );
}

export interface FormFieldsProps {
  fields: FieldDef[];
  values: FormValues;
  onChange: (values: FormValues) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  cols?: 1 | 2;
  idPrefix?: string;
}

/** Renders a form from a field configuration. Values are kept as a flat object. */
export function FormFields({ fields, values, onChange, errors = {}, disabled, cols = 2, idPrefix = "f" }: FormFieldsProps) {
  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  return (
    <FormGrid cols={cols}>
      {fields.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const spanCls = f.span === 2 || cols === 1 ? "sm:col-span-2" : undefined;
        const err = errors[f.key];
        const dis = disabled || f.disabled;

        if (f.type === "location") {
          return (
            <div key={f.key} className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-ink">
                {f.label}
                {f.required && <span className="ml-0.5 text-danger">*</span>}
              </p>
              <LocationCascade
                depth={f.depth}
                value={{ stateId: str(values.stateId) || undefined, districtId: str(values.districtId) || undefined, blockId: str(values.blockId) || undefined }}
                onChange={(loc) => onChange({ ...values, stateId: loc.stateId ?? "", districtId: loc.districtId ?? "", blockId: loc.blockId ?? "" })}
                errors={{ stateId: errors.stateId, districtId: errors.districtId, blockId: errors.blockId }}
                disabled={dis}
                required={f.required}
                className={cn("grid gap-4", f.depth === "block" ? "sm:grid-cols-3" : f.depth === "district" ? "sm:grid-cols-2" : "")}
              />
              {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
            </div>
          );
        }

        if (f.type === "boolean") {
          return (
            <div key={f.key} className={cn("flex items-center", spanCls)}>
              <Checkbox id={id} label={f.label} description={f.description ?? f.hint} checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} disabled={dis} />
              {err && (
                <p className="ml-3 text-xs font-medium text-danger" role="alert">
                  {err}
                </p>
              )}
            </div>
          );
        }

        let control: React.ReactNode;
        switch (f.type) {
          case "textarea":
            control = f.markdown ? (
              <MarkdownTextarea id={id} value={str(values[f.key])} onChange={(v) => set(f.key, v)} rows={f.rows} placeholder={f.placeholder} invalid={!!err} disabled={dis} />
            ) : (
              <Textarea id={id} value={str(values[f.key])} onChange={(e) => set(f.key, e.target.value)} rows={f.rows ?? 4} placeholder={f.placeholder} invalid={!!err} disabled={dis} />
            );
            break;
          case "select":
            control = <Select id={id} value={str(values[f.key])} onChange={(e) => set(f.key, e.target.value)} options={f.options} placeholder={f.placeholder ?? "Select…"} invalid={!!err} disabled={dis} required={f.required} />;
            break;
          case "image":
            control = <ImageField value={str(values[f.key])} onChange={(url) => set(f.key, url)} folder={f.folder} disabled={dis} hint={f.hint} />;
            break;
          case "tags":
            control = <TagInput value={Array.isArray(values[f.key]) ? (values[f.key] as string[]) : []} onChange={(v) => set(f.key, v)} placeholder={f.placeholder ?? "Type and press Enter"} />;
            break;
          case "icon":
            control = <IconPicker id={id} value={str(values[f.key])} onChange={(v) => set(f.key, v)} disabled={dis} />;
            break;
          case "slug": {
            const current = str(values[f.key]);
            const display = current || slugify(str(values[f.from]));
            control = (
              <Input
                id={id}
                value={display}
                onChange={(e) => set(f.key, e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
                placeholder={f.placeholder ?? "auto-generated-from-title"}
                invalid={!!err}
                disabled={dis}
                className="font-mono text-[13px]"
              />
            );
            break;
          }
          case "number":
            control = <Input id={id} type="number" value={str(values[f.key])} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} invalid={!!err} disabled={dis} required={f.required} />;
            break;
          case "datetime":
            control = <Input id={id} type="datetime-local" value={str(values[f.key])} onChange={(e) => set(f.key, e.target.value)} invalid={!!err} disabled={dis} required={f.required} />;
            break;
          case "date":
            control = <Input id={id} type="date" value={str(values[f.key])} onChange={(e) => set(f.key, e.target.value)} invalid={!!err} disabled={dis} required={f.required} />;
            break;
          case "url":
          case "email":
          case "text":
          default:
            control = <Input id={id} type={f.type === "url" ? "text" : f.type} value={str(values[f.key])} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} invalid={!!err} disabled={dis} required={f.required} />;
        }

        return (
          <Field key={f.key} label={f.label} htmlFor={f.type === "image" || f.type === "tags" ? undefined : id} required={f.required} hint={f.type === "image" ? undefined : f.hint} error={err} className={cn(spanCls, (f.type === "textarea" || f.type === "image") && "sm:col-span-2")}>
            {control}
          </Field>
        );
      })}
    </FormGrid>
  );
}

/** Applies a slug field's derived value before submit (when the user never typed a slug). */
export function finalizeSlugs(fields: FieldDef[], values: FormValues): FormValues {
  const out = { ...values };
  for (const f of fields) {
    if (f.type === "slug" && !str(out[f.key])) out[f.key] = slugify(str(out[f.from]));
  }
  return out;
}
