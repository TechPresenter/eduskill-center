"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Unlink } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PasswordInput, PasswordRules } from "@/components/shared/password-input";
import { api, ApiClientError } from "@/lib/api-client";
import { AuthCard } from "../auth-card";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmTouched = confirm.length > 0;
  const confirmMatches = confirmTouched && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (password !== confirm) {
      setErrors({ confirm: "Passwords do not match" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", { token, password });
      router.replace("/login?reset=1");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setError(err.message);
      } else setError("Unable to reset password.");
      setLoading(false);
    }
  };

  if (!token) {
    // A broken link is the most likely way anyone reaches this screen — a mail client that clipped
    // the URL. Say what happened and offer the one action that fixes it.
    return (
      <AuthCard eyebrow="Account recovery" title="That reset link is incomplete">
        <EmptyState
          bare
          icon={<Unlink className="h-7 w-7" aria-hidden />}
          title="The link is missing its security token"
          description="It was probably shortened or cut off by your email or messaging app. Request a fresh link and open it directly from the message."
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/forgot-password">Request a new link</ButtonLink>
              <ButtonLink href="/login" variant="outline">
                Back to login
              </ButtonLink>
            </div>
          }
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Set a new password"
      description="Choose something you will remember. Any device still signed in to this account will be signed out."
      footer={
        <Link href="/login" className="ring-focus rounded-xs font-semibold text-orange hover:underline">
          Back to login
        </Link>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password" required error={errors.password} hint={<PasswordRules value={password} />}>
          <PasswordInput
            id="password"
            hideIcon
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!errors.password}
            required
          />
        </Field>

        <Field label="Confirm new password" htmlFor="confirm" required error={errors.confirm} success={confirmMatches ? "Passwords match" : undefined}>
          <PasswordInput
            id="confirm"
            hideIcon
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={!!errors.confirm || (confirmTouched && !confirmMatches)}
            valid={confirmMatches}
            required
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
