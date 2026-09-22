"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";

const CATEGORIES = ["Application", "Documents", "Fees & payments", "Classes & attendance", "Certificate", "Account & login", "Other"];

/** Matches a `?topic=` value to a known category (case-insensitive, ignores separators). */
function matchCategory(topic: string | undefined): string {
  if (!topic) return "";
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  return CATEGORIES.find((c) => norm(c) === norm(topic)) ?? "";
}

export function TicketForm({ topic }: { topic?: string } = {}) {
  const router = useRouter();
  const prefillCategory = matchCategory(topic);
  const [form, setForm] = React.useState({ subject: topic && !prefillCategory ? topic : prefillCategory, category: prefillCategory, message: "", priority: "MEDIUM" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const t = await api.post<{ id: string; ticketNo: string }>("/api/student/support", { ...form, category: form.category || null });
      toast.success("Ticket created", `${t.ticketNo} – we will get back to you soon.`);
      router.push(`/student/support/${t.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setError(err.message);
      } else setError("Could not create the ticket. Please try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Subject" htmlFor="subject" required error={errors.subject}>
        <Input id="subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} invalid={!!errors.subject} maxLength={200} placeholder="What do you need help with?" />
      </Field>
      <Field label="Category" htmlFor="category" error={errors.category}>
        <Select id="category" value={form.category} onChange={(e) => set("category", e.target.value)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Select a category" />
      </Field>
      <Field label="Describe your issue" htmlFor="message" required error={errors.message}>
        <Textarea id="message" rows={5} value={form.message} onChange={(e) => set("message", e.target.value)} invalid={!!errors.message} maxLength={5000} placeholder="Include your application number if relevant." />
      </Field>

      {/* Priority is rarely changed – kept behind a disclosure so the phone form stays short. */}
      <div className="lg:hidden">
        {moreOpen ? (
          <Field label="Priority" htmlFor="priority" error={errors.priority}>
            <Select id="priority" value={form.priority} onChange={(e) => set("priority", e.target.value)} options={[{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High – urgent" }]} />
          </Field>
        ) : (
          <button type="button" onClick={() => setMoreOpen(true)} className="inline-flex min-h-11 items-center text-body-sm font-semibold text-navy underline">
            More options (priority)
          </button>
        )}
      </div>
      <div className="hidden lg:block">
        <Field label="Priority" htmlFor="priority-desktop" error={errors.priority}>
          <Select id="priority-desktop" value={form.priority} onChange={(e) => set("priority", e.target.value)} options={[{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High – urgent" }]} />
        </Field>
      </div>

      <Button type="submit" loading={busy} fullWidth>
        Send ticket
      </Button>
    </form>
  );
}
