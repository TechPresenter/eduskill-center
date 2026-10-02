"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, KeyRound, Loader2, Mail, Pencil, RotateCcw, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { WizardProgress } from "@/components/ui/wizard-progress";
import type { StepperStep } from "@/components/ui/misc";
import { OtpCodeField } from "@/components/auth/otp-code-field";
import { BackupCodesDialog } from "@/components/auth/backup-codes-dialog";
import { TotpSetupCard } from "@/components/auth/totp-setup-card";
import { useCountdown } from "@/components/auth/use-countdown";
import { api, ApiClientError } from "@/lib/api-client";
import type { ChallengeState } from "@/server/admin-auth";
import type { SetupPayload } from "@/server/two-factor";
import { AuthCard } from "../../auth-card";

export type AdminLoginReason = "idle" | "expired" | null;

type Step = "email" | "otp" | "totp" | "enroll" | "done";
type Busy = null | "send" | "verify" | "resend" | "cancel";

interface SentResult {
  message: string;
  state: ChallengeState;
}

type StepResult = { step: "done"; redirect: string; backupCodes?: string[] } | { step: "totp" | "enroll"; state: ChallengeState };

const EXPIRED = "This sign-in has expired. Please start again.";
/** Stable empty list for the closed backup-codes dialog (a fresh `[]` each render would reset it). */
const NO_CODES: string[] = [];

const DESCRIPTION: Record<Step, string | undefined> = {
  email: "Enter your registered email address to receive a secure one-time verification code.",
  otp: "Enter the 6-digit verification code sent to your registered email address.",
  totp: "Enter the 6-digit code from your authenticator app to continue.",
  enroll: "Two-factor authentication is required for administrators. Set up your authenticator app to continue.",
  done: undefined,
};

const ANNOUNCE: Record<Step, string> = {
  email: "Enter your registered email address.",
  otp: "Enter the 6-digit verification code sent to your registered email address.",
  totp: "Enter the 6-digit code from your authenticator app to continue.",
  enroll: "Set up your authenticator app to continue.",
  done: "Verified — signing you in…",
};

function stepFor(state: ChallengeState | null): Step {
  switch (state?.stage) {
    case "OTP":
      return "otp";
    case "SECOND_FACTOR":
      return "totp";
    case "ENROLL":
      return "enroll";
    default:
      return "email";
  }
}

/** Seconds the newest emailed code has left when a sign-in is resumed (counted from the challenge's start). */
function codeLeftOnResume(state: ChallengeState, challengeTtlSec: number) {
  const age = Math.max(0, challengeTtlSec - state.expiresInSec);
  return Math.max(0, Math.min(state.codeTtlMinutes * 60 - age, state.expiresInSec));
}

function setupErrorMessage(err: unknown) {
  return err instanceof ApiClientError && err.status !== 401 ? err.message : "The set-up code could not be loaded. Please try again.";
}

