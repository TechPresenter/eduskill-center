"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormActions } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

function PasswordInput({ id, value, onChange, invalid, autoComplete }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoComplete: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <Input
      id={id}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      invalid={invalid}
      autoComplete={autoComplete}
      maxLength={200}
      rightIcon={
        <button type="button" onClick={() => setShow((s) => !s)} className="pointer-events-auto rounded-md p-1 text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrent] = React.useState("");
  const [newPassword, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!currentPassword) local.currentPassword = "Enter your current password";
    if (newPassword.length < 8) local.newPassword = "Password must be at least 8 characters";
    if (confirm !== newPassword) local.confirm = "Passwords do not match";
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      toast.success("Password changed", "All other devices have been logged out.");
      setCurrent("");
      setNext("");
      setConfirm("");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) toast.error("Could not change password", err.message);
      } else toast.error("Could not change password", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Current password" htmlFor="pw-current" required error={errors.currentPassword}>
        <PasswordInput id="pw-current" value={currentPassword} onChange={setCurrent} invalid={!!errors.currentPassword} autoComplete="current-password" />
      </Field>
      <Field label="New password" htmlFor="pw-new" required error={errors.newPassword} hint="At least 8 characters. Use a mix of letters, numbers and symbols.">
        <PasswordInput id="pw-new" value={newPassword} onChange={setNext} invalid={!!errors.newPassword} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-confirm" required error={errors.confirm}>
        <PasswordInput id="pw-confirm" value={confirm} onChange={setConfirm} invalid={!!errors.confirm} autoComplete="new-password" />
      </Field>
      <FormActions>
        <Button type="submit" loading={saving} fullWidth>
          Update password
        </Button>
      </FormActions>
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
      const r = await api.post<{ revoked: number }>("/api/trainer/sessions/revoke-others");
      toast.success(r.revoked ? `Logged out ${r.revoked} other device${r.revoked === 1 ? "" : "s"}` : "No other devices were logged in");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error("Could not log out other devices", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={count === 0} leftIcon={<LogOut className="h-4 w-4" />}>
        Log out other devices{count ? ` (${count})` : ""}
      </Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={revoke} loading={busy} title="Log out other devices?" description={`This ends ${count} other active session${count === 1 ? "" : "s"}. You stay logged in on this device.`} confirmLabel="Log out others" danger />
    </>
  );
}
