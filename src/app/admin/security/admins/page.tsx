import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission, tierLabel } from "@/lib/rbac/permissions";
import { adminTwoFactorRequired } from "@/lib/auth/policy";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { listAdministrators } from "@/server/security";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { SecurityTabs } from "@/components/admin/security/security-tabs";
import { TwoFactorBadge } from "@/components/admin/security/labels";
import { AdministratorActions } from "@/components/admin/security/security-actions";

export const metadata: Metadata = { title: "Administrators · Security Center" };

export default async function SecurityAdminsPage() {
  const user = await requireAdmin("security.view");
  const [admins, twoFactorRequired] = await Promise.all([listAdministrators(user), adminTwoFactorRequired()]);
  const superAdmin = user.role === "SUPER_ADMIN";
  const canViewStaff = hasPermission(user, "users.view");
  const active = admins.filter((a) => a.status === "ACTIVE");
  const without2fa = active.filter((a) => !a.twoFactor).length;
  const locked = admins.filter((a) => a.locked).length;

  return (
    <AdminListPage
      header={{
        title: "Administrators",
        mobileTitle: "Administrators",
        description: `${formatNumber(admins.length)} account${admins.length === 1 ? "" : "s"} can sign in to the admin${superAdmin ? "" : " (Super Admins are not listed)"}. ${
          superAdmin ? "You can sign anyone out, unlock, reset 2FA or disable an account." : "You can act only on staff below your own tier."
        }`,
      }}
      tabs={<SecurityTabs superAdmin={superAdmin} />}
    >
      {(without2fa > 0 || locked > 0) && (
        <div className="space-y-2">
          {without2fa > 0 && (
            <Alert tone={twoFactorRequired ? "warning" : "info"} title={`${formatNumber(without2fa)} active administrator${without2fa === 1 ? " has" : "s have"} no authenticator app`}>
              {twoFactorRequired
                ? "Two-factor authentication is required, so they will be asked to set one up at their next sign-in."
                : superAdmin
                  ? "Ask them to set one up from My account, or require it for everyone in Settings."
                  : "Ask them to set one up from My account → Security."}
            </Alert>
          )}
          {locked > 0 && (
            <Alert tone="warning" title={`${formatNumber(locked)} account${locked === 1 ? " is" : "s are"} locked`}>
              Too many wrong passwords or authenticator codes. The lock lifts by itself after a cooldown; unlock it sooner only once you are sure the attempts were theirs.
            </Alert>
          )}
        </div>
      )}

      {admins.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="No administrators to show" description="Staff accounts you are allowed to see appear here." />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Administrator</TH>
              <TH>Role / tier</TH>
              <TH>Status</TH>
              <TH>Two-factor</TH>
              <TH className="text-right">Sessions</TH>
              <TH>Last sign-in</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {admins.map((a) => (
              <TR key={a.id}>
                <TD mobile="full">
                  <span className="flex flex-wrap items-center gap-2">
                    {a.staffId && canViewStaff ? (
                      <Link href={`/admin/staff/${a.staffId}`} className="ring-focus rounded-sm font-semibold text-ink hover:text-navy hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{a.name}</span>
                    )}
                    {a.self && <Badge tone="info">You</Badge>}
                    {a.locked && (
                      <Badge tone="danger">
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                        Locked
                      </Badge>
                    )}
                  </span>
                  {a.email && <span className="block truncate text-caption text-muted">{a.email}</span>}
                  {!a.emailVerified && <span className="block text-caption text-warning-dark">Email not verified</span>}
                </TD>
                <TD>
                  <Badge tone={a.role === "SUPER_ADMIN" ? "navy" : "neutral"}>{a.roleName}</Badge>
                  {a.role !== "SUPER_ADMIN" && <span className="mt-1 block text-caption text-muted">Tier {a.tier} · {tierLabel(a.tier)}</span>}
                </TD>
                <TD>
                  <StatusBadge status={a.status} />
                </TD>
                <TD>
                  <TwoFactorBadge enabled={a.twoFactor} backupCodesLeft={a.twoFactor ? a.backupCodesLeft : undefined} />
                </TD>
                <TD className="text-right tabular-nums">{formatNumber(a.activeSessions)}</TD>
                <TD className="whitespace-nowrap text-muted tabular-nums">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never"}</TD>
                <TD mobile="actions" className="text-right">
                  <AdministratorActions
                    admin={{ id: a.id, staffId: a.staffId, name: a.name, status: a.status, self: a.self, locked: a.locked, twoFactor: a.twoFactor, backupCodesLeft: a.backupCodesLeft, activeSessions: a.activeSessions, canManage: a.canManage }}
                    superAdmin={superAdmin}
                    canViewStaff={canViewStaff}
                    twoFactorRequired={twoFactorRequired}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
