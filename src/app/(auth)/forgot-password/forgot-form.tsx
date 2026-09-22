"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api-client";
import { AuthCard } from "../auth-card";

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/forgot-password", { identifier });
      // The identifier is frozen at the moment of sending, so the confirmation keeps naming the
      // address the link actually went to even if the field is edited afterwards.
      setSent(identifier);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard
        eyebrow="Account recovery"
        title="Check your messages"
        description={
          <>
            If an account exists for <strong className="font-semibold text-ink">{sent}</strong>, we have sent a password reset link. It expires in 30
            minutes.
          </>
        }
        footer={
          <Link href="/login" className="ring-focus inline-flex items-center gap-1.5 rounded-xs font-semibold text-orange hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to login
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-md bg-success-light text-success-dark" aria-hidden>
            <MailCheck className="h-7 w-7" />
          </span>
          <p className="text-body text-muted">
            The link opens a page where you choose a new password. Nothing changes until you do — your current password still works.
          </p>
          {/* A dead end here means starting over: a typo in the address is the most common reason nothing arrives. */}
          <Button variant="outline" fullWidth onClick={() => setSent(null)}>
            Use a different email or mobile
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Forgot your password?"
      description="Enter your registered email or mobile number. We will send a reset link if an account exists."
      footer={
        <Link href="/login" className="ring-focus inline-flex items-center gap-1.5 rounded-xs font-semibold text-orange hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to login
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email or mobile number" htmlFor="identifier" required>
          <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
