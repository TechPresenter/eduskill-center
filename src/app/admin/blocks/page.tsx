import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { listBlocks, locationListSchema } from "@/server/locations";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { FilterBar, LocationFilter, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { BlockRowActions, BulkAddBlocksButton } from "@/components/admin/locations/block-actions";

export const metadata: Metadata = { title: "Blocks · Foundation Admin" };

export default async function BlocksPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("locations.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(locationListSchema, { limit: "50", ...sp });
  const data = await listBlocks(q);
  const canCreate = hasPermission(user, "locations.create");
  const canUpdate = hasPermission(user, "locations.update");
  const canDelete = hasPermission(user, "locations.delete");

  return (
    <div>
      <PageHeader
        title="Blocks"
        mobileTitle="Blocks"
        backHref="/admin/locations"
        description={`${formatNumber(data.meta.total)} block${data.meta.total === 1 ? "" : "s"} · every training center is registered in a block.`}
        breadcrumbs={[{ label: "Locations", href: "/admin/locations" }, { label: "Blocks" }]}
        actions={<BulkAddBlocksButton disabled={!canCreate} initial={{ stateId: q.stateId, districtId: q.districtId }} />}
      />

      <FilterBar>
        <SearchInput placeholder="Search by block name or code" />
        <LocationFilter depth="district" />
        <SelectFilter
          name="active"
          label="Status"
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Inactive" },
          ]}
        />
      </FilterBar>

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
              <TD mobile="full">
                {b.name}
                <span className="block text-sm font-normal text-muted md:hidden">
                  {b.district.name}, {b.district.state.name}
                  {b.code ? <span className="font-mono"> · {b.code}</span> : null}
                </span>
              </TD>
              <TD label="Code" mobile="hidden" className="font-mono text-xs">
                {b.code ?? <span className="text-muted">—</span>}
              </TD>
              <TD label="District" mobile="hidden">
                {b.district.name} <span className="font-mono text-xs text-muted">({b.district.state.code}-{b.district.code})</span>
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
              <TD label="Status">
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
      <Pagination className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref("/admin/blocks", sp)} />
    </div>
  );
}
