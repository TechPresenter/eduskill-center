"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { DataList } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { CopyButton } from "@/components/admin/shared/copy-button";
import { CodeInput } from "@/components/admin/account-security/code-input";
import { BackupCodesDialog } from "@/components/admin/account-security/backup-codes-dialog";

export interface TwoFactorStatusView {
  enabled: boolean;
  /** ISO string. */
  enabledAt: string | null;
  backupCodesRemaining: number;
  /** The Super Admin requires 2FA for every administrator (it cannot be turned off). */
  required: boolean;
  /** DATA_ENCRYPTION_KEY is configured, so authenticator secrets can be stored. */
  encryptionConfigured: boolean;
}

interface SetupPayload {
  qrDataUrl: string;
  manualKey: string;
  issuer: string;
  account: string;
}

const LOW_BACKUP_CODES = 3;

/**
 * My account → Security → Two-factor authentication: set up an authenticator app (QR + manual key +
 * confirming code), then backup codes shown once, new backup codes, and turning it off. The secret and
 * the codes only ever live in this component's state, and are dropped as soon as they are not needed.
 */
export function TwoFactorCard({ status, totalBackupCodes, passwordLogin }: { status: TwoFactorStatusView; totalBackupCodes: number; passwordLogin: boolean }) {
  const router = useRouter();
  const [codes, setCodes] = React.useState<string[] | null>(null);
  const [codesKey, setCodesKey] = React.useState(0);
  const [dialog, setDialog] = React.useState<null | "regenerate" | "disable">(null);

  const showCodes = (c: string[]) => {
    setCodesKey((k) => k + 1);
    setCodes(c);
  };

  const low = status.enabled && status.backupCodesRemaining <= LOW_BACKUP_CODES;

  return (
    <Card>
      <CardHeader
        title="Two-factor authentication"
        description="A 6-digit code from an authenticator app on your phone, asked for after your sign-in step."
        action={
          status.enabled ? (
            <Badge tone="success" dot>
              On
            </Badge>
          ) : (
            <Badge tone="warning" dot>
              Off
            </Badge>
          )
        }
      />

      {status.enabled ? (
        <>
          <CardBody className="space-y-4">
            {!status.encryptionConfigured && (
              <Alert tone="danger" title="Server encryption key missing">
                The server&apos;s DATA_ENCRYPTION_KEY is not configured, so authenticator codes cannot be checked right now. Ask the server administrator to restore it before you sign out.
              </Alert>
            )}
            <DataList
              variant="rows"
              items={[
                { label: "Turned on", value: status.enabledAt ? formatDateTime(status.enabledAt) : "—" },
                {
                  label: "Backup codes left",
                  value: (
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      {status.backupCodesRemaining} of {totalBackupCodes}
                      {low && <Badge tone={status.backupCodesRemaining === 0 ? "danger" : "warning"}>{status.backupCodesRemaining === 0 ? "None left" : "Running low"}</Badge>}
                    </span>
                  ),
                },
              ]}
            />
            {low && <Alert tone="warning">Create a new set of backup codes so you can still sign in if you lose your phone.</Alert>}
            {status.required && <p className="text-body-sm text-muted">The Super Admin requires two-factor authentication for every administrator, so it cannot be turned off.</p>}
          </CardBody>
          <CardFooter className="flex-col items-stretch sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="outline" size="sm" leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setDialog("regenerate")}>
              Create new backup codes
            </Button>
            {!status.required && (
              <Button type="button" variant="outline" size="sm" className="text-danger" leftIcon={<ShieldOff className="h-4 w-4" />} onClick={() => setDialog("disable")}>
                Turn off
              </Button>
            )}
          </CardFooter>
        </>
      ) : (
        <CardBody className="space-y-4">
          {!status.encryptionConfigured ? (
            <Alert tone="warning" title="Not available on this server">
              Authenticator secrets are stored encrypted with the server&apos;s DATA_ENCRYPTION_KEY, and that key is not configured. Set-up stays switched off until the server administrator sets it.
            </Alert>
          ) : (
            <SetupFlow passwordLogin={passwordLogin} onEnabled={showCodes} />
          )}
        </CardBody>
      )}

      <BackupCodesDialog
        key={codesKey}
        codes={codes}
        onDone={() => {
          setCodes(null);
          router.refresh();
        }}
      />
      <RegenerateCodesDialog
        open={dialog === "regenerate"}
        onClose={() => setDialog(null)}
        onCodes={(c) => {
          setDialog(null);
          showCodes(c);
        }}
      />
      <DisableTwoFactorDialog open={dialog === "disable"} onClose={() => setDialog(null)} />
    </Card>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-soft text-sm font-bold text-navy" aria-hidden>
      {n}
    </span>
  );
}

