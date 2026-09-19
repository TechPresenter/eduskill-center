"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { ConfirmAction } from "@/components/admin/shared/confirm-action";

export function ChangePasswordForm() {
  const router = useRouter();
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [currentPassword, setCurrent] = React.useState("");
  const [newPassword, setNew] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (newPassword !== confirm) {
      setLocalError("The new passwords do not match.");
      return;
    }
    const res = await submit(() => api.post<{ message: string }>("/api/auth/change-password", { currentPassword, newPassword }), { silent: true });
    if (res) {
      toast.success("Password changed", "Other devices have been signed out.");
      setCurrent("");
      setNew("");
      setConfirm("");
      router.refresh();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {(error && Object.keys(fieldErrors).length === 0) || localError ? <Alert tone="danger">{localError ?? error}</Alert> : null}
      <Field label="Current password" htmlFor="cp-current" required error={fieldErrors.currentPassword}>
        <Input id="cp-current" type="password" value={currentPassword} onChange={(e) => { setCurrent(e.target.value); clearField("currentPassword"); }} required autoComplete="current-password" invalid={!!fieldErrors.currentPassword} />
      </Field>
      <Field label="New password" htmlFor="cp-new" required error={fieldErrors.newPassword} hint="At least 8 characters with a letter and a number.">
        <Input id="cp-new" type="password" value={newPassword} onChange={(e) => { setNew(e.target.value); clearField("newPassword"); }} required minLength={8} autoComplete="new-password" invalid={!!fieldErrors.newPassword} />
      </Field>
      <Field label="Confirm new password" htmlFor="cp-confirm" required error={confirm && confirm !== newPassword ? "Passwords do not match" : undefined}>
        <Input id="cp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" invalid={!!confirm && confirm !== newPassword} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={loading} leftIcon={<KeyRound className="h-4 w-4" />} disabled={!currentPassword || !newPassword || !confirm}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function RevokeOtherSessionsButton({ count }: { count: number }) {
  return (
    <ConfirmAction method="post" url="/api/admin/account/revoke-sessions" title="Log out other devices?" description={`${count} other active session${count === 1 ? "" : "s"} will be ended. This device stays signed in.`} confirmLabel="Log out others" successMessage="Other devices logged out" variant="outline" size="sm" icon={<LogOut className="h-4 w-4" />} disabled={count === 0}>
      Log out other devices
    </ConfirmAction>
  );
}
