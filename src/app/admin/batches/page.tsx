import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber } from "@/lib/utils";
import { activeCourses } from "@/server/courses";
import { batchFormOptions, batchListSchema, listBatchesAdmin } from "@/app/admin/batches/queries";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, FilterLabel, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { ExportButton } from "@/components/admin/shared/export-button";
import { flattenParams, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { Pager } from "@/components/admin/pickers/pager";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { IconTile, RowLead } from "@/components/admin/locations/list-kit";
import { BatchRowActions } from "@/components/admin/batches/batch-actions";

export const metadata: Metadata = { title: "Batches · Foundation Admin" };

export default async function BatchesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("batches.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(batchListSchema, sp);
  const [data, options, courses, statusRows] = await Promise.all([
    listBatchesAdmin(q),
    batchFormOptions(),
    activeCourses({ includeInactive: true }),
    db.batch.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const countOf = (st: string) => statusRows.find((r) => r.status === st)?._count._all ?? 0;
  const perms = { update: hasPermission(user, "batches.update"), delete: hasPermission(user, "batches.delete"), assign: hasPermission(user, "trainers.assign") };
  const canCreate = hasPermission(user, "batches.create");
  const filtered = Object.keys(sp).some((k) => k !== "page");
  /** First-run state: nothing exists yet, as opposed to "your filters matched nothing". */
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{
        title: "Batches",
        description: `${formatNumber(data.meta.total)} batch${data.meta.total === 1 ? "" : "es"} in the current view. Seats are held by admitted students and approved applications.`,
        actions: (
          <>
            <ExportButton href="/api/admin/reports/batches" params={{ q: q.q, centerId: q.centerId, courseId: q.courseId, status: q.status, stateId: q.stateId, districtId: q.districtId, blockId: q.blockId }} disabled={!hasPermission(user, "reports.export")} />
            {canCreate && (
              <ButtonLink href="/admin/batches/new" size="sm" className="hidden lg:inline-flex" leftIcon={<Plus className="h-4 w-4" />}>
                Create batch
              </ButtonLink>
            )}
          </>
        ),
      }}
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="status"
            keep={["q", "centerId", "courseId", "trainerId", "stateId", "districtId", "blockId", "from", "to"]}
            items={[
              { value: "", label: "All", count: statusRows.reduce((n, r) => n + r._count._all, 0) },
              { value: "ONGOING", label: "Ongoing", count: countOf("ONGOING") },
              { value: "UPCOMING", label: "Upcoming", count: countOf("UPCOMING") },
              { value: "COMPLETED", label: "Completed", count: countOf("COMPLETED") },
              { value: "CANCELLED", label: "Cancelled", count: countOf("CANCELLED") },
            ]}
          />
        )
      }
      /* Phones and tablets get the create action as a FAB; the header button takes over from lg up. */
      fab={canCreate && !isEmpty ? { href: "/admin/batches/new", label: "Create batch" } : undefined}
      filters={
        <FilterBar preserve={["status"]}>
          <SearchInput placeholder="Batch name, code or center" />
          <SelectFilter name="centerId" label="Center" options={options.centers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="All centers" className="min-w-[14rem]" />
          <SelectFilter name="courseId" label="Course" options={courses.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="All courses" className="min-w-[13rem]" />
          <SelectFilter name="trainerId" label="Trainer" options={options.trainers.map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId})` }))} placeholder="All trainers" className="min-w-[12rem]" />
          <div className="min-w-0">
            <FilterLabel htmlFor="filter-from">Starts from</FilterLabel>
            <Input id="filter-from" name="from" type="date" defaultValue={sp.from ?? ""} />
          </div>
          <div className="min-w-0">
            <FilterLabel htmlFor="filter-to">Starts until</FilterLabel>
            <Input id="filter-to" name="to" type="date" defaultValue={sp.to ?? ""} />
          </div>
        </FilterBar>
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/batches" params={sp} />}
    >
      {isEmpty ? (
        <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No batches yet" description="A batch runs one course at one training center between two dates. Create the first one to start admitting students." action={canCreate ? <ButtonLink href="/admin/batches/new">Create batch</ButtonLink> : undefined} />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Batch</TH>
              <TH>Center</TH>
              <TH>Course</TH>
              <TH>Trainer</TH>
              <TH>Dates</TH>
              <TH>Schedule</TH>
              <TH className="text-right">Capacity</TH>
              <TH className="text-right">Occupied</TH>
              <TH className="text-right">Available</TH>
              <TH>Status</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={11}>No batches match these filters.</EmptyRow>}
            {data.items.map((b) => (
              <TR key={b.id}>
                <TD primary>
                  {/* The status column is dropped on phones – the badge trails the title instead. */}
                  <RowLead
                    href={`/admin/batches/${b.id}`}
                    lead={<IconTile icon={<CalendarDays />} tone={b.status === "ONGOING" ? "orange" : b.status === "CANCELLED" ? "neutral" : "lavender"} />}
                    title={b.name}
                    meta={<span className="font-mono">{b.code}</span>}
                    trailing={<StatusBadge status={b.status} />}
                  />
                </TD>
                <TD label="Center">
                  <Link href={`/admin/centers/${b.center.id}`} className="hover:underline">
                    {b.center.name}
                  </Link>
                  <span className="block text-caption text-muted">
                    {b.center.district.name}, {b.center.state.name}
                  </span>
                </TD>
                <TD label="Course">
                  {b.course.name}
                  <span className="block font-mono text-caption text-muted">{b.course.code}</span>
                </TD>
                <TD label="Trainer">{b.trainerName ?? <span className="text-muted">Unassigned</span>}</TD>
                <TD label="Dates" className="text-caption md:whitespace-nowrap">
                  {formatDate(b.startDate)}
                  <span className="block text-muted">to {formatDate(b.endDate)}</span>
                </TD>
                <TD label="Schedule" className="text-caption">
                  {b.days.join(", ")}
                  <span className="block text-muted">
                    {b.startTime}–{b.endTime}
                  </span>
                </TD>
                <TD label="Seats" className="text-right tabular-nums">
                  <span className="md:hidden">
                    {b.occupied}/{b.capacity} filled ·{" "}
                    <span className={b.available === 0 ? "font-semibold text-danger" : "font-semibold text-success-dark"}>{b.available === 0 ? "full" : `${b.available} free`}</span>
                  </span>
                  <span className="hidden md:inline">{b.capacity}</span>
                </TD>
                <TD mobile="hidden" className="text-right tabular-nums">
                  {b.occupied}
                </TD>
                <TD mobile="hidden" className={`text-right font-semibold tabular-nums ${b.available === 0 ? "text-danger" : "text-success-dark"}`}>
                  {b.available}
                </TD>
                <TD mobile="hidden">
                  <StatusBadge status={b.status} />
                </TD>
                <TD actions className="text-right">
                  <BatchRowActions batch={{ id: b.id, code: b.code, name: b.name, status: b.status, occupied: b.occupied, activeStudents: b.occupied, trainerId: b.trainerId }} perms={perms} />
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
