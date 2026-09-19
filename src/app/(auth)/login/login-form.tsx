"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { api, ApiClientError } from "@/lib/api-client";

export function LoginForm({ next, registered, reset }: { next?: string; registered?: boolean; reset?: boolean }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
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
    <div className="w-full max-w-md">
      <div className="card p-6 sm:p-8">
        <div className="mb-6">
          <p className="eyebrow">Welcome back</p>
          <h1 className="mt-2 text-2xl font-extrabold">Log in to your account</h1>
          <p className="mt-1 text-sm text-muted">Students, volunteer trainers and Foundation staff use the same login.</p>
        </div>
        {registered && <Alert tone="success" className="mb-4">Registration successful. Please log in.</Alert>}
        {reset && <Alert tone="success" className="mb-4">Password updated. Please log in with your new password.</Alert>}
        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email or mobile number" htmlFor="identifier" required error={fieldErrors.identifier}>
            <Input id="identifier" name="identifier" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} leftIcon={<User className="h-4 w-4" />} invalid={!!fieldErrors.identifier} required />
          </Field>
          <Field label="Password" htmlFor="password" required error={fieldErrors.password}>
            <Input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="rounded p-1 hover:text-navy">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              invalid={!!fieldErrors.password}
              required
            />
          </Field>
          <div className="flex items-center justify-between">
            <Checkbox label="Keep me logged in" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <Link href="/forgot-password" className="text-sm font-medium text-orange hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Log in
          </Button>
        </form>
      </div>
      <p className="mt-5 text-center text-sm text-muted">
        New student?{" "}
        <Link href="/register" className="font-semibold text-orange hover:underline">
          Create an account
        </Link>
        <span className="mx-2 text-line">|</span>
        <Link href="/become-a-trainer" className="font-semibold text-navy hover:underline">
          Become a trainer
        </Link>
      </p>
    </div>
  );
}
