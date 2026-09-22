"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IdCard, MessageSquareText, Pencil, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface OtpRequestResult {
  message: string;
  expiresInSec: number;
  resendAfterSec: number;
}

type Step = "details" | "code";

const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** 10 digits for display: drops a leading +91 / 91 / 0 the way the server's normalizeMobile does. */
function tenDigits(v: string) {
  const d = onlyDigits(v);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

function formatCountdown(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Admission number + mobile → one-time code → signed in. Two steps on one screen:
 *
 *   1. details — admission number and the mobile on the admission. The server always answers with
 *      the same neutral line, so this screen never says whether an admission exists.
 *   2. code — ONE numeric field (not six boxes): a single label for screen readers, one target for
 *      Android's SMS autofill (`autocomplete="one-time-code"`), and paste of the whole code just
 *      works. Letter-spacing gives it the six-slot look. Filling all six digits submits.
 *
 * The step change is a 250ms fade-up that motion-reduce turns off; nothing here is `position: fixed`,
 * so the transform it leaves behind contains nothing.
 */
export function AdmissionLogin({ next, onUsePassword }: { next?: string; onUsePassword: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [admissionNo, setAdmissionNo] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const admissionRef = useRef<HTMLInputElement>(null);
  const lastAutoSubmitted = useRef<string | null>(null);

  // One ticking interval while a countdown is running; cleared the moment it reaches zero.
  const counting = resendIn > 0;
  useEffect(() => {
    if (!counting) return;
    const t = window.setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [counting]);

  const handleError = (err: unknown, fallback: string) => {
    if (err instanceof ApiClientError) {
      if (err.code === "OTP_UNAVAILABLE") setUnavailable(true);
      const fe = err.fieldErrors;
      setFieldErrors(fe);
      // Field problems are shown under their field; only a general message goes in the banner.
      if (!Object.keys(fe).length) setError(err.message);
    } else setError(fallback);
  };

  const sendCode = async (isResend = false) => {
    setError(null);
    setFieldErrors({});
    setUnavailable(false);
    setSending(true);
    try {
      const data = await api.post<OtpRequestResult>("/api/auth/otp/request", { admissionNo: admissionNo.trim(), mobile });
      setNotice(isResend ? "A new code is on its way. Earlier codes no longer work." : data.message);
      setResendIn(data.resendAfterSec);
      setCode("");
      lastAutoSubmitted.current = null;
      setStep("code");
    } catch (err) {
      handleError(err, "We could not send a code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const verify = async (value = code) => {
    setError(null);
    setFieldErrors({});
    if (!/^\d{6}$/.test(value)) {
      setFieldErrors({ code: "Enter the 6-digit code" });
      codeRef.current?.focus();
      return;
    }
    setVerifying(true);
    try {
      const data = await api.post<{ redirect: string }>("/api/auth/otp/verify", { admissionNo: admissionNo.trim(), mobile, code: value, next });
      router.replace(data.redirect);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        // Wrong, expired or locked code: the message belongs under the code field.
        setFieldErrors({ code: err.message });
        codeRef.current?.select();
      } else handleError(err, "Unable to log in. Please try again.");
      setVerifying(false);
    }
  };

  // Focus follows the step so a keyboard or screen-reader user lands where the next input is.
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const onCodeChange = (raw: string) => {
    const digits = onlyDigits(raw).slice(0, 6);
    setCode(digits);
    if (fieldErrors.code) setFieldErrors((fe) => ({ ...fe, code: "" }));
    // Autofill from the SMS or a paste of the whole code submits once; editing it again re-arms.
    if (digits.length === 6 && !verifying && lastAutoSubmitted.current !== digits) {
      lastAutoSubmitted.current = digits;
      void verify(digits);
    }
  };

  const editDetails = () => {
    setStep("details");
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setCode("");
    window.setTimeout(() => admissionRef.current?.focus(), 0);
  };

  const mobileDisplay = tenDigits(mobile);

  return (
    <div>
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {/* Below the message rather than beside it: at 360px a side button would squeeze the sentence. */}
      {unavailable && (
        <Button variant="outline" size="md" fullWidth onClick={onUsePassword} className="mb-4">
          Log in with password instead
        </Button>
      )}

      {step === "details" ? (
        <form
          key="details"
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
          className="animate-fade-up space-y-4 motion-reduce:animate-none"
          noValidate
        >
          <p className="text-body-sm flex gap-3 rounded-card bg-lavender/60 p-3 text-ink">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-navy" aria-hidden>
              <IdCard className="h-5 w-5" />
            </span>
            <span className="min-w-0 self-center">Your admission number is printed on your admission confirmation and your student ID card.</span>
          </p>

          <Field label="Admission number" htmlFor="admissionNo" required error={fieldErrors.admissionNo}>
            <Input
              ref={admissionRef}
              id="admissionNo"
              name="admissionNo"
              value={admissionNo}
              onChange={(e) => setAdmissionNo(e.target.value.toUpperCase())}
              placeholder="ADM-2026-000123"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              leftIcon={<IdCard className="h-4 w-4" />}
              invalid={!!fieldErrors.admissionNo}
              className="font-medium tracking-wide"
              required
            />
          </Field>

          <Field label="Mobile number" htmlFor="admissionMobile" required hint="The mobile number given at admission." error={fieldErrors.mobile}>
            <Input
              id="admissionMobile"
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/[^\d+\s-]/g, ""))}
              placeholder="10-digit mobile number"
              maxLength={16}
              leftIcon={<Smartphone className="h-4 w-4" />}
              invalid={!!fieldErrors.mobile}
              className="tabular-nums"
              required
            />
          </Field>

          <Button type="submit" size="lg" fullWidth loading={sending}>
            Send code
          </Button>
          <p className="text-caption text-center text-muted">We will text a 6-digit code to this number. Standard SMS rates may apply.</p>
        </form>
      ) : (
        <form
          key="code"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
          className="animate-fade-up space-y-4 motion-reduce:animate-none"
          noValidate
        >
          {/* Where the code went — an app-style row with the way back to fix a typo. */}
          <div className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-light text-orange" aria-hidden>
              <MessageSquareText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink tabular-nums">{mobileDisplay.length === 10 ? `+91 ${mobileDisplay.slice(0, 5)} ${mobileDisplay.slice(5)}` : mobile}</p>
              <p className="text-body-sm truncate text-muted">{admissionNo.trim()}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={editDetails} leftIcon={<Pencil className="h-4 w-4" />} className="shrink-0">
              Change
            </Button>
          </div>

          {notice && (
            <p role="status" className="text-body-sm text-muted">
              {notice} The code is valid for 5 minutes.
            </p>
          )}

          <Field label="6-digit code" htmlFor="loginCode" required error={fieldErrors.code || undefined}>
            <Input
              ref={codeRef}
              id="loginCode"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              onPaste={(e) => {
                // Pasting the whole SMS ("123456 is your login code. Valid 5 min") or "123 456"
                // still yields exactly the six code digits, not every digit in the message.
                const match = e.clipboardData.getData("text").match(/(?<!\d)(\d{3})[\s-]?(\d{3})(?!\d)/);
                if (match) {
                  e.preventDefault();
                  onCodeChange(`${match[1]}${match[2]}`);
                }
              }}
              placeholder="••••••"
              invalid={!!fieldErrors.code}
              className={cn(
                // pl balances the trailing letter-spacing so the digits sit truly centred.
                "text-center font-heading text-2xl font-bold tracking-[0.5em] tabular-nums sm:text-2xl",
                "min-h-14 pl-[calc(0.875rem+0.5em)] sm:min-h-14"
              )}
              required
            />
          </Field>

          <Button type="submit" size="lg" fullWidth loading={verifying}>
            Verify and log in
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-x-2 text-body-sm text-muted">
            <span>Did not get the code?</span>
            {resendIn > 0 ? (
              <span className="inline-flex h-11 items-center font-semibold text-ink tabular-nums">Resend in {formatCountdown(resendIn)}</span>
            ) : (
              <Button variant="link" size="sm" onClick={() => void sendCode(true)} loading={sending} className="font-semibold">
                Resend code
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
