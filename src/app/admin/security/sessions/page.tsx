import type { Metadata } from "next";
import { LogIn, MonitorSmartphone } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { listAdminSessions, listAdministrators, sessionsQuery } from "@/server/security";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, Pagination } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { SecurityTabs, SECURITY_BASE } from "@/components/admin/security/security-tabs";
import { methodLabel } from "@/components/admin/security/labels";
import { RevokeSessionButton } from "@/components/admin/security/security-actions";

export const metadata: Metadata = { title: "Admin Sessions · Security Center" };

const BASE = `${SECURITY_BASE}/sessions`;

export default async function SecuritySessionsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("security.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(sessionsQuery, sp);
  const [data, admins] = await Promise.all([listAdminSessions(user, q), listAdministrators(user)]);
  const superAdmin = user.role === "SUPER_ADMIN";
  const canManage = hasPermission(user, "security.manage");
  const manageable = new Map(admins.map((a) => [a.id, a.canManage]));
  // Mirrors the service rule (it enforces it again): never your current session; staff with
  // security.manage act on their own other sessions and on lower tiers only.
  const canRevoke = (row: (typeof data.items)[number]) => !row.current && canManage && (superAdmin || row.user.id === user.id || manageable.get(row.user.id) === true);
  const selected = q.userId ? admins.find((a) => a.id === q.userId) : undefined;

  return (
    <AdminListPage
      header={{
        title: "Active sessions",
        mobileTitle: "Sessions",
        description: selected
          ? `${formatNumber(data.meta.total)} active session${data.meta.total === 1 ? "" : "s"} of ${selected.name}.`
          : `${formatNumber(data.meta.total)} administrator session${data.meta.total === 1 ? " is" : "s are"} active. Sign out any device you do not recognise.`,
      }}
      tabs={<SecurityTabs superAdmin={superAdmin} />}
      filters={
        <FilterBar>
          <SelectFilter name="userId" label="Administrator" options={admins.map((a) => ({ value: a.id, label: `${a.name}${a.self ? " (you)" : ""}` }))} placeholder="Everyone" className="min-w-[14rem]" />
        </FilterBar>
      }
      pagination={<Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref(BASE, sp)} />}
    >
      {data.items.length === 0 ? (
        <EmptyState
          icon={<MonitorSmartphone className="h-7 w-7" />}
          title={selected ? `${selected.name} is not signed in anywhere` : "No active sessions"}
          description="Sessions appear here while an administrator is signed in. They end on sign-out, after the idle limit, or when the maximum session length is reached."
          action={
            q.userId ? (
              <ButtonLink href={BASE} variant="outline" size="sm">
                Show everyone
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Administrator</TH>
              <TH>Device</TH>
              <TH>IP address</TH>
              <TH>Signed in with</TH>
              <TH>2FA</TH>
              <TH>Signed in</TH>
              <TH>Last active</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {data.items.map((s) => (
              <TR key={s.id} className={s.current ? "bg-info-light/40" : undefined}>
                <TD mobile="full">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{s.user.name}</span>
                    {s.user.role === "SUPER_ADMIN" && <Badge tone="navy">Super Admin</Badge>}
                    {s.current && <Badge tone="info">This device</Badge>}
                  </span>
                  {s.user.email && <span className="block truncate text-caption text-muted">{s.user.email}</span>}
                </TD>
                <TD>{s.device}</TD>
                <TD className="font-mono text-caption">{s.ip}</TD>
                <TD>{methodLabel(s.authMethod)}</TD>
                <TD>
                  {s.twoFactor ? (
                    <Badge tone="success" dot>
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Not used</Badge>
                  )}
                </TD>
                <TD className="whitespace-nowrap text-muted tabular-nums">{formatDateTime(s.createdAt)}</TD>
                <TD className="whitespace-nowrap tabular-nums">
                  {formatDateTime(s.lastSeenAt)}
                  <span className="block text-caption text-muted">expires {formatDateTime(s.expiresAt)}</span>
                </TD>
                <TD mobile="actions" className="text-right">
                  {canRevoke(s) ? (
                    <RevokeSessionButton sessionId={s.id} userName={s.user.name} device={s.device} self={s.user.id === user.id} />
                  ) : s.current ? (
                    <span className="inline-flex items-center gap-1.5 text-caption text-muted">
                      <LogIn className="h-3.5 w-3.5" aria-hidden />
                      Use Log out
                    </span>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
