import type { Metadata } from "next";
import { db } from "@/lib/db";
import { BookOpen, Plus, Star } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatINR, formatNumber, titleCase } from "@/lib/utils";
import { courseListSchema, listCategories, listCoursesAdmin } from "@/server/courses";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { ExportButton } from "@/components/admin/shared/export-button";
import { flattenParams, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { Pager } from "@/components/admin/pickers/pager";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { IconTile, RowLead } from "@/components/admin/locations/list-kit";
import { CourseRowActions } from "@/components/admin/courses/course-actions";

export const metadata: Metadata = { title: "Courses · Foundation Admin" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("courses.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(courseListSchema, sp);
  const [data, categories, statusRows] = await Promise.all([listCoursesAdmin(q), listCategories(), db.course.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } })]);
  const countOf = (st: string) => statusRows.find((r) => r.status === st)?._count._all ?? 0;
  const perms = { update: hasPermission(user, "courses.update"), delete: hasPermission(user, "courses.delete") };
  const canCreate = hasPermission(user, "courses.create");
  const filtered = Object.keys(sp).some((k) => k !== "page");
  /** First-run state: nothing exists yet, as opposed to "your filters matched nothing". */
  const isEmpty = data.meta.total === 0 && !filtered;

  return (
    <AdminListPage
      header={{
        title: "Courses",
        description: `${formatNumber(data.meta.total)} course${data.meta.total === 1 ? "" : "s"} in the current view.`,
        actions: (
          <>
            <ExportButton href="/api/admin/reports/courses" params={{ status: q.status }} disabled={!hasPermission(user, "reports.export")} />
            <ButtonLink href="/admin/courses/categories" variant="outline" size="sm">
              Categories
            </ButtonLink>
            {canCreate && (
              <ButtonLink href="/admin/courses/new" size="sm" className="hidden lg:inline-flex" leftIcon={<Plus className="h-4 w-4" />}>
                Add course
              </ButtonLink>
            )}
          </>
        ),
      }}
      /* Phones and tablets get the create action as a FAB; the header button takes over from lg up. */
      fab={canCreate && !isEmpty ? { href: "/admin/courses/new", label: "Add course" } : undefined}
      tabs={
        isEmpty ? undefined : (
          <QueryTabs
            param="status"
            keep={["q", "categoryId", "level", "mode", "featured"]}
            items={[
              { value: "", label: "All", count: statusRows.reduce((n, r) => n + r._count._all, 0) },
              { value: "ACTIVE", label: "Active", count: countOf("ACTIVE") },
              { value: "DRAFT", label: "Draft", count: countOf("DRAFT") },
              { value: "INACTIVE", label: "Inactive", count: countOf("INACTIVE") },
              { value: "ARCHIVED", label: "Archived", count: countOf("ARCHIVED") },
            ]}
          />
        )
      }
      filters={
        <FilterBar preserve={["status"]}>
          <SearchInput placeholder="Name, code or description" />
          <SelectFilter name="categoryId" label="Category" options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="All categories" className="min-w-[12rem]" />
          <SelectFilter
            name="level"
            label="Level"
            options={[
              { value: "BEGINNER", label: "Beginner" },
              { value: "INTERMEDIATE", label: "Intermediate" },
              { value: "ADVANCED", label: "Advanced" },
            ]}
          />
          <SelectFilter
            name="mode"
            label="Mode"
            options={[
              { value: "OFFLINE", label: "Offline" },
              { value: "ONLINE", label: "Online" },
              { value: "HYBRID", label: "Hybrid" },
            ]}
          />
          <SelectFilter name="featured" label="Featured" options={[{ value: "true", label: "Featured only" }]} placeholder="All" />
        </FilterBar>
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base="/admin/courses" params={sp} />}
    >
      {isEmpty ? (
        <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No courses yet" description="Create the first course to offer it at training centers." action={canCreate ? <ButtonLink href="/admin/courses/new">Add course</ButtonLink> : undefined} />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Course</TH>
              <TH>Category</TH>
              <TH>Duration</TH>
              <TH>Level / Mode</TH>
              <TH className="text-right">Fee</TH>
              <TH className="text-right">Centers</TH>
              <TH className="text-right">Batches</TH>
              <TH className="text-right">Students</TH>
              <TH>Status</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={10}>No courses match these filters.</EmptyRow>}
            {data.items.map((c) => (
              <TR key={c.id}>
                <TD primary>
                  {/* The status column is dropped on phones – the badge trails the title instead. */}
                  <RowLead
                    href={`/admin/courses/${c.id}`}
                    lead={<IconTile icon={<DynamicIcon name={c.icon ?? undefined} />} />}
                    title={
                      <span className="inline-flex items-center gap-1.5">
                        {c.name}
                        {c.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 fill-orange text-orange" aria-label="Featured" />}
                      </span>
                    }
                    meta={<span className="font-mono">{c.code}</span>}
                    trailing={<StatusBadge status={c.status} />}
                  />
                </TD>
                <TD label="Category">{c.category?.name ?? <span className="text-muted">—</span>}</TD>
                <TD label="Duration">{c.durationText}</TD>
                <TD label="Level / Mode">
                  <Badge tone="neutral">{titleCase(c.level)}</Badge> <Badge tone="info">{titleCase(c.mode)}</Badge>
                </TD>
                <TD label="Total fee" className="text-right tabular-nums">
                  {c.courseFee + c.registrationFee + c.examFee + c.certificateFee === 0 ? <span className="text-success-dark">Free</span> : formatINR(c.courseFee + c.registrationFee + c.examFee + c.certificateFee)}
                </TD>
                <TD label="Reach" className="text-right tabular-nums">
                  <span className="md:hidden">
                    {formatNumber(c._count.centers)} centers · {formatNumber(c._count.batches)} batches · {formatNumber(c._count.admissions)} students
                  </span>
                  <span className="hidden md:inline">{c._count.centers}</span>
                </TD>
                <TD mobile="hidden" className="text-right tabular-nums">
                  {c._count.batches}
                </TD>
                <TD mobile="hidden" className="text-right tabular-nums">
                  {c._count.admissions}
                </TD>
                <TD mobile="hidden">
                  <StatusBadge status={c.status} />
                </TD>
                <TD actions className="text-right">
                  <CourseRowActions course={{ id: c.id, code: c.code, name: c.name, status: c.status, batches: c._count.batches, applications: c._count.applications }} perms={perms} />
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
