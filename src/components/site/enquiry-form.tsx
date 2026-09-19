"use client";

import * as React from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormGrid } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/feedback";
import { api, ApiClientError } from "@/lib/api-client";

const TYPES = [
  { value: "GENERAL", label: "General enquiry" },
  { value: "ADMISSION", label: "Admission / courses" },
  { value: "VOLUNTEER", label: "Volunteering / trainer" },
  { value: "PARTNERSHIP", label: "Partnership / CSR" },
  { value: "DONATION", label: "Donation" },
  { value: "OTHER", label: "Other" },
];

const empty = { name: "", email: "", mobile: "", type: "GENERAL", subject: "", message: "", website: "" };

export function EnquiryForm({ defaultType }: { defaultType?: string }) {
  const [form, setForm] = React.useState({ ...empty, type: defaultType && TYPES.some((t) => t.value === defaultType) ? defaultType : "GENERAL" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("busy");
    setError(null);
    setErrors({});
    try {
      await api.post("/api/public/enquiries", form);
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setError(err.status === 422 ? null : err.message);
      } else setError("Something went wrong. Please try again.");
    }
  };

  if (status === "done") {
    return (
      <div className="flex flex-col items-center rounded-card-lg bg-success-light px-6 py-14 text-center" role="status">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <h3 className="mt-4 text-xl font-extrabold text-navy">Thank you, {form.name.split(" ")[0]}!</h3>
        <p className="mt-2 max-w-md text-sm text-muted">We have received your message. Our team usually replies within 2 working days on the mobile number or email you shared.</p>
        <Button variant="outline" className="mt-6" onClick={() => { setForm({ ...empty }); setStatus("idle"); }}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-label="Contact form">
      {error && <Alert tone="danger">{error}</Alert>}
      <FormGrid>
        <Field label="Full name" htmlFor="enq-name" required error={errors.name}>
          <Input id="enq-name" value={form.name} onChange={set("name")} autoComplete="name" required invalid={!!errors.name} />
        </Field>
        <Field label="Mobile number" htmlFor="enq-mobile" required error={errors.mobile}>
          <Input id="enq-mobile" type="tel" inputMode="numeric" value={form.mobile} onChange={set("mobile")} autoComplete="tel" placeholder="10-digit mobile" required invalid={!!errors.mobile} />
        </Field>
        <Field label="Email" htmlFor="enq-email" error={errors.email}>
          <Input id="enq-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" invalid={!!errors.email} />
        </Field>
        <Field label="I am contacting about" htmlFor="enq-type" error={errors.type}>
          <Select id="enq-type" value={form.type} onChange={set("type")} options={TYPES} />
        </Field>
      </FormGrid>
      <Field label="Subject" htmlFor="enq-subject" error={errors.subject}>
        <Input id="enq-subject" value={form.subject} onChange={set("subject")} maxLength={200} />
      </Field>
      <Field label="Message" htmlFor="enq-message" required error={errors.message}>
        <Textarea id="enq-message" value={form.message} onChange={set("message")} rows={5} required invalid={!!errors.message} maxLength={3000} />
      </Field>
      {/* Honeypot – hidden from people, filled by bots */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="enq-website">Website</label>
        <input id="enq-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      <Button type="submit" size="lg" loading={status === "busy"} rightIcon={<Send className="h-4 w-4" />}>
        Send Message
      </Button>
    </form>
  );
}
