import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { listBlocks, locationListSchema } from "@/server/locations";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
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
        actions: <BulkAddBlocksButton disabled={!canCreate} initial={{ stateId: q.stateId, districtId: q.districtId }} />,
      }}
      filters={
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
      }
      pagination={isEmpty ? undefined : <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref("/admin/blocks", sp)} />}
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
                <TD mobile="full">
                  {b.name}
                  <span className="block text-body-sm font-normal text-muted md:hidden">
                    {b.district.name}, {b.district.state.name}
                    {b.code ? <span className="font-mono"> · {b.code}</span> : null}
                  </span>
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
      )}
    </AdminListPage>
  );
}
