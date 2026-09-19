"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { Highlight } from "@/components/ui/highlight";
import { toast } from "@/components/ui/toast";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import type { CmsAnyField, CmsField } from "@/lib/cms/sections";
import { ImageField, IconPicker, str } from "@/components/admin/content/fields";

interface SectionEditorProps {
  section: { key: string; name: string; page: string; description: string; fields: CmsAnyField[]; defaults: Record<string, unknown>; data: Record<string, unknown>; customised: boolean; updatedAt: string | Date | null };
  canEdit: boolean;
}

function ScalarField({ field, value, onChange, error, disabled, id }: { field: CmsField; value: unknown; onChange: (v: unknown) => void; error?: string; disabled?: boolean; id: string }) {
  switch (field.type) {
    case "boolean":
      return <Checkbox id={id} label={field.label} description={field.help} checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />;
    case "textarea": {
      const text = str(value);
      return (
        <Field label={field.label} htmlFor={id} hint={field.help} error={error}>
          <Textarea id={id} value={text} onChange={(e) => onChange(e.target.value)} rows={3} invalid={!!error} disabled={disabled} />
          {/\[\[.+?\]\]/.test(text) && (
            <p className="rounded-lg bg-surface px-3 py-2 text-sm text-navy">
              Preview: <Highlight text={text} className="font-semibold" />
            </p>
          )}
        </Field>
      );
    }
    case "image":
      return (
        <Field label={field.label} hint={field.help} error={error}>
          <ImageField value={str(value)} onChange={onChange} folder="cms" disabled={disabled} />
        </Field>
      );
    case "icon":
      return (
        <Field label={field.label} htmlFor={id} hint={field.help} error={error}>
          <IconPicker id={id} value={str(value)} onChange={onChange} disabled={disabled} />
        </Field>
      );
    case "number":
      return (
        <Field label={field.label} htmlFor={id} hint={field.help} error={error}>
          <Input id={id} type="number" value={str(value)} onChange={(e) => onChange(e.target.value)} invalid={!!error} disabled={disabled} />
        </Field>
      );
    case "url":
    case "text":
    default:
      return (
        <Field label={field.label} htmlFor={id} hint={field.help} error={error}>
          <Input id={id} value={str(value)} onChange={(e) => onChange(e.target.value)} invalid={!!error} disabled={disabled} placeholder={field.type === "url" ? "/page or https://…" : undefined} />
        </Field>
      );
  }
}