function SetupFlow({ passwordLogin, onEnabled }: { passwordLogin: boolean; onEnabled: (codes: string[]) => void }) {
  const [setup, setSetup] = React.useState<SetupPayload | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [code, setCode] = React.useState("");
  const { loading, error, fieldErrors, submit, setError, setFieldErrors } = useApiForm();
  const headingRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (setup) headingRef.current?.focus();
  }, [setup]);

  const start = async () => {
    setStarting(true);
    setError(null);
    setFieldErrors({});
    try {
      setSetup(await api.post<SetupPayload>("/api/admin/account/2fa/setup"));
      setCode("");
    } catch (err) {
      toast.error("Could not start set-up", errorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const cancel = () => {
    setSetup(null);
    setCode("");
    setError(null);
    setFieldErrors({});
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setFieldErrors({ code: "Enter the 6-digit code shown in the app" });
      return;
    }
    const res = await submit(() => api.post<{ backupCodes: string[] }>("/api/admin/account/2fa/confirm", { code }), { silent: true });
    setCode("");
    if (res) {
      setSetup(null);
      toast.success("Two-factor authentication is on", "Your other devices were signed out. Save your backup codes now.");
      onEnabled(res.backupCodes);
    }
  };

  if (!setup) {
    return (
      <>
        <p className="text-body-sm text-muted">
          Right now {passwordLogin ? "your email code or password" : "the code sent to your email"} is all it takes to reach the admin panel. Add an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) so that a compromised inbox alone is not enough.
        </p>
        <Button type="button" leftIcon={<ShieldCheck className="h-4 w-4" />} loading={starting} onClick={start}>
          Set up authenticator app
        </Button>
      </>
    );
  }

  const codeError = fieldErrors.code || error || undefined;
  return (
    <form onSubmit={confirm} className="space-y-5" noValidate>
      <ol className="space-y-5">
        <li className="flex gap-3">
          <StepNumber n={1} />
          <div className="min-w-0 flex-1">
            <p ref={headingRef} tabIndex={-1} className="font-semibold text-ink outline-none">
              Open your authenticator app
            </p>
            <p className="text-body-sm text-muted">Any app that supports time-based codes works. Tap &ldquo;Add account&rdquo; or &ldquo;+&rdquo;.</p>
          </div>
        </li>
        <li className="flex gap-3">
          <StepNumber n={2} />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="font-semibold text-ink">Scan this QR code</p>
            {/* A data: URL generated on the server for this set-up only — next/image would add nothing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt={`QR code that adds ${setup.issuer} (${setup.account}) to your authenticator app`} width={200} height={200} className="h-50 w-50 rounded-md border border-line bg-white p-2" />
            <div className="space-y-2">
              <p className="text-body-sm text-muted">Cannot scan it? Choose &ldquo;Enter a setup key&rdquo; in the app and type this key (time-based):</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 rounded-md bg-surface px-3 py-2 font-mono text-base font-semibold tracking-wider break-all text-ink select-all">{setup.manualKey}</code>
                <CopyButton text={setup.manualKey.replace(/\s/g, "")} label="Copy key" />
              </div>
              <p className="text-body-sm break-words text-muted">
                Account: <span className="font-medium text-ink">{setup.account}</span> · Issuer: <span className="font-medium text-ink">{setup.issuer}</span>
              </p>
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <StepNumber n={3} />
          <div className="min-w-0 flex-1">
            <Field label="Enter the 6-digit code from the app" required error={codeError}>
              <CodeInput
                value={code}
                onValueChange={(v) => {
                  setCode(v);
                  setFieldErrors({});
                  setError(null);
                }}
                invalid={!!codeError}
                className="sm:max-w-xs"
              />
            </Field>
          </div>
        </li>
      </ol>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={cancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading} leftIcon={<ShieldCheck className="h-4 w-4" />}>
          Turn on two-factor
        </Button>
      </div>
    </form>
  );
}

function RegenerateCodesDialog({ open, onClose, onCodes }: { open: boolean; onClose: () => void; onCodes: (codes: string[]) => void }) {
  const formId = React.useId();
  const [code, setCode] = React.useState("");
  const { loading, error, fieldErrors, submit, setError, setFieldErrors } = useApiForm();

  const close = () => {
    if (loading) return;
    setCode("");
    setError(null);
    setFieldErrors({});
    onClose();
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setFieldErrors({ code: "Enter the 6-digit code from your authenticator app" });
      return;
    }
    const res = await submit(() => api.post<{ backupCodes: string[] }>("/api/admin/account/2fa/backup-codes", { code }), { silent: true });
    setCode("");
    if (res) {
      toast.success("New backup codes created", "Your previous backup codes no longer work.");
      onCodes(res.backupCodes);
    }
  };

  const codeError = fieldErrors.code || error || undefined;
  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      hideClose
      initialFocus="first"
      title="Create new backup codes"
      description="Your current backup codes stop working as soon as the new set is created."
      footer={
        <>
          <Button type="button" variant="outline" size="md" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form={formId} size="md" loading={loading}>
            Create new codes
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={run} noValidate>
        <Field label="Code from your authenticator app" required error={codeError}>
          <CodeInput
            value={code}
            onValueChange={(v) => {
              setCode(v);
              setFieldErrors({});
              setError(null);
            }}
            invalid={!!codeError}
          />
        </Field>
      </form>
    </Modal>
  );
}

function DisableTwoFactorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const formId = React.useId();
  const [mode, setMode] = React.useState<"code" | "backup">("code");
  const [code, setCode] = React.useState("");
  const [backupCode, setBackupCode] = React.useState("");
  const { loading, error, fieldErrors, submit, setError, setFieldErrors } = useApiForm();

  const reset = () => {
    setCode("");
    setBackupCode("");
    setMode("code");
    setError(null);
    setFieldErrors({});
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "code" && code.length !== 6) {
      setFieldErrors({ code: "Enter the 6-digit code from your authenticator app" });
      return;
    }
    if (mode === "backup" && !/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(backupCode.trim().replace(/\s/g, ""))) {
      setFieldErrors({ backupCode: "Enter a backup code like ABCD-EFGH" });
      return;
    }
    const body = mode === "code" ? { code } : { backupCode: backupCode.trim() };
    const res = await submit(() => api.post<{ disabled: boolean }>("/api/admin/account/2fa/disable", body), { silent: true });
    setCode("");
    setBackupCode("");
    if (res) {
      toast.success("Two-factor authentication is off", "Signing in no longer asks for an authenticator code. You can turn it back on at any time.");
      reset();
      onClose();
      router.refresh();
    }
  };

  const fieldError = (mode === "code" ? fieldErrors.code : fieldErrors.backupCode) || error || undefined;
  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      hideClose
      initialFocus="first"
      title="Turn off two-factor authentication?"
      description="Signing in will no longer ask for an authenticator code, and your backup codes will be deleted. Confirm with a current code."
      footer={
        <>
          <Button type="button" variant="outline" size="md" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="danger" size="md" loading={loading}>
            Turn off two-factor
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={run} className="space-y-3" noValidate>
        {mode === "code" ? (
          <Field label="Code from your authenticator app" required error={fieldError}>
            <CodeInput
              value={code}
              onValueChange={(v) => {
                setCode(v);
                setFieldErrors({});
                setError(null);
              }}
              invalid={!!fieldError}
            />
          </Field>
        ) : (
          <Field label="Backup code" required error={fieldError} hint="One of the codes you saved when you turned on two-factor authentication.">
            <Input
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value.slice(0, 12));
                setFieldErrors({});
                setError(null);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCD-EFGH"
              invalid={!!fieldError}
              className="font-mono tracking-wider uppercase"
            />
          </Field>
        )}
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => {
            setMode(mode === "code" ? "backup" : "code");
            setError(null);
            setFieldErrors({});
          }}
        >
          {mode === "code" ? "Use a backup code instead" : "Use an authenticator code instead"}
        </Button>
      </form>
    </Modal>
  );
}
