"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";

export function ChangePasswordForm() {
  const router = useRouter();
  const [form, setForm] = React.useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (form.newPassword !== form.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success("Password changed", "Other devices have been logged out.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setError(err.message);
      } else setError("Could not change the password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // 44px reveal control (the input gets extra right padding so the text never runs under it).
  const eye = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? "Hide password" : "Show password"}
      aria-pressed={show}
      className="-mr-1.5 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted tap-highlight-none transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
    >
      {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Current password" htmlFor="currentPassword" required error={errors.currentPassword}>
        <Input id="currentPassword" className="pr-12" type={show ? "text" : "password"} autoComplete="current-password" value={form.currentPassword} onChange={(e) => set("currentPassword", e.target.value)} invalid={!!errors.currentPassword} rightIcon={eye} />
      </Field>
      <Field label="New password" htmlFor="newPassword" required error={errors.newPassword} hint="At least 8 characters with a letter and a number.">
        <Input id="newPassword" className="pr-12" type={show ? "text" : "password"} autoComplete="new-password" value={form.newPassword} onChange={(e) => set("newPassword", e.target.value)} invalid={!!errors.newPassword} rightIcon={eye} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" required error={errors.confirmPassword}>
        <Input id="confirmPassword" className="pr-12" type={show ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} invalid={!!errors.confirmPassword} rightIcon={eye} />
      </Field>
      <Button type="submit" loading={busy} fullWidth>
        Update password
      </Button>
    </form>
  );
}

export function RevokeOtherSessions({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const revoke = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ revoked: number }>("/api/student/sessions/revoke-others");
      toast.success(r.revoked ? `${r.revoked} other device${r.revoked === 1 ? "" : "s"} logged out` : "No other devices were logged in");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not log out other devices", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={count === 0} leftIcon={<LogOut className="h-4 w-4" />}>
        Log out other devices{count ? ` (${count})` : ""}
      </Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={revoke} loading={busy} danger title="Log out other devices?" confirmLabel="Log them out" description="Every other browser and phone logged in to your account will be signed out. This device stays logged in." />
    </>
  );
}
