"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, MailCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { CodeInput } from "@/components/admin/account-security/code-input";

/** Client-side pause before "Send a new code" (the server also limits requests per hour). */
const RESEND_AFTER_SEC = 45;

type Sent = { sentTo: string; expiresInMinutes: number };

/**
 * Super Admin only: change the login email in two steps. A 6-digit code goes to the NEW address, and
 * the change happens only once that code is entered here — so a typo can never lock the account out.
 */
export function LoginEmailCard({ currentEmail }: { currentEmail: string | null }) {
  const router = useRouter();
  const [step, setStep] = React.useState<"idle" | "email" | "code">("idle");
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState<Sent | null>(null);
  const [code, setCode] = React.useState("");
  const [resendAt, setResendAt] = React.useState(0);
  const [now, setNow] = React.useState(0);
  const request = useApiForm();
  const verify = useApiForm();
  const codeRef = React.useRef<HTMLInputElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);

  // Ticks only while a cooldown is running.
  React.useEffect(() => {
    if (step !== "code" || resendAt === 0) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= resendAt) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, resendAt]);

  React.useEffect(() => {
    if (step === "code") codeRef.current?.focus();
    else if (step === "email") emailRef.current?.focus();
  }, [step]);

  const resendIn = resendAt > now ? Math.ceil((resendAt - now) / 1000) : 0;

  const reset = () => {
    setStep("idle");
    setEmail("");
    setSent(null);
    setCode("");
    setResendAt(0);
    request.setError(null);
    request.setFieldErrors({});
    verify.setError(null);
    verify.setFieldErrors({});
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = email.trim();
    if (!target) {
      request.setFieldErrors({ email: "Enter the new email address" });
      return;
    }
    const res = await request.submit(() => api.post<Sent>("/api/admin/account/email", { email: target }), { silent: true });
    if (res) {
      const t = Date.now();
      setSent(res);
      setCode("");
      verify.setError(null);
      verify.setFieldErrors({});
      setNow(t);
      setResendAt(t + RESEND_AFTER_SEC * 1000);
      setStep("code");
      toast.success("Verification code sent", `Check the inbox of ${res.sentTo}.`);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      verify.setFieldErrors({ code: "Enter the 6-digit code" });
      return;
    }
    const res = await verify.submit(() => api.post<{ email: string }>("/api/admin/account/email/verify", { code }), { silent: true });
    setCode("");
    if (res) {
      toast.success("Login email changed", `You now sign in with ${res.email}. Your other devices were signed out.`);
      reset();
      router.refresh();
    }
  };

  const emailError = request.fieldErrors.email || (step === "email" ? request.error : null) || undefined;
  const codeError = verify.fieldErrors.code || verify.error || undefined;

  return (
    <Card>
      <CardHeader title="Login email" description="Where your sign-in codes and security alerts are sent." />
      <CardBody className="space-y-4">
        <p className="text-body-sm">
          <span className="text-muted">Current: </span>
          <span className="font-semibold break-all text-ink">{currentEmail ?? "No email on this account"}</span>
        </p>

        {step === "idle" && (
          <Button type="button" variant="outline" size="sm" leftIcon={<Mail className="h-4 w-4" />} onClick={() => setStep("email")}>
            Change login email
          </Button>
        )}

        {step === "email" && (
          <form onSubmit={sendCode} className="space-y-4" noValidate>
            <Field label="New login email" required error={emailError} hint="We will email a 6-digit code to this address. Nothing changes until you enter it here.">
              <Input
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  request.clearField("email");
                  request.setError(null);
                }}
                invalid={!!emailError}
                maxLength={190}
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={reset} disabled={request.loading}>
                Cancel
              </Button>
              <Button type="submit" loading={request.loading} leftIcon={<Mail className="h-4 w-4" />}>
                Send verification code
              </Button>
            </div>
          </form>
        )}

        {step === "code" && sent && (
          <form onSubmit={confirm} className="space-y-4" noValidate>
            <Alert tone="info">
              Enter the 6-digit verification code sent to <span className="font-semibold break-all">{sent.sentTo}</span>. It expires in {sent.expiresInMinutes} minutes.
            </Alert>
            {request.error && step === "code" && <Alert tone="danger">{request.error}</Alert>}
            <Field label="6-digit code" required error={codeError}>
              <CodeInput
                ref={codeRef}
                value={code}
                onValueChange={(v) => {
                  setCode(v);
                  verify.clearField("code");
                  verify.setError(null);
                }}
                invalid={!!codeError}
                className="sm:max-w-xs"
              />
            </Field>
            <p className="text-body-sm text-muted">After the change, your other devices are signed out and you sign in with the new address.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setStep("email")} disabled={verify.loading || request.loading}>
                Use a different email
              </Button>
              <Button type="button" variant="outline" onClick={() => void sendCode()} disabled={resendIn > 0 || verify.loading} loading={request.loading}>
                {resendIn > 0 ? `Send a new code (${resendIn}s)` : "Send a new code"}
              </Button>
              <Button type="submit" loading={verify.loading} leftIcon={<MailCheck className="h-4 w-4" />}>
                Verify and change
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