export function SectionEditor({ section, canEdit }: SectionEditorProps) {
  const router = useRouter();
  const [data, setData] = React.useState<Record<string, unknown>>(section.data);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const update = (key: string, v: unknown) => {
    setData((d) => ({ ...d, [key]: v }));
    setDirty(true);
  };

  const listOf = (key: string): Record<string, unknown>[] => (Array.isArray(data[key]) ? (data[key] as Record<string, unknown>[]) : []);
  const setList = (key: string, items: Record<string, unknown>[]) => update(key, items);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await api.put<{ data: Record<string, unknown> }>(`/api/admin/cms/sections/${encodeURIComponent(section.key)}`, data);
      setData(res.data);
      setDirty(false);
      toast.success("Section saved", "The website reflects your changes immediately.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const res = await api.delete<{ data: Record<string, unknown> }>(`/api/admin/cms/sections/${encodeURIComponent(section.key)}`);
      setData(res.data);
      setDirty(false);
      setConfirmReset(false);
      toast.success("Section reset to defaults");
      router.refresh();
    } catch (err) {
      toast.error("Could not reset", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      {!canEdit && <Alert tone="info">You can view this section but need the &ldquo;Edit Website Content&rdquo; permission to change it.</Alert>}

      <div className="card space-y-5 p-5">
        {section.fields.map((field) => {
          if (field.type !== "list") {
            return <ScalarField key={field.key} id={`s-${field.key}`} field={field} value={data[field.key]} onChange={(v) => update(field.key, v)} error={errors[field.key]} disabled={!canEdit || saving} />;
          }
          const items = listOf(field.key);
          const canAdd = !field.max || items.length < field.max;
          return (
            <fieldset key={field.key} className="space-y-3 rounded-xl border border-line p-4">
              <legend className="px-1 text-sm font-semibold text-navy">
                {field.label} <span className="font-normal text-muted">({items.length}{field.max ? ` of ${field.max}` : ""})</span>
              </legend>
              {errors[field.key] && (
                <p className="text-xs font-medium text-danger" role="alert">
                  {errors[field.key]}
                </p>
              )}
              {items.length === 0 && <p className="text-sm text-muted">No items yet.</p>}
              {items.map((item, i) => (
                <div key={i} className="rounded-xl bg-surface/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold tracking-wide text-muted uppercase">Item {i + 1}</p>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button type="button" disabled={i === 0} onClick={() => setList(field.key, swap(items, i, i - 1))} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted tap-highlight-none md:h-8 md:w-8 hover:bg-white hover:text-navy disabled:opacity-30" aria-label="Move up">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" disabled={i === items.length - 1} onClick={() => setList(field.key, swap(items, i, i + 1))} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted tap-highlight-none md:h-8 md:w-8 hover:bg-white hover:text-navy disabled:opacity-30" aria-label="Move down">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setList(field.key, items.filter((_, j) => j !== i))} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted tap-highlight-none md:h-8 md:w-8 hover:bg-danger-light hover:text-danger" aria-label="Remove item">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {field.itemFields.map((f) => (
                      <div key={f.key} className={f.type === "textarea" || f.type === "image" ? "sm:col-span-2" : undefined}>
                        <ScalarField
                          id={`s-${field.key}-${i}-${f.key}`}
                          field={f}
                          value={item[f.key]}
                          onChange={(v) => setList(field.key, items.map((it, j) => (j === i ? { ...it, [f.key]: v } : it)))}
                          error={errors[`${field.key}.${i}.${f.key}`]}
                          disabled={!canEdit || saving}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {canEdit && (
                <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={() => setList(field.key, [...items, Object.fromEntries(field.itemFields.map((f) => [f.key, f.type === "boolean" ? false : f.type === "number" ? 0 : ""]))])} leftIcon={<Plus className="h-4 w-4" />} className="w-full sm:w-auto">
                  Add item
                </Button>
              )}
            </fieldset>
          );
        })}
      </div>

      <div className="space-y-2 lg:hidden">
        <p className="text-xs text-muted">
          {section.customised ? `Customised · last saved ${formatDateTime(section.updatedAt)}` : "Using built-in defaults"}
          {dirty && <span className="ml-2 font-semibold text-orange">Unsaved changes</span>}
        </p>
        {canEdit && (
          <Button type="button" variant="outline" onClick={() => setConfirmReset(true)} disabled={saving || !section.customised} leftIcon={<RotateCcw className="h-4 w-4" />} className="w-full">
            Reset to defaults
          </Button>
        )}
      </div>

      <StickyActionBar innerClassName="lg:justify-between">
        <p className="hidden text-xs text-muted lg:block">
          {section.customised ? `Customised · last saved ${formatDateTime(section.updatedAt)}` : "Using built-in defaults"}
          {dirty && <span className="ml-2 font-semibold text-orange">Unsaved changes</span>}
        </p>
        <div className="flex w-full items-center gap-2 lg:w-auto lg:flex-wrap">
          <Link href="/admin/cms/sections" className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink tap-highlight-none lg:h-11 lg:flex-none hover:bg-surface">
            Back
          </Link>
          {canEdit && (
            <>
              <Button type="button" variant="outline" onClick={() => setConfirmReset(true)} disabled={saving || !section.customised} leftIcon={<RotateCcw className="h-4 w-4" />} className="hidden lg:inline-flex">
                Reset to defaults
              </Button>
              <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />} className="flex-2 lg:flex-none">
                Save section
              </Button>
            </>
          )}
        </div>
      </StickyActionBar>

      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={reset} title="Reset this section?" description={`All customised text and images in "${section.name}" will be replaced by the built-in defaults. This cannot be undone.`} confirmLabel="Reset" danger loading={saving} />
    </form>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  if (b < 0 || b >= arr.length) return arr;
  const out = [...arr];
  [out[a], out[b]] = [out[b]!, out[a]!];
  return out;
}
