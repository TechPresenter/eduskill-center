"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/forgot-password", { identifier });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-2 text-2xl font-extrabold">Forgot your password?</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Enter your registered email or mobile number. We will send a reset link if an account exists.</p>
        {done ? (
          <Alert tone="success" title="Check your messages">
            If an account exists for <strong>{identifier}</strong>, a password reset link has been sent. The link expires in 30 minutes.
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Email or mobile number" htmlFor="identifier" required>
              <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
            </Field>
            <Button type="submit" size="lg" fullWidth loading={loading}>
              Send reset link
            </Button>
          </form>
        )}
      </div>
      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-orange hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
