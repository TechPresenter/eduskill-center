import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CheckCircle2, FileClock, Lock, LogIn, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatNumber, pctOf } from "@/lib/utils";
import { alertsQuery, listSecurityAlerts, securityOverview } from "@/server/security";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { StatsCard } from "@/components/ui/stats";
import { ButtonLink } from "@/components/ui/button";
import { IconTile } from "@/components/admin/content/app-list";
import { SecurityTabs, SECURITY_BASE } from "@/components/admin/security/security-tabs";
import { SeverityBadge, alertTypeLabel } from "@/components/admin/security/labels";

export const metadata: Metadata = { title: "Security Center · Foundation Admin" };

const SEVERITY_TILE = { critical: "danger", warning: "warning", info: "info" } as const;

function OnOff({ on, onLabel, offLabel, offTone = "warning" }: { on: boolean; onLabel: string; offLabel: string; offTone?: "warning" | "danger" | "neutral" }) {
  return (
    <Badge tone={on ? "success" : offTone} dot>
      {on ? onLabel : offLabel}
    </Badge>
  );
}

export default async function SecurityOverviewPage() {
  const user = await requireAdmin("security.view");
  const superAdmin = user.role === "SUPER_ADMIN";
  const [o, latest] = await Promise.all([securityOverview(user), listSecurityAlerts(user, alertsQuery.parse({ status: "open", limit: "5" }))]);
  const canAudit = hasPermission(user, "audit_logs.view");
  const twoFaPct = pctOf(o.with2fa, o.admins);

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        title="Security Center"
        mobileTitle="Security"
        description="Who is signed in to the admin, how they signed in, and anything that needs a second look."
        actions={
          canAudit ? (
            <>
              <ButtonLink href="/admin/audit-logs?module=security" variant="outline" size="sm" className="pointer-coarse:min-h-11" leftIcon={<FileClock className="h-4 w-4" aria-hidden />}>
                Security audit log
              </ButtonLink>
              <ButtonLink href="/admin/audit-logs?module=auth" variant="outline" size="sm" className="pointer-coarse:min-h-11" leftIcon={<LogIn className="h-4 w-4" aria-hidden />}>
                Sign-in audit log
              </ButtonLink>
            </>
          ) : undefined
        }
      />
      <SecurityTabs superAdmin={superAdmin} />

      {superAdmin && o.issues.length > 0 && (
        <div className="space-y-2">
          {o.issues.map((issue) => (
            <Alert key={issue} tone="warning" title="Server configuration needs attention">
              {issue}
            </Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatsCard label="Active sessions" value={o.activeSessions} hint="Administrators signed in now" icon={<LogIn className="h-5 w-5" />} tone="navy" href={`${SECURITY_BASE}/sessions`} />
        <StatsCard label="Failed sign-ins" value={o.failed24h} hint="Last 24 hours" icon={<XCircle className="h-5 w-5" />} tone={o.failed24h > 0 ? "warning" : "success"} href={`${SECURITY_BASE}/activity?failedOnly=1`} />
        <StatsCard label="Open alerts" value={o.openAlerts} hint={o.criticalAlerts > 0 ? `${formatNumber(o.criticalAlerts)} critical` : "None critical"} icon={<BellRing className="h-5 w-5" />} tone={o.criticalAlerts > 0 ? "warning" : o.openAlerts > 0 ? "info" : "success"} href={`${SECURITY_BASE}/alerts`} />
        <StatsCard label="Using 2FA" value={`${formatNumber(o.with2fa)}/${formatNumber(o.admins)}`} hint={`${twoFaPct}% of active administrators`} icon={<ShieldCheck className="h-5 w-5" />} tone={o.admins > 0 && o.with2fa === o.admins ? "success" : "warning"} href={`${SECURITY_BASE}/admins`} />
        <StatsCard label="Locked accounts" value={o.locked} hint={o.locked > 0 ? "Too many wrong attempts" : "No lockouts"} icon={<Lock className="h-5 w-5" />} tone={o.locked > 0 ? "warning" : "success"} href={`${SECURITY_BASE}/admins`} className="col-span-2 md:col-span-1" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="Sign-in policy" description="How administrators sign in and how long a session lasts." />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <KeyValue label="Sign-in methods" value={o.policy.passwordLogin ? "Email code or password" : "Email code only (Passwordless Secure Login)"} />
            <KeyValue label="Two-factor authentication" value={<OnOff on={o.policy.require2fa} onLabel="Required for every administrator" offLabel="Optional" offTone="neutral" />} />
            <KeyValue label="Idle sign-out" value={`After ${formatNumber(o.policy.idleMinutes)} minutes without activity`} />
            <KeyValue label="Longest session" value={`${formatNumber(o.policy.sessionHours)} hours, then sign in again`} />
            <KeyValue
              label="Email delivery (sign-in codes)"
              value={
                <span className="flex flex-wrap items-center gap-2">
                  <OnOff on={o.policy.emailConfigured} onLabel="Configured" offLabel="Not configured" offTone="danger" />
                  {superAdmin && !o.policy.emailConfigured && (
                    <Link href="/admin/settings/comms" className="ring-focus inline-flex min-h-11 items-center rounded-md text-body-sm font-semibold text-navy underline md:min-h-0">
                      Set up email
                    </Link>
                  )}
                </span>
              }
            />
            <KeyValue label="Secret encryption key" value={<OnOff on={o.policy.encryptionConfigured} onLabel="Configured" offLabel="Missing" offTone="danger" />} />
            {superAdmin && (
              <p className="text-caption text-muted sm:col-span-2 xl:col-span-1">
                The 2FA requirement and alert emails are changed in{" "}
                <Link href={`${SECURITY_BASE}/settings`} className="ring-focus rounded-sm font-semibold text-navy underline">
                  Settings
                </Link>
                ; the rest is set in the server .env file.
              </p>
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Open alerts"
            description={o.openAlerts > 5 ? `The latest 5 of ${formatNumber(o.openAlerts)} alerts waiting for review.` : "Security events waiting for review."}
            action={
              <Link href={`${SECURITY_BASE}/alerts`} className="ring-focus inline-flex min-h-11 items-center rounded-md px-2 text-body-sm font-semibold text-orange hover:underline md:min-h-0">
                View all
              </Link>
            }
          />
          {latest.items.length === 0 ? (
            <EmptyState bare size="sm" icon={<CheckCircle2 className="h-6 w-6" />} title="Nothing to review" description="New-device and suspicious sign-ins, lockouts and 2FA changes appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {latest.items.map((a) => (
                <li key={a.id}>
                  <Link href={`${SECURITY_BASE}/alerts`} className="ring-focus flex items-start gap-3 px-4 py-3 tap-highlight-none transition-colors duration-micro hover:bg-surface/60 motion-reduce:transition-none sm:px-5">
                    <IconTile size="sm" tone={SEVERITY_TILE[a.severity as keyof typeof SEVERITY_TILE] ?? "neutral"}>
                      <ShieldAlert />
                    </IconTile>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm font-semibold break-words text-ink">{a.title}</span>
                      {a.detail && <span className="mt-0.5 line-clamp-2 block text-caption text-muted">{a.detail}</span>}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <SeverityBadge severity={a.severity} />
                        <Badge tone="neutral">{alertTypeLabel(a.type)}</Badge>
                        <span className="text-caption text-muted tabular-nums">{formatDateTime(a.createdAt)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
