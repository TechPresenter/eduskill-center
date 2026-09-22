import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { listBlocks, locationListSchema } from "@/server/locations";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, LocationFilter, SearchInput } from "@/components/admin/shared/filter-bar";
import { ExportButton } from "@/components/admin/shared/export-button";
import { flattenParams, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { Pager } from "@/components/admin/pickers/pager";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { IconTile, RowLead } from "@/components/admin/locations/list-kit";
import { BlockRowActions, BulkAddBlocksButton } from "@/components/admin/locations/block-actions";

export const metadata: Metadata = { title: "Blocks · Foundation Admin" };

export default async function BlocksPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("locations.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(locationListSchema, { limit: "50", ...sp });
  const [data, activeCount, inactiveCount] = await Promise.all([
    listBlocks(q),
    listBlocks({ ...q, active: true, page: 1, limit: 1 }).then((r) => r.meta.total),
    listBlocks({ ...q, active: false, page: 1, limit: 1 }).then((r) => r.meta.total),
  ]);
  const canCreate = hasPermission(user, "locations.create");
  const canUpdate = hasPermission(user, "locations.update");
  const canDelete = hasPermission(user, "locations.delete");
  /** First-run state: nothing exists yet, as opposed to "your filters matched nothing". */
  const isEmpty = data.meta.total === 0 && !Object.keys(sp).some((k) => k !== "page");

  return (
    <AdminListPage
      header={{
        title: "Blocks",
        mobileTitle: "Blocks",
        backHref: "/admin/locations",
        description: `${formatNumber(data.meta.total)} block${data.meta.total === 1 ? "" : "s"} · every training center is registered in a block.`,
        breadcrumbs: [{ label: "Locations", href: "/admin/locations" }, { label: "Blocks" }],
        actions: (
          <>
            <ExportButton href="/api/admin/reports/blocks" params={{ stateId: q.stateId, districtId: q.districtId }} disabled={!hasPermission(user, "reports.export")} />
            <BulkAddBlocksButton disabled={!canCreate} initial={{ stateId: q.stateId, districtId: q.districtId }} />
          </>
        ),
      }}
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="active"
            keep={["q", "stateId", "districtId", "blockId"]}
            items={[
              { value: "", label: "All", count: activeCount + inactiveCount },
              { value: "true", label: "Active", count: activeCount },
              { value: "false", label: "Inactive", count: inactiveCount },
            ]}
          />
        )
      }
      filters={
        isEmpty ? undefined : (
          <FilterBar preserve={["active"]}>
            <SearchInput placeholder="Search by block name or code" />
            <LocationFilter depth="district" />
          </FilterBar>
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/blocks" params={sp} />}
    >
      {isEmpty ? (
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title="No blocks yet"
          description="Training centres are always registered at block level. Add several at once with the button above."
          action={<ButtonLink href="/admin/districts" variant="outline">Review districts first</ButtonLink>}
        />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Block</TH>
              <TH>Code</TH>
              <TH>District</TH>
              <TH>State</TH>
              <TH className="text-right">Centers</TH>
              <TH className="text-right">Students</TH>
              <TH>Status</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={8}>No blocks match these filters. Use “Add blocks” to add several at once.</EmptyRow>}
            {data.items.map((b) => (
              <TR key={b.id}>
                <TD primary>
                  <RowLead
                    lead={<IconTile icon={<Building2 />} tone={b.isActive ? "lavender" : "neutral"} />}
                    title={b.name}
                    meta={
                      <span className="md:hidden">
                        {b.district.name}, {b.district.state.name}
                        {b.code ? <span className="font-mono font-semibold"> · {b.code}</span> : null}
                      </span>
                    }
                    trailing={!b.isActive ? <Badge tone="neutral">Inactive</Badge> : undefined}
                  />
                </TD>
                <TD label="Code" mobile="hidden" className="font-mono text-caption">
                  {b.code ?? <span className="text-muted">—</span>}
                </TD>
                <TD label="District" mobile="hidden">
                  {b.district.name} <span className="font-mono text-caption text-muted">({b.district.state.code}-{b.district.code})</span>
                </TD>
                <TD label="State" mobile="hidden">
                  {b.district.state.name}
                </TD>
                <TD label="Centers" className="text-right tabular-nums">
                  {formatNumber(b._count.centers)}
                </TD>
                <TD label="Students" className="text-right tabular-nums">
                  {formatNumber(b._count.students)}
                </TD>
                <TD label="Status" mobile="hidden">
                  <Badge tone={b.isActive ? "success" : "neutral"} dot>
                    {b.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                <TD mobile="actions" className="text-right">
                  {(canUpdate || canDelete) && (
                    <BlockRowActions
                      block={{ id: b.id, name: b.name, code: b.code, isActive: b.isActive, sortOrder: b.sortOrder, districtName: b.district.name, stateName: b.district.state.name, centers: b._count.centers, linked: b._count.students }}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                    />
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
