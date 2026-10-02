import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CheckCircle2, SearchX, ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { alertsQuery, listSecurityAlerts } from "@/server/security";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { IconTile } from "@/components/admin/content/app-list";
import { SecurityTabs, SECURITY_BASE } from "@/components/admin/security/security-tabs";
import { SeverityBadge, alertTypeLabel } from "@/components/admin/security/labels";
import { AckAlertButton, AckAllAlertsButton } from "@/components/admin/security/security-actions";

export const metadata: Metadata = { title: "Security Alerts · Security Center" };

const BASE = `${SECURITY_BASE}/alerts`;
const SEVERITY_TILE = { critical: "danger", warning: "warning", info: "info" } as const;

export default async function SecurityAlertsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("security.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(alertsQuery, sp);
  const [data, open] = await Promise.all([listSecurityAlerts(user, q), listSecurityAlerts(user, alertsQuery.parse({ status: "open", limit: "1" }))]);
  const superAdmin = user.role === "SUPER_ADMIN";
  const canManage = hasPermission(user, "security.manage");
  const openCount = open.meta.total;
  const filtered = Object.keys(sp).some((k) => k !== "page");
  const statusLabel = q.status === "open" ? "open" : q.status === "acknowledged" ? "reviewed" : "";

  return (
    <AdminListPage
      header={{
        title: "Security alerts",
        mobileTitle: "Alerts",
        description: `${formatNumber(openCount)} open alert${openCount === 1 ? "" : "s"}. Warning and critical alerts are also emailed to the Super Admins. Review each one, then mark it reviewed.`,
        actions: canManage && openCount > 0 ? <AckAllAlertsButton count={openCount} /> : undefined,
      }}
      tabs={<SecurityTabs superAdmin={superAdmin} />}
      filters={
        <FilterBar>
          <SelectFilter
            name="status"
            label="Status"
            options={[
              { value: "acknowledged", label: "Reviewed" },
              { value: "all", label: "All alerts" },
            ]}
            placeholder="Open (needs review)"
          />
          <SelectFilter
            name="severity"
            label="Severity"
            options={[
              { value: "critical", label: "Critical" },
              { value: "warning", label: "Warning" },
              { value: "info", label: "Info" },
            ]}
            placeholder="Any severity"
          />
        </FilterBar>
      }
      pagination={<Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref(BASE, sp)} />}
    >
      {data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            size="sm"
            icon={<SearchX className="h-6 w-6" />}
            title={`No ${statusLabel ? `${statusLabel} ` : ""}alerts match`}
            description="Try another status or severity."
            action={
              <ButtonLink href={BASE} variant="outline" size="sm">
                Show open alerts
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="All clear" description="No alert is waiting for review. New-device and suspicious sign-ins, lockouts, 2FA changes and failed sign-in code emails appear here." />
        )
      ) : (
        <ul aria-label="Security alerts" className="card divide-y divide-line overflow-hidden">
          {data.items.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-5">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <IconTile size="sm" tone={a.acknowledgedAt ? "neutral" : (SEVERITY_TILE[a.severity as keyof typeof SEVERITY_TILE] ?? "neutral")}>
                  {a.acknowledgedAt ? <CheckCircle2 /> : a.severity === "info" ? <BellRing /> : <ShieldAlert />}
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold break-words text-ink">{a.title}</p>
                  {a.detail && <p className="mt-0.5 text-body-sm break-words whitespace-pre-line text-muted">{a.detail}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <SeverityBadge severity={a.severity} />
                    <Badge tone="neutral">{alertTypeLabel(a.type)}</Badge>
                    {a.acknowledgedAt && (
                      <Badge tone="success" title={`Reviewed ${formatDateTime(a.acknowledgedAt)}`}>
                        Reviewed
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-caption text-muted">
                    <span className="tabular-nums">{formatDateTime(a.createdAt)}</span>
                    {a.user && (
                      <span>
                        ·{" "}
                        <Link href={`${SECURITY_BASE}/activity?userId=${a.user.id}`} className="ring-focus rounded-sm font-semibold text-navy hover:underline">
                          {a.user.name}
                        </Link>
                      </span>
                    )}
                    {a.device && <span>· {a.device}</span>}
                    {a.ip && a.ip !== "—" && <span className="font-mono">· {a.ip}</span>}
                  </p>
                </div>
              </div>
              {canManage && !a.acknowledgedAt && (
                <div className="pl-11 sm:shrink-0 sm:pl-0">
                  <AckAlertButton id={a.id} title={a.title} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminListPage>
  );
}
