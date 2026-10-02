import type { Metadata } from "next";
import { History, SearchX } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { activityQuery, listAdministrators, listLoginActivity } from "@/server/security";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, Pagination } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, FilterLabel, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { SecurityTabs, SECURITY_BASE } from "@/components/admin/security/security-tabs";
import { methodLabel, reasonLabel } from "@/components/admin/security/labels";

export const metadata: Metadata = { title: "Sign-in Activity · Security Center" };

const BASE = `${SECURITY_BASE}/activity`;

export default async function SecurityActivityPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("security.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(activityQuery, { limit: "50", ...sp });
  const [data, admins] = await Promise.all([listLoginActivity(user, q), listAdministrators(user)]);
  const superAdmin = user.role === "SUPER_ADMIN";
  const filtered = Object.keys(sp).some((k) => k !== "page");

  return (
    <AdminListPage
      header={{
        title: "Sign-in activity",
        mobileTitle: "Sign-in activity",
        description: `${formatNumber(data.meta.total)} sign-in attempt${data.meta.total === 1 ? "" : "s"} by administrators${filtered ? " match" : ""}. New devices and suspicious sign-ins are flagged.${superAdmin ? "" : " IP addresses are partly hidden."}`,
      }}
      tabs={<SecurityTabs superAdmin={superAdmin} />}
      filters={
        <FilterBar>
          <SelectFilter name="userId" label="Administrator" options={admins.map((a) => ({ value: a.id, label: `${a.name}${a.self ? " (you)" : ""}` }))} placeholder="Everyone" className="min-w-[14rem]" />
          <SelectFilter name="failedOnly" label="Result" options={[{ value: "1", label: "Failed only" }]} placeholder="All attempts" />
          <SelectFilter name="suspiciousOnly" label="Risk" options={[{ value: "1", label: "Suspicious only" }]} placeholder="All sign-ins" />
          <div className="min-w-0 md:min-w-[10rem]">
            <FilterLabel htmlFor="filter-from">From</FilterLabel>
            {/* `key` re-mounts the uncontrolled field when Reset or Back changes the URL. */}
            <Input key={`from-${sp.from ?? ""}`} id="filter-from" name="from" type="date" defaultValue={sp.from ?? ""} max={sp.to || undefined} />
          </div>
          <div className="min-w-0 md:min-w-[10rem]">
            <FilterLabel htmlFor="filter-to">To</FilterLabel>
            <Input key={`to-${sp.to ?? ""}`} id="filter-to" name="to" type="date" defaultValue={sp.to ?? ""} min={sp.from || undefined} />
          </div>
        </FilterBar>
      }
      pagination={<Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref(BASE, sp)} />}
    >
      {data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            size="sm"
            icon={<SearchX className="h-6 w-6" />}
            title="No sign-ins match"
            description="Try another administrator, result or date range."
            action={
              <ButtonLink href={BASE} variant="outline" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState icon={<History className="h-7 w-7" />} title="No sign-ins recorded yet" description="Every administrator sign-in attempt — successful or not — is listed here with the device and network it came from." />
        )
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>Account</TH>
              <TH>Result</TH>
              <TH>Method</TH>
              <TH>Device</TH>
              <TH>IP address</TH>
            </tr>
          </THead>
          <TBody>
            {data.items.map((r) => {
              const reason = reasonLabel(r.reason);
              return (
                <TR key={r.id} className={r.suspicious ? "bg-danger-light/40" : undefined}>
                  <TD className="whitespace-nowrap tabular-nums">{formatDateTime(r.createdAt)}</TD>
                  <TD mobile="full">
                    {r.user ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{r.user.name}</span>
                        {r.user.role === "SUPER_ADMIN" && <Badge tone="navy">Super Admin</Badge>}
                      </span>
                    ) : (
                      <span className="block">
                        <span className="block break-all text-ink">{r.identifier ?? "—"}</span>
                        <span className="block text-caption text-muted">No matching administrator</span>
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={r.success ? "success" : "danger"} dot>
                      {r.success ? "Signed in" : "Failed"}
                    </Badge>
                    {!r.success && reason && <span className="mt-1 block text-caption text-muted">{reason}</span>}
                  </TD>
                  <TD>{methodLabel(r.method)}</TD>
                  <TD>
                    <span className="block">{r.device}</span>
                    {(r.newDevice || r.suspicious) && (
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {r.newDevice && <Badge tone="info">New device</Badge>}
                        {r.suspicious && <Badge tone="danger">Suspicious</Badge>}
                      </span>
                    )}
                  </TD>
                  <TD className="font-mono text-caption">{r.ip}</TD>
                </TR>
              );
            })}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
