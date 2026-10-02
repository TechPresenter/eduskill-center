"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Field, FormActions, FormSection } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { useApiForm } from "@/components/admin/shared/use-api-form";
import { useUnsavedChangesWarning } from "@/components/admin/content/use-unsaved";

export interface SecuritySettingsValues {
  require2faForAdmins: boolean;
  alertEmail: string;
  newDeviceAlerts: boolean;
}

/**
 * Super Admin security settings. Switching the 2FA requirement either way asks for confirmation first:
 * on, it immediately ends every administrator session that did not verify an authenticator; off, it
 * lowers the protection of every account.
 */
export function SecuritySettingsForm({ initial, selfHasTwoFactor, encryptionConfigured }: { initial: SecuritySettingsValues; selfHasTwoFactor: boolean; encryptionConfigured: boolean }) {
  const router = useRouter();
  const { loading, error, fieldErrors, submit, clearField } = useApiForm();
  const [values, setValues] = React.useState<SecuritySettingsValues>(initial);
  const [saved, setSaved] = React.useState<SecuritySettingsValues>(initial);
  const [confirm, setConfirm] = React.useState(false);

  const dirty = values.require2faForAdmins !== saved.require2faForAdmins || values.alertEmail.trim() !== saved.alertEmail || values.newDeviceAlerts !== saved.newDeviceAlerts;
  useUnsavedChangesWarning(dirty);

  const turningOn = values.require2faForAdmins && !saved.require2faForAdmins;
  const turningOff = !values.require2faForAdmins && saved.require2faForAdmins;
  // The API refuses to turn the requirement on without these; say so before anyone tries.
  const cannotRequire = !saved.require2faForAdmins && (!encryptionConfigured || !selfHasTwoFactor);

  const save = async () => {
    const res = await submit(() => api.put<SecuritySettingsValues>("/api/admin/security/settings", { ...values, alertEmail: values.alertEmail.trim() }), { errorTitle: "Security settings not saved" });
    setConfirm(false);
    if (res) {
      const next = { require2faForAdmins: res.require2faForAdmins, alertEmail: res.alertEmail, newDeviceAlerts: res.newDeviceAlerts };
      setSaved(next);
      setValues(next);
      toast.success("Security settings saved", turningOn ? "Two-factor authentication is now required for every administrator." : undefined);
      router.refresh();
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (turningOn || turningOff) setConfirm(true);
    else void save();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {error && Object.keys(fieldErrors).length === 0 && <Alert tone="danger">{error}</Alert>}

      <FormSection title="Two-factor authentication" description="An authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) as a second step after the email code or password.">
        <Checkbox
          id="sec-require2fa"
          checked={values.require2faForAdmins}
          onChange={(e) => setValues((v) => ({ ...v, require2faForAdmins: e.target.checked }))}
          disabled={loading || (cannotRequire && !values.require2faForAdmins)}
          label="Require an authenticator app (2FA) for every administrator"
          description="Applies to the Super Admin and all Foundation staff who can sign in to the admin."
        />
        {cannotRequire ? (
          <Alert tone="info" title="Not available yet">
            {!encryptionConfigured ? (
              "The server's DATA_ENCRYPTION_KEY is not set, so authenticator secrets cannot be stored. Ask the server administrator to set it in the .env file first."
            ) : (
              <>
                Set up your own authenticator app and save your backup codes first, so this switch can never lock you out.{" "}
                <Link href="/admin/account" className="ring-focus inline-flex min-h-11 items-center rounded-md font-semibold text-navy underline md:min-h-0">
                  Go to My account
                </Link>
              </>
            )}
          </Alert>
        ) : (
          <Alert tone="warning" title="What happens when this is on">
            <ul className="list-disc space-y-1 pl-5">
              <li>Every administrator session that did not verify an authenticator code ends immediately — including staff working right now.</li>
              <li>Administrators without an authenticator must set one up at their next sign-in before they can reach the admin.</li>
              <li>Nobody can turn their own 2FA off while this is on. A lost phone needs a backup code or a Super Admin reset.</li>
            </ul>
          </Alert>
        )}
      </FormSection>

      <FormSection title="Alerts" description="Warning and critical security events (new-device and suspicious sign-ins, lockouts, 2FA changes) are emailed to every Super Admin.">
        <Field label="Security alert email" htmlFor="sec-alert-email" error={fieldErrors.alertEmail} hint="Also receives every warning and critical alert, in addition to the Super Admins. Leave blank to email the Super Admins only.">
          <Input
            id="sec-alert-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.alertEmail}
            onChange={(e) => {
              setValues((v) => ({ ...v, alertEmail: e.target.value }));
              clearField("alertEmail");
            }}
            invalid={!!fieldErrors.alertEmail}
            maxLength={190}
            placeholder="info@eduskillindia.com"
            disabled={loading}
          />
        </Field>
        <Checkbox
          id="sec-new-device"
          checked={values.newDeviceAlerts}
          onChange={(e) => setValues((v) => ({ ...v, newDeviceAlerts: e.target.checked }))}
          disabled={loading}
          label="Email administrators when their account signs in from a new device"
          description="The administrator gets an email with the device, approximate network and time, so a sign-in they did not make is noticed quickly."
        />
      </FormSection>

      <FormActions>
        <Button type="button" variant="outline" onClick={() => setValues(saved)} disabled={!dirty || loading}>
          Discard changes
        </Button>
        <Button type="submit" loading={loading} disabled={!dirty} leftIcon={<Save className="h-4 w-4" aria-hidden />}>
          Save settings
        </Button>
      </FormActions>

      <ConfirmDialog
        open={confirm}
        onClose={() => !loading && setConfirm(false)}
        onConfirm={save}
        loading={loading}
        danger={turningOff}
        title={turningOn ? "Require 2FA for every administrator?" : "Stop requiring 2FA?"}
        description={
          turningOn
            ? "Administrator sessions that did not verify an authenticator code end now, and everyone without an authenticator must set one up at their next sign-in. Make sure your staff know before you switch this on."
            : "Administrators will be able to turn their own authenticator off, and new staff can sign in without one. Accounts that already use 2FA keep it."
        }
        confirmLabel={turningOn ? "Require 2FA" : "Stop requiring 2FA"}
      />
    </form>
  );
}
