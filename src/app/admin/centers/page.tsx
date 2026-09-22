import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatNumber } from "@/lib/utils";
import { centerListSchema, listCentersAdmin } from "@/server/centers";
import { activeCourses } from "@/server/courses";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, LocationFilter, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { ExportButton } from "@/components/admin/shared/export-button";
import { flattenParams, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { Pager } from "@/components/admin/pickers/pager";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { IconTile, RowLead } from "@/components/admin/locations/list-kit";
import { CenterRowActions } from "@/components/admin/centers/center-actions";

export const metadata: Metadata = { title: "Training Centers · Foundation Admin" };

export default async function CentersPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("centers.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(centerListSchema, sp);
  const [data, courses, statusRows] = await Promise.all([
    listCentersAdmin(q),
    activeCourses({ includeInactive: true }),
    db.center.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const countOf = (st: string) => statusRows.find((r) => r.status === st)?._count._all ?? 0;
  const allCount = statusRows.reduce((n, r) => n + r._count._all, 0);
  /** The centre report accepts the location and status filters; course and verification are list-only. */
  const reportFilters = { q: q.q, stateId: q.stateId, districtId: q.districtId, blockId: q.blockId, status: q.status };
  const perms = { update: hasPermission(user, "centers.update"), verify: hasPermission(user, "centers.verify"), delete: hasPermission(user, "centers.delete") };
  const canCreate = hasPermission(user, "centers.create");
  const filtered = Object.keys(sp).some((k) => k !== "page");
  /** First-run state: nothing exists yet, as opposed to "your filters matched nothing". */
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{
        title: "Training Centers",
        mobileTitle: "Centers",
        description: `${formatNumber(data.meta.total)} center${data.meta.total === 1 ? "" : "s"} in the current view. Center codes are permanent and generated from the state and district.`,
        actions: (
          <>
            <ExportButton href="/api/admin/reports/centers" params={reportFilters} disabled={!hasPermission(user, "reports.export")} />
            {canCreate && (
              <ButtonLink href="/admin/centers/new" size="sm" leftIcon={<Plus className="h-4 w-4" />} className="hidden lg:inline-flex">
                Add center
              </ButtonLink>
            )}
          </>
        ),
      }}
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="status"
            keep={["q", "stateId", "districtId", "blockId", "courseId", "verified"]}
            items={[
              { value: "", label: "All", count: allCount },
              { value: "ACTIVE", label: "Active", count: countOf("ACTIVE") },
              { value: "PENDING", label: "Pending", count: countOf("PENDING") },
              { value: "INACTIVE", label: "Inactive", count: countOf("INACTIVE") },
            ]}
          />
        )
      }
      fab={canCreate && !isEmpty ? { href: "/admin/centers/new", label: "Add center" } : undefined}
      filters={
        <FilterBar preserve={["status"]}>
          <SearchInput placeholder="Name, code or PIN code" />
          <LocationFilter />
          <SelectFilter name="courseId" label="Course" options={courses.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="All courses" className="min-w-[13rem]" />
          <SelectFilter
            name="verified"
            label="Verified"
            options={[
              { value: "true", label: "Verified" },
              { value: "false", label: "Not verified" },
            ]}
          />
        </FilterBar>
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/centers" params={sp} />}
    >
      {isEmpty ? (
        <EmptyState icon={<Building2 className="h-7 w-7" />} title="No training centers yet" description="A centre is where batches run and students are admitted. Add the first one to get started." action={canCreate ? <ButtonLink href="/admin/centers/new">Add center</ButtonLink> : undefined} />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Code</TH>
              <TH>Center</TH>
              <TH>Location</TH>
              <TH className="text-right">Courses</TH>
              <TH className="text-right">Batches</TH>
              <TH className="text-right">Students</TH>
              <TH className="text-right">Trainers</TH>
              <TH>Status</TH>
              <TH>Verified</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={10}>No centers match these filters.</EmptyRow>}
            {data.items.map((c) => (
              <TR key={c.id}>
                <TD mobile="hidden">
                  <Link href={`/admin/centers/${c.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                    {c.code}
                  </Link>
                </TD>
                <TD primary>
                  <RowLead
                    href={`/admin/centers/${c.id}`}
                    lead={<IconTile icon={<Building2 />} tone={c.status === "ACTIVE" ? "lavender" : c.status === "PENDING" ? "warning" : "neutral"} />}
                    title={c.name}
                    meta={
                      <>
                        <span className="font-mono font-semibold text-navy md:hidden">{c.code} · </span>
                        <span className="md:hidden">
                          {c.block.name}, {c.district.name} · {c.state.name} ·{" "}
                        </span>
                        {c.pincode}
                      </>
                    }
                    trailing={<StatusBadge status={c.status} />}
                  />
                </TD>
                <TD mobile="hidden">
                  <span className="block text-body-sm">
                    {c.block.name}, {c.district.name}
                  </span>
                  <span className="block text-caption text-muted">{c.state.name}</span>
                </TD>
                <TD label="Courses" className="text-right tabular-nums">
                  {c._count.courses}
                </TD>
                <TD label="Batches" className="text-right tabular-nums">
                  {c._count.batches}
                </TD>
                <TD label="Students" className="text-right tabular-nums">
                  {c._count.admissions}
                </TD>
                <TD label="Trainers" className="text-right tabular-nums">
                  {c._count.trainerAssignments}
                </TD>
                <TD label="Status" mobile="hidden">
                  <StatusBadge status={c.status} />
                </TD>
                <TD label="Verified">
                  {c.isVerified ? (
                    <Badge tone="success">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Not verified</Badge>
                  )}
                </TD>
                <TD mobile="actions" className="text-right">
                  <span className="inline-flex items-center gap-2">
                    <CenterRowActions className="max-md:[&_button]:h-11 max-md:[&_button]:w-11" center={{ id: c.id, code: c.code, name: c.name, status: c.status, isVerified: c.isVerified, activeStudents: c._count.admissions }} perms={perms} />
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
