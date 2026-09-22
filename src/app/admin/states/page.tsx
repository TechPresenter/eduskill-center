import type { Metadata } from "next";
import { Map } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { listStates, locationListSchema } from "@/server/locations";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, SearchInput } from "@/components/admin/shared/filter-bar";
import { ExportButton } from "@/components/admin/shared/export-button";
import { flattenParams, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { Pager } from "@/components/admin/pickers/pager";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { NewStateButton, StateRowActions } from "@/components/admin/locations/state-actions";
import { IconTile, RowLead } from "@/components/admin/locations/list-kit";

export const metadata: Metadata = { title: "States · Foundation Admin" };

export default async function StatesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("locations.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(locationListSchema, { limit: "50", ...sp });
  // The status chips carry live counts for the current search, so each chip says what it will show.
  const [data, activeCount, inactiveCount] = await Promise.all([
    listStates(q),
    listStates({ ...q, active: true, page: 1, limit: 1 }).then((r) => r.meta.total),
    listStates({ ...q, active: false, page: 1, limit: 1 }).then((r) => r.meta.total),
  ]);
  const canCreate = hasPermission(user, "locations.create");
  const canUpdate = hasPermission(user, "locations.update");
  const canDelete = hasPermission(user, "locations.delete");
  /** First-run state: nothing exists yet, as opposed to "your filters matched nothing". */
  const isEmpty = data.meta.total === 0 && !Object.keys(sp).some((k) => k !== "page");

  return (
    <AdminListPage
      header={{
        title: "States & Union Territories",
        mobileTitle: "States",
        backHref: "/admin/locations",
        description: `${formatNumber(data.meta.total)} state${data.meta.total === 1 ? "" : "s"} · the state code is embedded in every center code and never changes once a center exists.`,
        breadcrumbs: [{ label: "Locations", href: "/admin/locations" }, { label: "States" }],
        actions: (
          <>
            <ExportButton href="/api/admin/reports/states" disabled={!hasPermission(user, "reports.export")} />
            <NewStateButton disabled={!canCreate} />
          </>
        ),
      }}
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="active"
            keep={["q"]}
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
          </FilterBar>
        )
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/states" params={sp} />}
    >
      {isEmpty ? (
        <EmptyState
          icon={<Map className="h-7 w-7" />}
          title="No states yet"
          description="Every centre, student and trainer sits under a state. Import the standard list or add them one at a time."
          action={<ButtonLink href="/admin/locations" variant="outline">Import the hierarchy</ButtonLink>}
        />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>State</TH>
              <TH>Code</TH>
              <TH className="text-right">Districts</TH>
              <TH className="text-right">Centers</TH>
              <TH className="text-right">Students</TH>
              <TH className="text-right">Trainers</TH>
              <TH>Status</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={8}>No states match these filters.</EmptyRow>}
            {data.items.map((s) => (
              <TR key={s.id}>
                <TD primary>
                  <RowLead
                    href={`/admin/districts?stateId=${s.id}`}
                    lead={<IconTile icon={<Map />} tone={s.isActive ? "lavender" : "neutral"} />}
                    title={s.name}
                    meta={
                      <>
                        <span className="font-mono font-semibold">{s.code}</span>
                        <span className="md:hidden"> · {formatNumber(s._count.districts)} districts</span>
                      </>
                    }
                    trailing={!s.isActive ? <Badge tone="neutral">Inactive</Badge> : undefined}
                  />
                </TD>
                <TD label="Code" mobile="hidden" className="font-mono text-caption font-semibold">
                  {s.code}
                </TD>
                <TD label="Districts" mobile="hidden" className="text-right tabular-nums">
                  {formatNumber(s._count.districts)}
                </TD>
                <TD label="Centers" className="text-right tabular-nums">
                  {formatNumber(s._count.centers)}
                </TD>
                <TD label="Students" className="text-right tabular-nums">
                  {formatNumber(s._count.students)}
                </TD>
                <TD label="Trainers" className="text-right tabular-nums">
                  {formatNumber(s._count.trainers)}
                </TD>
                <TD label="Status" mobile="hidden">
                  <Badge tone={s.isActive ? "success" : "neutral"} dot>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                <TD mobile="actions" className="text-right">
                  {(canUpdate || canDelete) && (
                    <StateRowActions
                      state={{ id: s.id, name: s.name, code: s.code, isActive: s.isActive, sortOrder: s.sortOrder, centers: s._count.centers, districts: s._count.districts, linked: s._count.students + s._count.trainers }}
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
