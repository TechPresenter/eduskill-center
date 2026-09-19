"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { api, ApiClientError } from "@/lib/api-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    return (
      <div className="w-full max-w-md">
        <Alert tone="danger" title="Invalid link">
          This password reset link is missing its token.{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
          .
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-2 text-2xl font-extrabold">Set a new password</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Choose a strong password with at least 8 characters, including a letter and a number.</p>
        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="New password" htmlFor="password" required error={errors.password}>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} required />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm" required error={errors.confirm}>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={!!errors.confirm} required />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
