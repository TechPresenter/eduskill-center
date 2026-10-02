import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { formatNumber } from "@/lib/utils";
import { getSecuritySettings } from "@/server/security";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecurityTabs } from "@/components/admin/security/security-tabs";
import { SecuritySettingsForm } from "@/components/admin/security/security-settings-form";

export const metadata: Metadata = { title: "Security Settings · Security Center" };

function EnvVar({ children }: { children: React.ReactNode }) {
  return <code className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-caption text-navy">{children}</code>;
}

export default async function SecuritySettingsPage() {
  const user = await requireSuperAdmin();
  const s = await getSecuritySettings();

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader title="Security settings" mobileTitle="Security settings" description="Super Admin only. Every change is recorded in the audit log and raises a security alert." />
      <SecurityTabs superAdmin />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardBody>
            <SecuritySettingsForm
              initial={{ require2faForAdmins: s.require2faForAdmins, alertEmail: s.alertEmail, newDeviceAlerts: s.newDeviceAlerts }}
              selfHasTwoFactor={user.security.twoFactorEnabled}
              encryptionConfigured={s.env.encryptionConfigured}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Server policy" description="Set in the server's .env file and applied on restart, so a compromised admin account can never weaken them. Ask the server administrator to change these." />
          <CardBody className="space-y-4">
            <KeyValue
              label="Password sign-in for administrators"
              value={
                <span className="block space-y-1">
                  <Badge tone={s.env.passwordLogin ? "neutral" : "success"}>{s.env.passwordLogin ? "Allowed" : "Off — email code only"}</Badge>
                  <span className="block text-caption font-normal text-muted">
                    <EnvVar>ADMIN_PASSWORD_LOGIN</EnvVar> on | off
                  </span>
                </span>
              }
            />
            <KeyValue
              label="Idle sign-out"
              value={
                <span className="block space-y-1">
                  <span className="block">{formatNumber(s.env.idleMinutes)} minutes</span>
                  <span className="block text-caption font-normal text-muted">
                    <EnvVar>ADMIN_IDLE_MINUTES</EnvVar> (5–480)
                  </span>
                </span>
              }
            />
            <KeyValue
              label="Longest session"
              value={
                <span className="block space-y-1">
                  <span className="block">{formatNumber(s.env.sessionHours)} hours</span>
                  <span className="block text-caption font-normal text-muted">
                    <EnvVar>ADMIN_SESSION_HOURS</EnvVar> (1–72)
                  </span>
                </span>
              }
            />
            <KeyValue
              label="Secret encryption key"
              value={
                <span className="block space-y-1">
                  <Badge tone={s.env.encryptionConfigured ? "success" : "danger"} dot>
                    {s.env.encryptionConfigured ? "Configured" : "Missing"}
                  </Badge>
                  <span className="block text-caption font-normal text-muted">
                    <EnvVar>DATA_ENCRYPTION_KEY</EnvVar> — needed for authenticator apps and encrypted SMTP passwords. The value is never shown here.
                  </span>
                </span>
              }
            />
            <KeyValue
              label="Trusted proxy hops"
              value={
                <span className="block space-y-1">
                  <span className="block">{formatNumber(s.env.trustedProxyHops)}</span>
                  <span className="block text-caption font-normal text-muted">
                    <EnvVar>TRUSTED_PROXY_HOPS</EnvVar> — how many reverse proxies sit in front of the app. Wrong values make sign-in IP addresses and rate limits unreliable.
                  </span>
                </span>
              }
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
