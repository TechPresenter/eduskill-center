"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormActions, FormGrid } from "@/components/ui/form";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ImageField } from "@/components/admin/shared/image-field";

export interface SettingFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "image" | "color";
  options: { value: string; label: string }[] | null;
  help: string | null;
  secret: boolean;
  isPublic: boolean;
  defaultValue: unknown;
}

const MASK = "••••••••";

function toState(fields: SettingFieldDef[], values: Record<string, unknown>) {
  const out: Record<string, string | boolean> = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.type === "boolean") out[f.key] = v === true || v === "true";
    else out[f.key] = v === null || v === undefined ? "" : String(v);
  }
  return out;
}

export function SettingsForm({ group, groupLabel, fields, values, canUpdate, defaultTestEmail }: { group: string; groupLabel: string; fields: SettingFieldDef[]; values: Record<string, unknown>; canUpdate: boolean; defaultTestEmail: string }) {
  const router = useRouter();
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [state, setState] = React.useState(() => toState(fields, values));
  const [saved, setSaved] = React.useState(() => toState(fields, values));
  const [reveal, setReveal] = React.useState<Record<string, boolean>>({});
  const dirty = fields.some((f) => state[f.key] !== saved[f.key]);
  const set = (key: string, v: string | boolean) => {
    setState((s) => ({ ...s, [key]: v }));
    clearField(key);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const changed: Record<string, unknown> = {};
    for (const f of fields) {
      if (state[f.key] === saved[f.key]) continue;
      const v = state[f.key];
      if (f.secret && v === MASK) continue;
      changed[f.key] = f.type === "number" ? (v === "" ? "" : Number(v)) : v;
    }
    const res = await submit(() => api.put<{ values: Record<string, unknown>; changed: string[] }>("/api/admin/settings", { values: changed }), { silent: true });
    if (!res) return;
    const next = toState(fields, res.values);
    setState(next);
    setSaved(next);
    setReveal({});
    toast.success("Settings saved", res.changed.length ? `${res.changed.length} setting${res.changed.length === 1 ? "" : "s"} updated.` : "Nothing changed.");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
      {!canUpdate && <Alert tone="info">You can view these settings but need the “Edit Settings” permission to change them.</Alert>}
      <FormGrid>
        {fields.map((f) => {
          const id = `set-${f.key.replace(/\./g, "-")}`;
          const value = state[f.key];
          const label = (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {f.label}
              {f.isPublic && (
                <Badge tone="info" className="text-caption">
                  Public
                </Badge>
              )}
              {f.secret && (
                <Badge tone="warning" className="text-caption">
                  Secret
                </Badge>
              )}
            </span>
          );
          const wide = f.type === "textarea" || f.type === "image";
          if (f.type === "boolean") {
            return (
              <div key={f.key} className="flex items-start pt-1 sm:col-span-2">
                <Checkbox id={id} checked={value === true} onChange={(e) => set(f.key, e.target.checked)} disabled={!canUpdate || loading} label={label} description={f.help ?? undefined} />
              </div>
            );
          }
          return (
            <Field key={f.key} label={label} htmlFor={id} error={fieldErrors[f.key]} hint={f.help ?? undefined} className={wide ? "sm:col-span-2" : undefined}>
              {f.type === "textarea" ? (
                <Textarea id={id} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} rows={3} disabled={!canUpdate || loading} invalid={!!fieldErrors[f.key]} />
              ) : f.type === "select" ? (
                <Select id={id} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} options={f.options ?? []} disabled={!canUpdate || loading} invalid={!!fieldErrors[f.key]} />
              ) : f.type === "image" ? (
                <ImageField value={String(value ?? "")} onChange={(url) => set(f.key, url)} folder={`settings/${group}`} disabled={!canUpdate || loading} />
              ) : f.type === "number" ? (
                <Input id={id} type="number" value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} disabled={!canUpdate || loading} invalid={!!fieldErrors[f.key]} />
              ) : f.type === "color" ? (
                <div className="flex items-center gap-2">
                  <input type="color" aria-label={`${f.label} colour`} value={/^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#000000"} onChange={(e) => set(f.key, e.target.value)} disabled={!canUpdate || loading} className="h-11 w-14 rounded-lg border border-line" />
                  <Input id={id} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} disabled={!canUpdate || loading} invalid={!!fieldErrors[f.key]} className="font-mono" />
                </div>
              ) : f.secret ? (
                <div className="flex gap-2">
                  <Input
                    id={id}
                    type={reveal[f.key] ? "text" : "password"}
                    value={String(value ?? "")}
                    onChange={(e) => set(f.key, e.target.value)}
                    onFocus={() => {
                      if (value === MASK) set(f.key, "");
                    }}
                    placeholder={saved[f.key] === MASK ? "Stored – type to replace" : "Not set"}
                    disabled={!canUpdate || loading}
                    invalid={!!fieldErrors[f.key]}
                    autoComplete="off"
                  />
                  <Button type="button" variant="outline" size="md" onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))} aria-label={reveal[f.key] ? "Hide value" : "Show value"}>
                    {reveal[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {saved[f.key] === MASK && value !== MASK && (
                    <Button type="button" variant="ghost" size="md" onClick={() => set(f.key, MASK)} aria-label="Keep stored value">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <Input id={id} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} disabled={!canUpdate || loading} invalid={!!fieldErrors[f.key]} />
              )}
            </Field>
          );
        })}
      </FormGrid>
      {canUpdate && (
        <FormActions>
          {group === "comms" && <TestEmailButton defaultTo={defaultTestEmail} disabled={dirty} />}
          <Button type="button" variant="outline" onClick={() => setState(saved)} disabled={!dirty || loading}>
            Discard changes
          </Button>
          <Button type="submit" loading={loading} disabled={!dirty}>
            Save {groupLabel.toLowerCase()} settings
          </Button>
        </FormActions>
      )}
    </form>
  );
}

function TestEmailButton({ defaultTo, disabled }: { defaultTo: string; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState(defaultTo);
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await submit(() => api.post<{ sent: boolean; to: string }>("/api/admin/settings/test-email", { to }), { silent: true });
    if (res) {
      toast.success("Test email sent", `Check the inbox of ${res.to}.`);
      setOpen(false);
    }
  };
  return (
    <>
      <Button type="button" variant="outline" leftIcon={<Mail className="h-4 w-4" />} onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Save your changes first" : "Send a test email with the saved SMTP settings"} className="sm:mr-auto">
        Send test email
      </Button>
      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Send a test email" description="Uses the saved SMTP settings. Email notifications must be enabled." size="sm">
        <form onSubmit={send} className="space-y-4" noValidate>
          {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}
          <Field label="Send to" htmlFor="test-email-to" required error={fieldErrors.to}>
            <Input id="test-email-to" type="email" value={to} onChange={(e) => { setTo(e.target.value); clearField("to"); }} required invalid={!!fieldErrors.to} />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Send
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
