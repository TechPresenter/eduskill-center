import type { Metadata } from "next";
import { MapPinned } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { allStates, listDistricts, locationListSchema } from "@/server/locations";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { ExportButton } from "@/components/admin/shared/export-button";
import { flattenParams, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { Pager } from "@/components/admin/pickers/pager";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { DistrictRowActions, NewDistrictButton } from "@/components/admin/locations/district-actions";
import { IconTile, RowLead } from "@/components/admin/locations/list-kit";

export const metadata: Metadata = { title: "Districts · Foundation Admin" };

export default async function DistrictsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("locations.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(locationListSchema, { limit: "50", ...sp });
  const [data, states, activeCount, inactiveCount] = await Promise.all([
    listDistricts(q),
    allStates(),
    listDistricts({ ...q, active: true, page: 1, limit: 1 }).then((r) => r.meta.total),
    listDistricts({ ...q, active: false, page: 1, limit: 1 }).then((r) => r.meta.total),
  ]);
  const stateOptions = states.map((s) => ({ value: s.id, label: `${s.name} (${s.code})${s.isActive ? "" : " · inactive"}` }));
  const canCreate = hasPermission(user, "locations.create");
  const canUpdate = hasPermission(user, "locations.update");
  const canDelete = hasPermission(user, "locations.delete");
  const currentState = states.find((s) => s.id === q.stateId);
  /** First-run state: nothing exists yet, as opposed to "your filters matched nothing". */
  const isEmpty = data.meta.total === 0 && !Object.keys(sp).some((k) => k !== "page");

  return (
    <AdminListPage
      header={{
        title: currentState ? `Districts of ${currentState.name}` : "Districts",
        mobileTitle: currentState ? currentState.name : "Districts",
        backHref: currentState ? "/admin/states" : "/admin/locations",
        description: `${formatNumber(data.meta.total)} district${data.meta.total === 1 ? "" : "s"} · the 3-character district code is embedded in center codes and is locked once a center uses it.`,
        breadcrumbs: [{ label: "Locations", href: "/admin/locations" }, ...(currentState ? [{ label: "States", href: "/admin/states" }, { label: currentState.name }] : [{ label: "Districts" }])],
        actions: (
          <>
            <ExportButton href="/api/admin/reports/districts" params={{ stateId: q.stateId }} disabled={!hasPermission(user, "reports.export")} />
            <NewDistrictButton states={stateOptions} defaultStateId={q.stateId} disabled={!canCreate} />
          </>
        ),
      }}
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="active"
            keep={["q", "stateId"]}
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
            <SearchInput placeholder="Search by name or code" />
            <SelectFilter name="stateId" label="State" options={stateOptions} placeholder="All states" className="min-w-[14rem]" />
          </FilterBar>
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/districts" params={sp} />}
    >
      {isEmpty ? (
        <EmptyState
          icon={<MapPinned className="h-7 w-7" />}
          title="No districts yet"
          description="Districts sit under a state and their code becomes part of every centre code beneath them."
          action={<ButtonLink href="/admin/states" variant="outline">Review states first</ButtonLink>}
        />
      ) : (
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
                <TD primary>
                  <RowLead
                    href={`/admin/blocks?stateId=${d.stateId}&districtId=${d.id}`}
                    lead={<IconTile icon={<MapPinned />} tone={d.isActive ? "lavender" : "neutral"} />}
                    title={d.name}
                    meta={
                      <>
                        <span className="font-mono font-semibold">
                          {d.state.code}-{d.code}
                        </span>
                        <span className="md:hidden"> · {d.state.name}</span>
                      </>
                    }
                    trailing={!d.isActive ? <Badge tone="neutral">Inactive</Badge> : undefined}
                  />
                </TD>
                <TD label="Code" mobile="hidden" className="font-mono text-caption font-semibold">
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
                <TD label="Status" mobile="hidden">
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
      )}
    </AdminListPage>
  );
}
