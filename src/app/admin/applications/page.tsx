import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { applicationListSchema, listApplications } from "@/server/applications";
import { getAdminLookups } from "@/server/admissions";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pager } from "@/components/admin/pickers/pager";
import { EmptyState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Applications" };

const STATUS_TABS = ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "ADMISSION_CONFIRMED", "WAITLISTED", "REJECTED", "CANCELLED", "COMPLETED"] as const;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("applications.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(applicationListSchema, sp);
  const [data, lookups, counts] = await Promise.all([listApplications(q), getAdminLookups(), db.application.groupBy({ by: ["status"], _count: { _all: true } })]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.filter((c) => c.status !== "DRAFT").reduce((n, c) => n + c._count._all, 0);
  const canExport = hasPermission(user, "applications.export");
  const base = "/admin/applications";
  const filterKeys = ["centerId", "courseId", "batchId", "stateId", "districtId", "blockId", "payment", "scholarship", "from", "to", "q"];

  return (
    <div>
      <PageHeader
        title="Student Applications"
        description={`${formatNumber(data.meta.total)} application${data.meta.total === 1 ? "" : "s"} in the current view.`}
        actions={<ExportButton href={withParams("/api/admin/applications/export", sp, { page: undefined, limit: undefined })} disabled={!canExport} />}
      />

      <QueryTabs
        param="status"
        keep={filterKeys}
        className="mb-4"
        items={[{ value: "", label: "All", count: all }, ...STATUS_TABS.map((s) => ({ value: s, label: titleCase(s), count: countOf(s) }))]}
      />

      <FilterBar
        lookups={lookups}
        preserve={["status"]}
        fields={[
          { type: "search", placeholder: "Application no, applicant name, mobile or Student ID" },
          {
            type: "select",
            name: "payment",
            label: "Payment",
            options: [
              { value: "unpaid", label: "Unpaid" },
              { value: "partial", label: "Partially paid" },
              { value: "paid", label: "Fully paid" },
            ],
          },
          {
            type: "select",
            name: "scholarship",
            label: "Scholarship",
            options: [
              { value: "requested", label: "Requested" },
              { value: "awarded", label: "Awarded" },
            ],
          },
          { type: "center" },
          { type: "course" },
          { type: "batch" },
          { type: "location" },
          { type: "date-range", label: "Applied between" },
        ]}
      />

      {all === 0 ? (
        <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="No applications yet" description="Applications submitted from the student portal will appear here." />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Application</TH>
                <TH>Applicant</TH>
                <TH>Course</TH>
                <TH>Center</TH>
                <TH>Batch</TH>
                <TH className="text-right">Fee</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={8}>No applications match these filters.</EmptyRow>}
              {data.items.map((a) => {
                const due = Math.max(0, a.payableAmount - a.paidAmount);
                return (
                  <TR key={a.id}>
                    <TD primary>
                      <span className="flex items-start justify-between gap-2">
                        <Link href={`${base}/${a.id}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                          {a.applicationNo}
                        </Link>
                        {/* The status column is dropped on phones – show the badge in the card title instead. */}
                        <span className="md:hidden">
                          <StatusBadge status={a.status} />
                        </span>
                      </span>
                      {a.scholarshipRequested && (
                        <Badge tone={a.scholarshipAmount > 0 ? "success" : "warning"} className="mt-1">
                          {a.scholarshipAmount > 0 ? "Scholarship" : "Scholarship requested"}
                        </Badge>
                      )}
                    </TD>
                    <TD label="Applicant">
                      <Link href={`/admin/students/${a.student.id}`} className="flex items-center justify-end gap-3 hover:text-navy md:justify-start">
                        <Avatar name={a.student.name} src={a.student.photoUrl} size={34} />
                        <span className="min-w-0 text-left">
                          <span className="block truncate font-semibold">{a.student.name}</span>
                          <span className="block text-xs text-muted">{a.student.studentId ?? a.student.mobile}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD label="Course">
                      <span className="block">{a.course.name}</span>
                      <span className="text-xs text-muted">{a.course.code}</span>
                    </TD>
                    <TD label="Center">
                      <span className="block">{a.center.name}</span>
                      <span className="text-xs text-muted">
                        {a.center.district.name}, {a.center.state.name}
                      </span>
                    </TD>
                    <TD label="Batch" className="text-xs">
                      {a.batch ? a.batch.code : <span className="text-muted">Not allocated</span>}
                    </TD>
                    <TD label="Fee" className="text-right tabular-nums">
                      <span className="block font-semibold">{formatINR(a.payableAmount)}</span>
                      <span className={`text-xs ${due > 0 ? "text-amber-700" : "text-green-700"}`}>{a.payableAmount === 0 ? "Free" : due > 0 ? `Due ${formatINR(due)}` : "Paid"}</span>
                    </TD>
                    <TD mobile="hidden">
                      <StatusBadge status={a.status} />
                    </TD>
                    <TD label="Submitted" className="text-muted md:whitespace-nowrap">
                      {formatDate(a.submittedAt ?? a.createdAt)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </TableWrap>
          <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
        </>
      )}
    </div>
  );
}
