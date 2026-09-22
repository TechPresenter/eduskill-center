import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus, Star } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatINR, formatNumber, titleCase } from "@/lib/utils";
import { courseListSchema, listCategories, listCoursesAdmin } from "@/server/courses";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/feedback";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow, Pagination } from "@/components/ui/table";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar, SearchInput, SelectFilter } from "@/components/admin/shared/filter-bar";
import { flattenParams, pageHref, parseListQuery, type SearchParamsRecord } from "@/components/admin/shared/url";
import { CourseRowActions } from "@/components/admin/courses/course-actions";

export const metadata: Metadata = { title: "Courses · Foundation Admin" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAdmin("courses.view");
  const sp = flattenParams(await searchParams);
  const q = parseListQuery(courseListSchema, sp);
  const [data, categories] = await Promise.all([listCoursesAdmin(q), listCategories()]);
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
      filters={
        <FilterBar>
          <SearchInput placeholder="Name, code or description" />
          <SelectFilter name="categoryId" label="Category" options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="All categories" className="min-w-[12rem]" />
          <SelectFilter
            name="status"
            label="Status"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "DRAFT", label: "Draft" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
          />
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
      pagination={isEmpty ? undefined : <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} hrefFor={pageHref("/admin/courses", sp)} />}
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
                  <span className="flex items-start justify-between gap-2">
                    <Link href={`/admin/courses/${c.id}`} className="flex min-w-0 items-center gap-3 hover:text-navy">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
                        <DynamicIcon name={c.icon ?? undefined} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-semibold">
                          {c.name}
                          {c.isFeatured && <Star className="h-3.5 w-3.5 fill-orange text-orange" aria-label="Featured" />}
                        </span>
                        <span className="block font-mono text-caption font-normal text-muted">{c.code}</span>
                      </span>
                    </Link>
                    {/* The status column is dropped on phones – the badge leads the card instead. */}
                    <span className="shrink-0 md:hidden">
                      <StatusBadge status={c.status} />
                    </span>
                  </span>
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
