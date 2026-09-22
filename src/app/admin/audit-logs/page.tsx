import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { formatNumber, titleCase } from "@/lib/utils";
import { auditFilterOptions, auditListSchema, listAuditLogs } from "@/app/admin/audit-logs/queries";
import { Input } from "@/components/ui/input";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { DateRangeFilter, FilterBar, FilterLabel, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { Pager } from "@/components/admin/pickers/pager";
import { AuditTable } from "@/components/admin/audit/audit-table";

export const metadata: Metadata = { title: "Audit Logs · Foundation Admin" };

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireAdmin("audit_logs.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(auditListSchema, { limit: "50", ...sp });
  const [data, options] = await Promise.all([listAuditLogs(q), auditFilterOptions()]);

  return (
    <AdminListPage
      header={{
        title: "Audit logs",
        mobileTitle: "Audit logs",
        description: `${formatNumber(data.meta.total)} entr${data.meta.total === 1 ? "y" : "ies"} match. Every admin action is recorded with who, what, when and the before/after values — open an entry to see what changed.`,
      }}
      filters={
        <FilterBar>
          <SearchInput placeholder="Description, actor, record ID or IP" />
          <SelectFilter name="module" label="Module" options={options.modules.map((m) => ({ value: m, label: titleCase(m) }))} placeholder="All modules" />
          <SelectFilter name="action" label="Action" options={options.actions.map((a) => ({ value: a, label: a }))} placeholder="All actions" />
          <SelectFilter name="userId" label="User" options={options.users.map((u) => ({ value: u.id, label: `${u.name} (${u.role === "SUPER_ADMIN" ? "Super Admin" : "Staff"})` }))} placeholder="Anyone" className="min-w-[13rem]" />
          <SelectFilter name="recordType" label="Record type" options={options.recordTypes.map((r) => ({ value: r, label: r }))} placeholder="All types" />
          <div className="min-w-0 md:min-w-[12rem]">
            <FilterLabel htmlFor="filter-recordId">Record ID</FilterLabel>
            <Input id="filter-recordId" name="recordId" defaultValue={sp.recordId ?? ""} placeholder="Exact ID" className="font-mono" />
          </div>
          <DateRangeFilter />
        </FilterBar>
      }
      pagination={<Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/audit-logs" params={sp} />}
    >
      <AuditTable
        rows={data.items.map((l) => ({
          id: l.id,
          createdAt: l.createdAt.toISOString(),
          actorName: l.actorName,
          actorRole: l.actorRole,
          userId: l.userId,
          action: l.action,
          module: l.module,
          recordType: l.recordType,
          recordId: l.recordId,
          description: l.description,
          oldValue: l.oldValue,
          newValue: l.newValue,
          ip: l.ip,
          userAgent: l.userAgent,
        }))}
      />
    </AdminListPage>
  );
}
