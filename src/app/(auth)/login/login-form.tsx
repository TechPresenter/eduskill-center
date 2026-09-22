"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { PasswordInput } from "@/components/shared/password-input";
import { api, ApiClientError } from "@/lib/api-client";
import { AuthCard, AuthCardLinkSeparator } from "../auth-card";

export function LoginForm({ next, registered, reset }: { next?: string; registered?: boolean; reset?: boolean }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const data = await api.post<{ redirect: string }>("/api/auth/login", { identifier, password, remember, next });
      router.replace(data.redirect);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFieldErrors(err.fieldErrors);
        setError(err.message);
      } else setError("Unable to log in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Log in to your account"
      description="Students, volunteer trainers and Foundation staff use the same login."
      footer={
        <>
          New student?{" "}
          <Link href="/register" className="ring-focus rounded-xs font-semibold text-orange hover:underline">
            Create an account
          </Link>
          <AuthCardLinkSeparator />
          <Link href="/become-a-trainer" className="ring-focus rounded-xs font-semibold text-navy hover:underline">
            Become a trainer
          </Link>
        </>
      }
    >
      {/*
       * Arrival messages come first and are announced: someone who has just registered or just reset
       * their password needs to know it worked before they are asked to type again.
       */}
      {registered && (
        <Alert tone="success" className="mb-4">
          Registration successful. Please log in.
        </Alert>
      )}
      {reset && (
        <Alert tone="success" className="mb-4">
          Password updated. Please log in with your new password.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email or mobile number" htmlFor="identifier" required error={fieldErrors.identifier}>
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            leftIcon={<User className="h-4 w-4" />}
            invalid={!!fieldErrors.identifier}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password" required error={fieldErrors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!fieldErrors.password}
            required
          />
        </Field>

        {/* Wraps to two rows on the narrowest phones rather than squeezing either target. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <Checkbox label="Keep me logged in" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link
            href="/forgot-password"
            className="text-body-sm ring-focus inline-flex h-11 items-center rounded-md font-semibold text-orange hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
