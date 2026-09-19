import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { allStates, listDistricts, locationListSchema } from "@/server/locations";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { FilterBar, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { DistrictRowActions, NewDistrictButton } from "@/components/admin/locations/district-actions";

export const metadata: Metadata = { title: "Districts · Foundation Admin" };

export default async function DistrictsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("locations.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(locationListSchema, { limit: "50", ...sp });
  const [data, states] = await Promise.all([listDistricts(q), allStates()]);
  const stateOptions = states.map((s) => ({ value: s.id, label: `${s.name} (${s.code})${s.isActive ? "" : " · inactive"}` }));
  const canCreate = hasPermission(user, "locations.create");
  const canUpdate = hasPermission(user, "locations.update");
  const canDelete = hasPermission(user, "locations.delete");
  const currentState = states.find((s) => s.id === q.stateId);

  return (
    <div>
      <PageHeader
        title={currentState ? `Districts of ${currentState.name}` : "Districts"}
        mobileTitle="Districts"
        backHref="/admin/locations"
        description={`${formatNumber(data.meta.total)} district${data.meta.total === 1 ? "" : "s"} · the 3-character district code is embedded in center codes and is locked once a center uses it.`}
        breadcrumbs={[{ label: "Locations", href: "/admin/locations" }, { label: "Districts" }]}
        actions={<NewDistrictButton states={stateOptions} defaultStateId={q.stateId} disabled={!canCreate} />}
      />

      <FilterBar>
        <SearchInput placeholder="Search by name or code" />
        <SelectFilter name="stateId" label="State" options={stateOptions} placeholder="All states" className="min-w-[14rem]" />
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
            <TH>District</TH>
            <TH>Code</TH>
            <TH>State</TH>
            <TH className="text-right">Blocks</TH>
            <TH className="text-right">Centers</TH>
            <TH className="text-right">Students</TH>
            <TH>Status</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {data.items.length === 0 && <EmptyRow colSpan={8}>No districts match these filters.</EmptyRow>}
          {data.items.map((d) => (
            <TR key={d.id}>
              <TD mobile="full">
                <Link href={`/admin/blocks?stateId=${d.stateId}&districtId=${d.id}`} className="block tap-highlight-none md:inline">
                  <span className="font-semibold text-navy md:font-medium md:hover:underline">{d.name}</span>
                  <span className="block font-mono text-xs font-normal text-muted md:hidden">
                    {d.state.code}-{d.code} · {d.state.name}
                  </span>
                </Link>
              </TD>
              <TD label="Code" mobile="hidden" className="font-mono text-xs font-semibold">
                {d.state.code}-{d.code}
              </TD>
              <TD label="State" mobile="hidden">
                {d.state.name}
              </TD>
              <TD label="Blocks" className="text-right tabular-nums">
                {formatNumber(d._count.blocks)}
              </TD>
              <TD label="Centers" className="text-right tabular-nums">
                {formatNumber(d._count.centers)}
              </TD>
              <TD label="Students" className="text-right tabular-nums">
                {formatNumber(d._count.students)}
              </TD>
              <TD label="Status">
                <Badge tone={d.isActive ? "success" : "neutral"} dot>
                  {d.isActive ? "Active" : "Inactive"}
                </Badge>
              </TD>
              <TD mobile="actions" className="text-right">
                {(canUpdate || canDelete) && (
                  <DistrictRowActions
                    district={{ id: d.id, stateId: d.stateId, name: d.name, code: d.code, isActive: d.isActive, sortOrder: d.sortOrder, centers: d._count.centers, blocks: d._count.blocks, linked: d._count.students }}
                    states={stateOptions}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                  />
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
      <Pagination className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref("/admin/districts", sp)} />
    </div>
  );
}
