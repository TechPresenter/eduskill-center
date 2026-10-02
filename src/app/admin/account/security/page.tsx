import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils";
import { deviceLabel } from "@/lib/auth/device";
import { adminIdleMinutes, adminPasswordLoginEnabled } from "@/lib/auth/policy";
import { BACKUP_CODE_COUNT } from "@/lib/auth/backup-codes";
import { twoFactorStatus } from "@/server/two-factor";
import { accountLoginHistory, accountSessions } from "@/app/admin/account/queries";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { ChangePasswordForm, RevokeOtherSessionsButton, SignOutSessionButton } from "@/app/admin/account/account-forms";
import { AccountHeading, AccountTabs } from "@/components/admin/account-security/account-tabs";
import { TwoFactorCard } from "@/components/admin/account-security/two-factor-card";
import { LoginEmailCard } from "@/components/admin/account-security/login-email-card";
import { isPartialSignIn, signInMethodLabel, signInReasonLabel } from "@/components/admin/account-security/labels";

export const metadata: Metadata = { title: "Security · My Account · Foundation Admin" };

const HISTORY_LIMIT = 20;

export default async function AccountSecurityPage() {
  const me = await requireAdmin();
  const status = await twoFactorStatus(me.id);
  const [sessions, history] = await Promise.all([accountSessions(me.id, me.sessionId, { needsMfa: status.enabled || status.required }), accountLoginHistory(me.id, HISTORY_LIMIT)]);
  const others = sessions.filter((s) => !s.current).length;
  const passwordLogin = adminPasswordLoginEnabled();
  const isSuper = me.role === "SUPER_ADMIN";
  const roleLabel = isSuper ? "Super Admin" : (me.staff?.roleName ?? "Foundation Staff");

  return (
    <div>
      <PageHeader
        title={<AccountHeading name={me.name} avatarUrl={me.avatarUrl} roleLabel={roleLabel} />}
        mobileTitle="Security"
        backHref="/admin/account"
        description="Two-factor authentication, how you sign in, and the devices signed in to your account."
      />
      <AccountTabs />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4">
          <TwoFactorCard
            status={{ ...status, enabledAt: status.enabledAt ? status.enabledAt.toISOString() : null }}
            totalBackupCodes={BACKUP_CODE_COUNT}
            passwordLogin={passwordLogin}
          />

          {passwordLogin ? (
            <Card>
              <CardHeader title="Change password" description="Changing your password signs you out of other devices." />
              <CardBody>
                <ChangePasswordForm />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Password" action={<Badge tone="neutral">Not used</Badge>} />
              <CardBody>
                <p className="text-body-sm text-muted">
                  Administrators sign in with <span className="font-semibold text-ink">Passwordless Secure Login</span>: a one-time verification code sent to your registered email address
                  {status.enabled ? ", followed by the code from your authenticator app" : ""}. Password sign-in is switched off for the admin panel, so there is no password to change here.
                </p>
              </CardBody>
            </Card>
          )}

          {isSuper && <LoginEmailCard currentEmail={me.email} />}
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Where you're signed in"
              description={`${sessions.length} active session${sessions.length === 1 ? "" : "s"}. A session ends after ${adminIdleMinutes()} minutes without activity.`}
              action={<RevokeOtherSessionsButton count={others} />}
            />
            {/* Card mode below md (TableWrap default); md:border-0 keeps the desktop table flush in the Card. */}
            <TableWrap className="rounded-none border-0 md:rounded-none md:border-0">
              <THead>
                <tr>
                  <TH>Device</TH>
                  <TH>Sign-in method</TH>
                  <TH>IP</TH>
                  <TH>Signed in</TH>
                  <TH>Last active</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {sessions.length === 0 && <EmptyRow colSpan={6}>No active sessions.</EmptyRow>}
                {sessions.map((s) => {
                  const device = deviceLabel(s.userAgent);
                  return (
                    <TR key={s.id}>
                      <TD primary>
                        <span className="flex flex-wrap items-center gap-2 font-medium">
                          {device}
                          {s.current && <Badge tone="success">This device</Badge>}
                        </span>
                        <span className="block truncate text-body-sm font-normal text-muted md:max-w-xs" title={s.userAgent ?? undefined}>
                          {s.userAgent ?? "—"}
                        </span>
                      </TD>
                      <TD label="Sign-in method" className="text-body-sm">
                        <span className="inline-flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
                          {signInMethodLabel(s.authMethod)}
                          {s.mfaAt && <Badge tone="info">2FA verified</Badge>}
                        </span>
                      </TD>
                      <TD label="IP" className="font-mono text-body-sm break-all md:whitespace-nowrap md:break-normal">
                        {s.ip ?? "—"}
                      </TD>
                      <TD label="Signed in" className="text-muted md:whitespace-nowrap">
                        {formatDateTime(s.createdAt)}
                      </TD>
                      <TD label="Last active" className="text-muted md:whitespace-nowrap">
                        {formatDateTime(s.lastSeenAt)}
                      </TD>
                      {s.current ? (
                        <TD mobile="hidden" className="text-right text-body-sm text-muted">
                          <span aria-hidden>—</span>
                          <span className="sr-only">This session — use Log out to end it</span>
                        </TD>
                      ) : (
                        <TD actions className="text-right">
                          <SignOutSessionButton id={s.id} device={device} />
                        </TD>
                      )}
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          </Card>

          <Card>
            <CardHeader title="Recent sign-ins" description={`Your latest ${HISTORY_LIMIT} sign-in attempts. If you do not recognise one, sign out all other devices and tell the Super Admin.`} />
            <TableWrap className="rounded-none border-0 md:rounded-none md:border-0">
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Result</TH>
                  <TH>Method</TH>
                  <TH>Device</TH>
                  <TH>IP</TH>
                </tr>
              </THead>
              <TBody>
                {history.length === 0 && <EmptyRow colSpan={5}>No sign-in attempts recorded yet.</EmptyRow>}
                {history.map((h) => {
                  const reason = signInReasonLabel(h.reason);
                  return (
                    <TR key={h.id}>
                      <TD primary className="md:whitespace-nowrap">
                        {formatDateTime(h.createdAt)}
                      </TD>
                      <TD label="Result">
                        {h.success && isPartialSignIn(h.reason) ? (
                          <Badge tone="info" dot className="whitespace-normal">
                            {reason}
                          </Badge>
                        ) : (
                          <Badge tone={h.success ? "success" : "danger"} dot className="whitespace-normal">
                            {h.success ? "Signed in" : `Failed${reason ? ` · ${reason}` : ""}`}
                          </Badge>
                        )}
                      </TD>
                      <TD label="Method" className="text-body-sm">
                        {signInMethodLabel(h.method)}
                      </TD>
                      <TD label="Device" className="text-body-sm">
                        <span className="inline-flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
                          <span className="text-muted">{deviceLabel(h.userAgent)}</span>
                          {h.newDevice && <Badge tone="warning">New device</Badge>}
                          {h.suspicious && <Badge tone="danger">Suspicious</Badge>}
                        </span>
                      </TD>
                      <TD label="IP" className="font-mono text-body-sm break-all md:whitespace-nowrap md:break-normal">
                        {h.ip ?? "—"}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          </Card>
        </div>
      </div>
    </div>
  );
}