/** "abcd efgh" / "ABCDEFGH" → "ABCD-EFGH" while typing. */
function formatBackupCode(raw: string) {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

function tooManyMessage(err: ApiClientError) {
  const d = err.details as { retryAfterSec?: unknown } | undefined;
  const sec = typeof d?.retryAfterSec === "number" ? d.retryAfterSec : 0;
  if (sec <= 0) return "Too many attempts. Please wait a few minutes and try again.";
  const minutes = Math.max(1, Math.ceil(sec / 60));
  return `Too many attempts. Please wait ${minutes === 1 ? "a minute" : `${minutes} minutes`} and try again.`;
}

/**
 * Secure Admin Login wizard (src/server/admin-auth.ts does the real work):
 *
 *   email → 6-digit emailed code → authenticator code / backup code → signed in
 *                                 ↘ first-time authenticator set-up (when 2FA is required) → backup codes
 *
 * Every step runs against a challenge bound to this browser by an httpOnly cookie; the page only
 * ever sees a masked email hint, cooldowns and the step name. A sign-in started by the password form
 * arrives here at its second-factor step (`initialState`), and one in progress survives a reload.
 *
 * Phone-first: one column, 16px inputs, 44px+ targets, the code field auto-submits at six digits,
 * focus moves to each step's field, and step changes are announced through a polite live region.
 */
export function AdminLogin({
  options,
  initialState,
  next,
  reason,
  challengeTtlSec,
}: {
  options: { emailOtp: boolean; password: boolean };
  initialState: ChallengeState | null;
  /** Safe /admin destination after sign-in. */
  next: string;
  reason: AdminLoginReason;
  challengeTtlSec: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(() => stepFor(initialState));
  const [challenge, setChallenge] = useState<ChallengeState | null>(initialState);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [enrollCode, setEnrollCode] = useState("");
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restartNotice, setRestartNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [announce, setAnnounce] = useState("");

  const challengeClock = useCountdown(initialState?.expiresInSec ?? 0);
  const resendClock = useCountdown(initialState?.stage === "OTP" ? initialState.resendAfterSec : 0);
  const codeClock = useCountdown(initialState?.stage === "OTP" ? codeLeftOnResume(initialState, challengeTtlSec) : 0);

  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const totpRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const enrollHeadingRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  /** One request at a time (auto-submit and a button press can race). */
  const inFlight = useRef(false);
  /** Set by any action, so a late resume answer never overrides what the person just did. */
  const touched = useRef(false);

  const inChallenge = step === "otp" || step === "totp" || step === "enroll";
  // While the backup codes are on screen the person is already signed in: nothing can "expire".
  const expired = inChallenge && !challengeClock.running && backupCodes === null;

  // ───────────── transitions ─────────────

  const loadSetup = () => {
    api.get<SetupPayload>("/api/auth/admin/2fa/enroll").then(
      (data) => {
        setSetup(data);
        setSetupError(null);
      },
      (err: unknown) => setSetupError(setupErrorMessage(err))
    );
  };

  const enterChallenge = (state: ChallengeState, opts: { codeSent: boolean }) => {
    const nextStep = stepFor(state);
    setChallenge(state);
    challengeClock.restart(state.expiresInSec);
    if (state.stage === "OTP") {
      resendClock.restart(state.resendAfterSec);
      codeClock.restart(opts.codeSent ? Math.min(state.codeTtlMinutes * 60, state.expiresInSec) : codeLeftOnResume(state, challengeTtlSec));
    } else {
      resendClock.restart(0);
      codeClock.restart(0);
    }
    setFieldErrors({});
    setError(null);
    setRestartNotice(null);
    setStep(nextStep);
    setAnnounce(ANNOUNCE[nextStep]);
    if (nextStep === "enroll") loadSetup();
  };

  const resetToEmail = (message: string | null) => {
    setChallenge(null);
    setStep("email");
    setCode("");
    setTotpCode("");
    setBackupCode("");
    setEnrollCode("");
    setUseBackup(false);
    setSetup(null);
    setSetupError(null);
    setNotice(null);
    setError(null);
    setFieldErrors({});
    setRestartNotice(message);
    challengeClock.restart(0);
    resendClock.restart(0);
    codeClock.restart(0);
    setAnnounce(message ?? ANNOUNCE.email);
  };

  const go = (redirect: string) => {
    setBackupCodes(null);
    setPendingRedirect(null);
    setSetup(null);
    setStep("done");
    setAnnounce(ANNOUNCE.done);
    challengeClock.restart(0);
    router.replace(redirect);
    router.refresh();
  };

  const finish = (redirect: string, codes?: string[]) => {
    if (codes && codes.length > 0) {
      // Signed in already; the codes are shown once before leaving the page.
      setBackupCodes(codes);
      setPendingRedirect(redirect);
      setAnnounce("Two-factor authentication is on. Save your backup codes before you continue.");
      return;
    }
    go(redirect);
  };

  const challengeAlive = async () => {
    try {
      const data = await api.get<{ state: ChallengeState | null }>("/api/auth/admin/challenge");
      return data.state !== null;
    } catch {
      return true;
    }
  };

  /** Turns a failed request into the right message, in the right place. Never more than the server said. */
  const fail = async (err: unknown, fallback: string, field?: string) => {
    if (!(err instanceof ApiClientError)) {
      setError(fallback);
      return;
    }
    if (err.status === 422) {
      const fe = err.fieldErrors;
      if (Object.keys(fe).length) setFieldErrors(fe);
      else setError(err.message);
      return;
    }
    if (err.status === 401) {
      // A wrong or expired code — or a sign-in that has ended (too many tries, timed out). Ask which.
      if (!(await challengeAlive())) {
        resetToEmail(EXPIRED);
        return;
      }
      if (field) setFieldErrors({ [field]: err.message });
      else setError(err.message);
      return;
    }
    if (err.status === 429) {
      setError(tooManyMessage(err));
      return;
    }
    setError(err.message || fallback);
  };

  /** Shared wrapper: one request at a time, busy state, cleared messages. */
  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    touched.current = true;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(kind);
    try {
      await task();
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  // ───────────── actions ─────────────

  const requestCode = () => {
    setError(null);
    setFieldErrors({});
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      touched.current = true;
      setFieldErrors({ email: "Enter your registered email address" });
      emailRef.current?.focus();
      return;
    }
    void run("send", async () => {
      try {
        const data = await api.post<SentResult>("/api/auth/admin/otp/request", { email: value, next });
        setCode("");
        enterChallenge(data.state, { codeSent: true });
        setNotice(data.message);
      } catch (err) {
        await fail(err, "We could not send a code. Please try again.", "email");
      }
    });
  };

  const resendCode = () =>
    void run("resend", async () => {
      setError(null);
      setFieldErrors({});
      try {
        const data = await api.post<SentResult>("/api/auth/admin/otp/resend");
        setChallenge(data.state);
        challengeClock.restart(data.state.expiresInSec);
        resendClock.restart(data.state.resendAfterSec);
        codeClock.restart(Math.min(data.state.codeTtlMinutes * 60, data.state.expiresInSec));
        setCode("");
        setNotice(`${data.message} Earlier codes no longer work.`);
        setAnnounce("A new code was requested.");
        otpRef.current?.focus();
      } catch (err) {
        await fail(err, "We could not send a new code. Please try again.");
      }
    });

  const verifyOtp = (value = code) => {
    setError(null);
    setFieldErrors({});
    if (!/^\d{6}$/.test(value)) {
      touched.current = true;
      setFieldErrors({ code: "Enter the 6-digit code" });
      otpRef.current?.focus();
      return;
    }
    void run("verify", async () => {
      try {
        const r = await api.post<StepResult>("/api/auth/admin/otp/verify", { code: value });
        if (r.step === "done") finish(r.redirect, r.backupCodes);
        else {
          setNotice(null);
          enterChallenge(r.state, { codeSent: false });
          setAnnounce(`Email code verified. ${ANNOUNCE[stepFor(r.state)]}`);
        }
      } catch (err) {
        await fail(err, "Unable to verify the code. Please try again.", "code");
        otpRef.current?.select();
      }
    });
  };

  const verifySecondFactor = (totp = totpCode) => {
    setError(null);
    setFieldErrors({});
    if (useBackup ? !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(backupCode) : !/^\d{6}$/.test(totp)) {
      touched.current = true;
      if (useBackup) {
        setFieldErrors({ backupCode: "Enter a backup code like ABCD-EFGH" });
        backupRef.current?.focus();
      } else {
        setFieldErrors({ code: "Enter the 6-digit code" });
        totpRef.current?.focus();
      }
      return;
    }
    void run("verify", async () => {
      try {
        const r = await api.post<StepResult>("/api/auth/admin/2fa/verify", useBackup ? { backupCode } : { code: totp });
        if (r.step === "done") finish(r.redirect, r.backupCodes);
        else enterChallenge(r.state, { codeSent: false });
      } catch (err) {
        await fail(err, "Unable to verify the code. Please try again.", useBackup ? "backupCode" : "code");
        (useBackup ? backupRef : totpRef).current?.select();
      }
    });
  };

  const confirmEnrollment = (value = enrollCode) => {
    setError(null);
    setFieldErrors({});
    if (!/^\d{6}$/.test(value)) {
      touched.current = true;
      setFieldErrors({ code: "Enter the 6-digit code from the app" });
      return;
    }
    void run("verify", async () => {
      try {
        const r = await api.post<StepResult>("/api/auth/admin/2fa/enroll", { code: value });
        if (r.step === "done") finish(r.redirect, r.backupCodes);
        else enterChallenge(r.state, { codeSent: false });
      } catch (err) {
        await fail(err, "Unable to verify the code. Please try again.", "code");
      }
    });
  };

  /** "Change email" and "Cancel sign-in": the challenge ends server-side, the typed email stays. */
  const cancelSignIn = () =>
    void run("cancel", async () => {
      try {
        await api.post("/api/auth/admin/cancel");
      } catch {
        // The challenge cookie expires on its own, and a new code request ends it anyway.
      }
      resetToEmail(null);
    });

  const retrySetup = () => {
    setSetupError(null);
    loadSetup();
  };

  // ───────────── effects ─────────────

  // Resume check on load: the server-rendered state can be a few seconds old (or restored from the
  // back/forward cache), so ask once which sign-in — if any — is really in progress.
  const applyResume = useEffectEvent((fresh: ChallengeState | null) => {
    if (touched.current) return;
    if ((fresh?.stage ?? null) === (initialState?.stage ?? null)) return;
    if (fresh) enterChallenge(fresh, { codeSent: false });
    else resetToEmail(initialState ? EXPIRED : null);
  });
  const resumeEnroll = initialState?.stage === "ENROLL";
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ state: ChallengeState | null }>("/api/auth/admin/challenge")
      .then((data) => {
        if (!cancelled) applyResume(data.state);
      })
      .catch(() => {
        // Offline or rate-limited: the server-rendered state stands.
      });
    // A sign-in resumed at first-time set-up needs its QR code straight away.
    if (resumeEnroll) {
      api.get<SetupPayload>("/api/auth/admin/2fa/enroll").then(
        (data) => {
          if (!cancelled) setSetup(data);
        },
        (err: unknown) => {
          if (!cancelled) setSetupError(setupErrorMessage(err));
        }
      );
    }
    return () => {
      cancelled = true;
    };
  }, [resumeEnroll]);

  // Focus follows the step (not on first paint: a phone keyboard should not pop up uninvited).
  const focusKey = `${step}:${useBackup}`;
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    const target =
      step === "email"
        ? emailRef.current
        : step === "otp"
          ? otpRef.current
          : step === "totp"
            ? useBackup
              ? backupRef.current
              : totpRef.current
            : step === "enroll"
              ? enrollHeadingRef.current
              : doneRef.current;
    target?.focus();
  }, [focusKey, step, useBackup]);

  // ───────────── render ─────────────

  const passwordFirst = challenge?.firstFactor === "PASSWORD";
  const secondLabel = step === "enroll" ? "Set up authenticator" : "Authenticator";
  const steps: StepperStep[] = passwordFirst
    ? [{ label: "Password" }, { label: secondLabel }]
    : [{ label: "Email" }, { label: "Email code" }, { label: secondLabel }];
  const current = passwordFirst ? 1 : step === "email" ? 0 : step === "otp" ? 1 : 2;
  const passwordHref = `/login?next=${encodeURIComponent(next)}`;
  const description =
    step === "totp" && useBackup
      ? "Enter one of your single-use backup codes to continue."
      : step === "email" && !options.emailOtp
        ? undefined
        : DESCRIPTION[step];
  const showProgress = step !== "done" && (step !== "email" || options.emailOtp);

  return (
    <AuthCard
      eyebrow="Foundation administrators"
      title="Secure Admin Login"
      description={description}
      footer={
        <>
          Not an administrator?{" "}
          <Link href="/login" className="ring-focus inline-flex min-h-11 items-center rounded-xs font-semibold text-orange hover:underline">
            Student and trainer login
          </Link>
        </>
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {step === "email" && restartNotice && (
        <Alert tone="warning" className="mb-4">
          {restartNotice}
        </Alert>
      )}
      {step === "email" && !restartNotice && reason && (
        <Alert tone="info" className="mb-4">
          {reason === "idle" ? "You were signed out after a period of inactivity. Please sign in again." : "Your session has expired. Please sign in again."}
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {showProgress && <WizardProgress steps={steps} current={current} className="mb-6" />}

      {expired ? (
        <div className="space-y-4">
          <Alert tone="warning">{EXPIRED}</Alert>
          <Button type="button" size="lg" fullWidth onClick={cancelSignIn} loading={busy === "cancel"} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}>
            Start again
          </Button>
        </div>
      ) : step === "email" ? (
        options.emailOtp ? (
          <form
            key="email"
            onSubmit={(e) => {
              e.preventDefault();
              requestCode();
            }}
            className="animate-fade-up space-y-4 motion-reduce:animate-none"
            noValidate
          >
            <div className="flex gap-3 rounded-card bg-lavender/60 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-navy" aria-hidden>
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="min-w-0 self-center">
                <span className="block font-semibold text-navy">Passwordless Secure Login</span>
                <span className="text-body-sm block text-muted">No password to type: a single-use code is emailed to you.</span>
              </span>
            </div>

            <Field label="Registered email address" htmlFor="adminEmail" required error={fieldErrors.email}>
              <Input
                ref={emailRef}
                id="adminEmail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={190}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                invalid={!!fieldErrors.email}
                required
              />
            </Field>

            <Button type="submit" size="lg" fullWidth loading={busy === "send"}>
              Continue with Email OTP
            </Button>

            {options.password && (
              <p className="text-center">
                <Link href={passwordHref} className="text-body-sm ring-focus inline-flex min-h-11 items-center gap-1.5 rounded-md font-semibold text-navy hover:underline">
                  <KeyRound className="h-4 w-4" aria-hidden />
                  Sign in with password instead
                </Link>
              </p>
            )}
          </form>
        ) : (
          <div className="space-y-4">
            <Alert tone="warning" title="Email sign-in codes are unavailable">
              Outgoing email is not set up on this server yet, so a sign-in code cannot be sent.{" "}
              {options.password ? "Sign in with your password instead." : "Ask the server administrator for a one-time recovery link."}
            </Alert>
            {options.password && (
              <ButtonLink href={passwordHref} size="lg" fullWidth leftIcon={<KeyRound className="h-4 w-4" aria-hidden />}>
                Sign in with password
              </ButtonLink>
            )}
          </div>
        )
      ) : step === "otp" ? (
        <form
          key="otp"
          onSubmit={(e) => {
            e.preventDefault();
            verifyOtp();
          }}
          className="animate-fade-up space-y-4 motion-reduce:animate-none"
          noValidate
        >
          <IdentityRow
            icon={<Mail className="h-5 w-5" />}
            label="Code sent to"
            value={challenge?.emailHint ?? "your registered email address"}
            action={
              <Button variant="ghost" size="sm" onClick={cancelSignIn} disabled={busy !== null} leftIcon={<Pencil className="h-4 w-4" aria-hidden />} className="shrink-0">
                Change email
              </Button>
            }
          />

          {notice && <p className="text-body-sm text-muted">{notice}</p>}

          <Field
            label="Verification code"
            htmlFor="adminOtp"
            required
            error={fieldErrors.code || undefined}
            hint={
              codeClock.running ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  The code expires in <span className="font-semibold text-ink tabular-nums">{codeClock.label}</span>
                </span>
              ) : (
                "This code has expired. Request a new code below."
              )
            }
          >
            <OtpCodeField
              ref={otpRef}
              id="adminOtp"
              name="code"
              value={code}
              onChange={(v) => {
                setCode(v);
                if (fieldErrors.code) setFieldErrors((fe) => ({ ...fe, code: "" }));
              }}
              onComplete={(c) => verifyOtp(c)}
              invalid={!!fieldErrors.code}
              revealNoun="verification code"
              required
            />
          </Field>

          <Button type="submit" size="lg" fullWidth loading={busy === "verify"}>
            Verify code
          </Button>

          <div className="text-body-sm flex flex-wrap items-center justify-center gap-x-2 text-muted">
            <span>Did not get the code?</span>
            {resendClock.running ? (
              <span className="inline-flex h-11 items-center font-semibold text-ink tabular-nums">Resend in {resendClock.label}</span>
            ) : (
              <Button variant="link" size="sm" onClick={resendCode} loading={busy === "resend"} disabled={busy !== null && busy !== "resend"} className="font-semibold">
                Resend code
              </Button>
            )}
          </div>
          <p className="text-caption -mt-2 text-center text-muted">It can take a minute to arrive. Check your spam or junk folder too.</p>

          <p className="text-body-sm flex gap-2.5 rounded-card border border-line bg-surface p-3 text-muted">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
            <span>If you did not request this code, someone may know your email address. Your account stays safe without the code.</span>
          </p>
        </form>
      ) : step === "totp" ? (
        <form
          key="totp"
          onSubmit={(e) => {
            e.preventDefault();
            verifySecondFactor();
          }}
          className="animate-fade-up space-y-4 motion-reduce:animate-none"
          noValidate
        >
          <IdentityRow icon={<Smartphone className="h-5 w-5" />} label="Signing in as" value={challenge?.emailHint ?? "your administrator account"} />

          {useBackup ? (
            <Field label="Backup code" htmlFor="adminBackupCode" required hint="Each backup code works once." error={fieldErrors.backupCode || undefined}>
              <Input
                ref={backupRef}
                id="adminBackupCode"
                name="backupCode"
                value={backupCode}
                onChange={(e) => {
                  setBackupCode(formatBackupCode(e.target.value));
                  if (fieldErrors.backupCode) setFieldErrors((fe) => ({ ...fe, backupCode: "" }));
                }}
                placeholder="XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={9}
                invalid={!!fieldErrors.backupCode}
                className="min-h-14 text-center font-mono text-xl font-semibold tracking-widest sm:min-h-14 sm:text-xl"
                required
              />
            </Field>
          ) : (
            <Field label="Authenticator code" htmlFor="adminTotp" required hint="Open your authenticator app and enter the current code." error={fieldErrors.code || undefined}>
              <OtpCodeField
                ref={totpRef}
                id="adminTotp"
                name="code"
                value={totpCode}
                onChange={(v) => {
                  setTotpCode(v);
                  if (fieldErrors.code) setFieldErrors((fe) => ({ ...fe, code: "" }));
                }}
                onComplete={(c) => verifySecondFactor(c)}
                invalid={!!fieldErrors.code}
                defaultRevealed
                revealNoun="authenticator code"
                required
              />
            </Field>
          )}

          <Button type="submit" size="lg" fullWidth loading={busy === "verify"}>
            Verify and sign in
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setUseBackup((u) => !u);
                setFieldErrors({});
                setError(null);
              }}
              className="font-semibold"
            >
              {useBackup ? "Use the authenticator app instead" : "Use a backup code instead"}
            </Button>
            <Button variant="link" size="sm" onClick={cancelSignIn} disabled={busy !== null} className="font-semibold text-muted">
              Cancel sign-in
            </Button>
          </div>
        </form>
      ) : step === "enroll" ? (
        <div key="enroll" className="animate-fade-up space-y-4 motion-reduce:animate-none">
          <h2 ref={enrollHeadingRef} tabIndex={-1} className="sr-only">
            Set up your authenticator app
          </h2>
          <IdentityRow icon={<Smartphone className="h-5 w-5" />} label="Setting up two-factor for" value={challenge?.emailHint ?? "your administrator account"} />

          {setup ? (
            <TotpSetupCard qrDataUrl={setup.qrDataUrl} manualKey={setup.manualKey} issuer={setup.issuer} account={setup.account} />
          ) : setupError ? (
            <Alert
              tone="danger"
              action={
                <Button type="button" variant="outline" size="sm" onClick={retrySetup} className="shrink-0 self-start">
                  Try again
                </Button>
              }
            >
              {setupError}
            </Alert>
          ) : (
            <div className="space-y-3 rounded-card border border-line bg-white p-4" aria-busy="true">
              <span className="sr-only">Preparing your set-up code…</span>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-48 w-48 rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmEnrollment();
            }}
            className="space-y-4"
            noValidate
          >
            <Field label="6-digit code from the app" htmlFor="adminEnrollCode" required error={fieldErrors.code || undefined}>
              <OtpCodeField
                id="adminEnrollCode"
                name="code"
                value={enrollCode}
                onChange={(v) => {
                  setEnrollCode(v);
                  if (fieldErrors.code) setFieldErrors((fe) => ({ ...fe, code: "" }));
                }}
                onComplete={(c) => confirmEnrollment(c)}
                invalid={!!fieldErrors.code}
                defaultRevealed
                revealNoun="authenticator code"
                disabled={!setup}
                required
              />
            </Field>
            <Button type="submit" size="lg" fullWidth loading={busy === "verify"} disabled={!setup}>
              Verify and finish set-up
            </Button>
          </form>

          <p className="text-center">
            <Button variant="link" size="sm" onClick={cancelSignIn} disabled={busy !== null} className="font-semibold text-muted">
              Cancel sign-in
            </Button>
          </p>
        </div>
      ) : (
        <div ref={doneRef} tabIndex={-1} className="flex flex-col items-center gap-3 py-6 text-center outline-none">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success" aria-hidden>
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <p className="text-h4 text-navy">Verified — signing you in…</p>
          <Loader2 className="h-5 w-5 animate-spin text-muted motion-reduce:animate-none" aria-hidden />
        </div>
      )}

      <BackupCodesDialog
        open={backupCodes !== null}
        codes={backupCodes ?? NO_CODES}
        accountLabel={setup ? `${setup.issuer} — ${setup.account}` : undefined}
        fileName="eduskill-admin-backup-codes.txt"
        doneLabel="Continue to the admin panel"
        onDone={() => {
          if (pendingRedirect) go(pendingRedirect);
        }}
      />
    </AuthCard>
  );
}

/** "Code sent to in••@domain" — an app-style row naming the account, with an optional action. */
function IdentityRow({ icon, label, value, action }: { icon: React.ReactNode; label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-light text-orange" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption text-muted">{label}</p>
        <p className="truncate font-semibold text-ink">{value}</p>
      </div>
      {action}
    </div>
  );
}
