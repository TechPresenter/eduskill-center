import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber } from "@/lib/utils";
import { activeCourses } from "@/server/courses";
import { batchFormOptions, batchListSchema, listBatchesAdmin } from "@/app/admin/batches/queries";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { FilterBar, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { BatchRowActions } from "@/components/admin/batches/batch-actions";

export const metadata: Metadata = { title: "Batches · Foundation Admin" };

export default async function BatchesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("batches.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(batchListSchema, sp);
  const [data, options, courses] = await Promise.all([listBatchesAdmin(q), batchFormOptions(), activeCourses({ includeInactive: true })]);
  const perms = { update: hasPermission(user, "batches.update"), delete: hasPermission(user, "batches.delete"), assign: hasPermission(user, "trainers.assign") };
  const canCreate = hasPermission(user, "batches.create");
  const filtered = Object.keys(sp).some((k) => k !== "page");

  return (
    <div>
      <PageHeader
        title="Batches"
        description={`${formatNumber(data.meta.total)} batch${data.meta.total === 1 ? "" : "es"} in the current view. Seats are held by admitted students and approved applications.`}
        actions={
          canCreate ? (
            <ButtonLink href="/admin/batches/new" size="sm" className="hidden sm:inline-flex" leftIcon={<Plus className="h-4 w-4" />}>
              Create batch
            </ButtonLink>
          ) : undefined
        }
      />
      {/* Phones get the create action as a floating button instead of a toolbar button. */}
      {canCreate && <Fab href="/admin/batches/new" aria-label="Create batch" icon={<Plus className="h-6 w-6" />} className="sm:hidden" />}

      <FilterBar>
        <SearchInput placeholder="Batch name, code or center" />
        <SelectFilter name="centerId" label="Center" options={options.centers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="All centers" className="min-w-[14rem]" />
        <SelectFilter name="courseId" label="Course" options={courses.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} placeholder="All courses" className="min-w-[13rem]" />
        <SelectFilter name="trainerId" label="Trainer" options={options.trainers.map((t) => ({ value: t.id, label: `${t.name} (${t.trainerId})` }))} placeholder="All trainers" className="min-w-[12rem]" />
        <SelectFilter
          name="status"
          label="Status"
          options={[
            { value: "UPCOMING", label: "Upcoming" },
            { value: "ONGOING", label: "Ongoing" },
            { value: "COMPLETED", label: "Completed" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="filter-from">
            Starts from
          </label>
          <Input id="filter-from" name="from" type="date" defaultValue={sp.from ?? ""} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="filter-to">
            Starts until
          </label>
          <Input id="filter-to" name="to" type="date" defaultValue={sp.to ?? ""} />
        </div>
      </FilterBar>

      {data.meta.total === 0 && !filtered ? (
        <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No batches yet" description="Create a batch for a course offered at a training center." action={canCreate ? <ButtonLink href="/admin/batches/new">Create batch</ButtonLink> : undefined} />
      ) : (
        <>
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
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <Link href={`/admin/batches/${b.id}`} className="font-medium text-navy hover:underline">
                          {b.name}
                        </Link>
                        <span className="block font-mono text-xs font-normal text-muted">{b.code}</span>
                      </span>
                      {/* The status column is dropped on phones – the badge leads the card instead. */}
                      <span className="shrink-0 md:hidden">
                        <StatusBadge status={b.status} />
                      </span>
                    </span>
                  </TD>
                  <TD label="Center">
                    <Link href={`/admin/centers/${b.center.id}`} className="hover:underline">
                      {b.center.name}
                    </Link>
                    <span className="block text-xs text-muted">
                      {b.center.district.name}, {b.center.state.name}
                    </span>
                  </TD>
                  <TD label="Course">
                    {b.course.name}
                    <span className="block font-mono text-xs text-muted">{b.course.code}</span>
                  </TD>
                  <TD label="Trainer">{b.trainerName ?? <span className="text-muted">Unassigned</span>}</TD>
                  <TD label="Dates" className="text-xs md:whitespace-nowrap">
                    {formatDate(b.startDate)}
                    <span className="block text-muted">to {formatDate(b.endDate)}</span>
                  </TD>
                  <TD label="Schedule" className="text-xs">
                    {b.days.join(", ")}
                    <span className="block text-muted">
                      {b.startTime}–{b.endTime}
                    </span>
                  </TD>
                  <TD label="Seats" className="text-right tabular-nums">
                    <span className="md:hidden">
                      {b.occupied}/{b.capacity} filled ·{" "}
                      <span className={b.available === 0 ? "font-semibold text-danger" : "font-semibold text-green-700"}>{b.available === 0 ? "full" : `${b.available} free`}</span>
                    </span>
                    <span className="hidden md:inline">{b.capacity}</span>
                  </TD>
                  <TD mobile="hidden" className="text-right tabular-nums">
                    {b.occupied}
                  </TD>
                  <TD mobile="hidden" className={`text-right font-semibold tabular-nums ${b.available === 0 ? "text-danger" : "text-green-700"}`}>
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
          <Pagination className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref("/admin/batches", sp)} />
        </>
      )}
    </div>
  );
}
