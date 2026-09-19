"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Field, FormGrid } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { api, ApiClientError } from "@/lib/api-client";

export function RegisterForm({ open }: { open: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "", confirmPassword: "", acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (form.password !== form.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<{ redirect: string }>("/api/auth/register", form);
      router.replace(data.redirect);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setError(err.message);
      } else setError("Registration failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl">
      <div className="card p-6 sm:p-8">
        <div className="mb-6">
          <p className="eyebrow">Student Registration</p>
          <h1 className="mt-2 text-2xl font-extrabold">Create your student account</h1>
          <p className="mt-1 text-sm text-muted">Takes two minutes. You will complete your full profile after logging in.</p>
        </div>
        {!open ? (
          <Alert tone="warning" title="Registration is currently closed">
            Please check back soon or contact the Foundation for assistance.
          </Alert>
        ) : (
          <>
            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Full name" htmlFor="name" required error={errors.name}>
                <Input id="name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} required />
              </Field>
              <FormGrid>
                <Field label="Mobile number" htmlFor="mobile" required error={errors.mobile} hint="10-digit Indian mobile. Used for login and updates.">
                  <Input id="mobile" inputMode="numeric" autoComplete="tel" placeholder="98XXXXXXXX" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} invalid={!!errors.mobile} required />
                </Field>
                <Field label="Email (optional)" htmlFor="email" error={errors.email}>
                  <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
                </Field>
                <Field label="Password" htmlFor="password" required error={errors.password} hint="At least 8 characters with a letter and a number.">
                  <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} invalid={!!errors.password} required />
                </Field>
                <Field label="Confirm password" htmlFor="confirmPassword" required error={errors.confirmPassword}>
                  <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} invalid={!!errors.confirmPassword} required />
                </Field>
              </FormGrid>
              <Field error={errors.acceptTerms}>
                <Checkbox
                  checked={form.acceptTerms}
                  onChange={(e) => set("acceptTerms", e.target.checked)}
                  label={
                    <>
                      I agree to the{" "}
                      <Link href="/terms" className="text-orange hover:underline" target="_blank">
                        Terms & Conditions
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy-policy" className="text-orange hover:underline" target="_blank">
                        Privacy Policy
                      </Link>
                    </>
                  }
                />
              </Field>
              <Button type="submit" size="lg" fullWidth loading={loading}>
                Create account
              </Button>
            </form>
          </>
        )}
      </div>
      <p className="mt-5 text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-orange hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
