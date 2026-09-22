import type { Metadata } from "next";
import Link from "next/link";
import { Map } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { listStates, locationListSchema } from "@/server/locations";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { NewStateButton, StateRowActions } from "@/components/admin/locations/state-actions";

export const metadata: Metadata = { title: "States · Foundation Admin" };

export default async function StatesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("locations.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(locationListSchema, { limit: "50", ...sp });
  const data = await listStates(q);
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
        actions: <NewStateButton disabled={!canCreate} />,
      }}
      filters={
        <FilterBar>
          <SearchInput placeholder="Search by name or code" />
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
      pagination={isEmpty ? undefined : <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref("/admin/states", sp)} />}
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
                <TD mobile="full">
                  <Link href={`/admin/districts?stateId=${s.id}`} className="block tap-highlight-none md:inline">
                    <span className="mr-2 font-mono text-caption font-bold text-orange md:hidden">{s.code}</span>
                    <span className="font-semibold text-navy md:font-medium md:hover:underline">{s.name}</span>
                  </Link>
                </TD>
                <TD label="Code" mobile="hidden" className="font-mono text-caption font-semibold">
                  {s.code}
                </TD>
                <TD label="Districts" className="text-right tabular-nums">{formatNumber(s._count.districts)}</TD>
                <TD label="Centers" className="text-right tabular-nums">{formatNumber(s._count.centers)}</TD>
                <TD label="Students" className="text-right tabular-nums">{formatNumber(s._count.students)}</TD>
                <TD label="Trainers" className="text-right tabular-nums">{formatNumber(s._count.trainers)}</TD>
                <TD label="Status">
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
