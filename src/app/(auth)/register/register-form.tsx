"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Field, FormGrid } from "@/components/ui/form";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PasswordInput, PasswordRules } from "@/components/shared/password-input";
import { api, ApiClientError } from "@/lib/api-client";
import { AuthCard } from "../auth-card";

export function RegisterForm({ open }: { open: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "", confirmPassword: "", acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  // Live confirmation, so the mismatch is caught while the second field is being typed rather than
  // after a round trip. The submit-time guard below still stands.
  const confirmTouched = form.confirmPassword.length > 0;
  const confirmMatches = confirmTouched && form.password === form.confirmPassword;

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
    <AuthCard
      size="lg"
      eyebrow="Student Registration"
      title="Create your student account"
      description="Takes two minutes. You will complete your full profile after logging in."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="ring-focus rounded-xs font-semibold text-orange hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {!open ? (
        // A closed intake is a real state, not an error: say when to come back and give a way through.
        <EmptyState
          bare
          icon={<CalendarClock className="h-7 w-7" aria-hidden />}
          title="Registration is closed right now"
          description="New student accounts are paused for the moment. Please check back soon — or contact the Foundation and we will let you know when intake reopens."
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/contact" variant="navy">
                Contact the Foundation
              </ButtonLink>
              <ButtonLink href="/courses" variant="outline">
                Browse courses
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <>
          {error && (
            <Alert tone="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Full name" htmlFor="name" required error={errors.name}>
              <Input id="name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} required />
            </Field>

            <FormGrid>
              <Field label="Mobile number" htmlFor="mobile" required error={errors.mobile} hint="10-digit Indian mobile. Used for login and updates.">
                <Input
                  id="mobile"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98XXXXXXXX"
                  value={form.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                  invalid={!!errors.mobile}
                  required
                />
              </Field>
              <Field label="Email (optional)" htmlFor="email" error={errors.email}>
                <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
              </Field>
            </FormGrid>

            {/*
             * The password pair stays full width: each field carries guidance underneath, and two
             * columns of it reads as noise on a phone and as a wall on a laptop.
             */}
            <Field label="Password" htmlFor="password" required error={errors.password} hint={<PasswordRules value={form.password} />}>
              <PasswordInput
                id="password"
                hideIcon
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                invalid={!!errors.password}
                required
              />
            </Field>

            <Field
              label="Confirm password"
              htmlFor="confirmPassword"
              required
              error={errors.confirmPassword}
              success={confirmMatches ? "Passwords match" : undefined}
            >
              <PasswordInput
                id="confirmPassword"
                hideIcon
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                invalid={!!errors.confirmPassword || (confirmTouched && !confirmMatches)}
                valid={confirmMatches}
                required
              />
            </Field>

            <Field error={errors.acceptTerms}>
              <Checkbox
                checked={form.acceptTerms}
                onChange={(e) => set("acceptTerms", e.target.checked)}
                label={
                  <>
                    I agree to the{" "}
                    <Link href="/terms" className="text-orange hover:underline" target="_blank">
                      Terms &amp; Conditions
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
    </AuthCard>
  );
}
