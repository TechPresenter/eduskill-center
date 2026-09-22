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
import { cn } from "@/lib/utils";

/**
 * The password rule, mirrored from the server so the student is told what is wrong BEFORE a round
 * trip instead of after a 422. Returns the unmet requirements, so the UI can show which ones are
 * still outstanding rather than a single "invalid password".
 *
 * This is the canonical copy: the trainer portal has its own change-password form which validated
 * only "passwords match". See the redesign request note — that copy should import or mirror this.
 */
export function passwordIssues(value: string): string[] {
  const out: string[] = [];
  if (value.length < 8) out.push("at least 8 characters");
  if (!/[A-Za-z]/.test(value)) out.push("a letter");
  if (!/[0-9]/.test(value)) out.push("a number");
  return out;
}

/** 0–3. Drives the strength bar; deliberately simple and honest rather than a fake entropy score. */
function passwordStrength(value: string): 0 | 1 | 2 | 3 {
  if (!value) return 0;
  if (passwordIssues(value).length > 0) return 1;
  const long = value.length >= 12;
  const varied = /[^A-Za-z0-9]/.test(value) && /[A-Z]/.test(value);
  return long && varied ? 3 : 2;
}

const STRENGTH = [
  { label: "", bar: "", text: "" },
  { label: "Too weak", bar: "bg-danger", text: "text-danger" },
  { label: "Good", bar: "bg-warning", text: "text-warning-dark" },
  { label: "Strong", bar: "bg-success", text: "text-success-dark" },
] as const;

export function ChangePasswordForm() {
  const router = useRouter();
  const [form, setForm] = React.useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  // Two independent reveals: showing the NEW password should never also expose the current one
  // to whoever is looking over the student's shoulder.
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const issues = passwordIssues(form.newPassword);
  const strength = passwordStrength(form.newPassword);
  const newOk = form.newPassword.length > 0 && issues.length === 0;
  const matches = form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword;
  const mismatch = form.confirmPassword.length > 0 && !matches;
  const sameAsCurrent = newOk && form.currentPassword.length > 0 && form.newPassword === form.currentPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    // Everything the server would reject is caught here first, with the field named.
    if (issues.length > 0) {
      setErrors({ newPassword: `Your new password needs ${issues.join(", ")}.` });
      return;
    }
    if (sameAsCurrent) {
      setErrors({ newPassword: "Choose a password different from your current one." });
      return;
    }
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

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="Current password" htmlFor="currentPassword" required error={errors.currentPassword}>
        <Input
          id="currentPassword"
          className="pr-12"
          type={showCurrent ? "text" : "password"}
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(e) => set("currentPassword", e.target.value)}
          invalid={!!errors.currentPassword}
          rightIcon={<RevealButton shown={showCurrent} onToggle={() => setShowCurrent((s) => !s)} label="current password" />}
        />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        required
        error={errors.newPassword ?? (sameAsCurrent ? "Choose a password different from your current one." : undefined)}
        hint="At least 8 characters, including a letter and a number."
      >
        <Input
          id="newPassword"
          className="pr-12"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => set("newPassword", e.target.value)}
          invalid={!!errors.newPassword || sameAsCurrent}
          valid={newOk && !sameAsCurrent}
          rightIcon={<RevealButton shown={show} onToggle={() => setShow((s) => !s)} label="new password" />}
          aria-describedby="password-strength"
        />
      </Field>

      {/* Live strength + the specific unmet requirements. Announced politely, never as an error. */}
      {form.newPassword.length > 0 && (
        <div id="password-strength" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="flex h-1.5 flex-1 gap-1" aria-hidden>
              {[1, 2, 3].map((step) => (
                <span key={step} className={cn("duration-micro h-full flex-1 rounded-full transition-colors motion-reduce:transition-none", step <= strength ? STRENGTH[strength].bar : "bg-line")} />
              ))}
            </span>
            <span className={cn("text-caption shrink-0 font-semibold", STRENGTH[strength].text)}>{STRENGTH[strength].label}</span>
          </div>
          {issues.length > 0 && <p className="text-caption mt-1.5 text-muted">Still needs {issues.join(", ")}.</p>}
        </div>
      )}

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        required
        error={errors.confirmPassword ?? (mismatch ? "Passwords do not match" : undefined)}
        success={matches ? "Passwords match" : undefined}
      >
        <Input
          id="confirmPassword"
          className="pr-12"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => set("confirmPassword", e.target.value)}
          invalid={!!errors.confirmPassword || mismatch}
          valid={matches}
          rightIcon={<RevealButton shown={show} onToggle={() => setShow((s) => !s)} label="new password" />}
        />
      </Field>

      <Button type="submit" loading={busy} fullWidth>
        Update password
      </Button>
      <p className="text-caption text-muted">Changing your password signs you out everywhere else. You stay logged in on this device.</p>
    </form>
  );
}

/** 44px reveal toggle (the input gets extra right padding so the text never runs under it). */
function RevealButton({ shown, onToggle, label }: { shown: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={shown}
      className="ring-focus duration-micro -mr-1.5 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted transition-colors tap-highlight-none hover:text-navy motion-reduce:transition-none"
    >
      {shown ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
    </button>
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
