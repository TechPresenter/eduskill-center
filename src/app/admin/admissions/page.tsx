import Link from "next/link";
import { UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import { admissionListSchema, listAdmissions, getAdminLookups } from "@/server/admissions";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pager } from "@/components/admin/pickers/pager";
import { EmptyState } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/stats";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Admissions" };

const STATUS_TABS = ["ACTIVE", "ON_HOLD", "COMPLETED", "DROPPED"] as const;

export default async function AdmissionsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("admissions.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(admissionListSchema, sp);
  const [data, lookups, counts] = await Promise.all([listAdmissions(q), getAdminLookups(), db.admission.groupBy({ by: ["status"], _count: { _all: true } })]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((n, c) => n + c._count._all, 0);
  const canExport = hasPermission(user, "admissions.export");
  const base = "/admin/admissions";
  const filterKeys = ["centerId", "courseId", "batchId", "trainerId", "stateId", "districtId", "blockId", "from", "to", "q"];

  return (
    <div>
      <PageHeader
        title="Admissions"
        description={`${formatNumber(data.meta.total)} admission${data.meta.total === 1 ? "" : "s"} in the current view.`}
        actions={<ExportButton href={withParams("/api/admin/admissions/export", sp, { page: undefined, limit: undefined })} disabled={!canExport} />}
      />

      <QueryTabs param="status" keep={filterKeys} className="mb-4" items={[{ value: "", label: "All", count: all }, ...STATUS_TABS.map((s) => ({ value: s, label: titleCase(s), count: countOf(s) }))]} />

      <FilterBar
        lookups={lookups}
        preserve={["status"]}
        fields={[
          { type: "search", placeholder: "Admission no, application no, student name, Student ID or mobile" },
          { type: "center" },
          { type: "course" },
          { type: "batch" },
          { type: "trainer" },
          { type: "location" },
          { type: "date-range", label: "Admitted between" },
        ]}
      />

      {all === 0 ? (
        <EmptyState icon={<UserCheck className="h-7 w-7" />} title="No admissions yet" description="Admissions are created when an application is confirmed." />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Admission</TH>
                <TH>Student</TH>
                <TH>Course</TH>
                <TH>Center</TH>
                <TH>Batch</TH>
                <TH>Trainer</TH>
                <TH>Status</TH>
                <TH>Progress</TH>
                <TH>Admitted</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={9}>No admissions match these filters.</EmptyRow>}
              {data.items.map((a) => (
                <TR key={a.id}>
                  <TD primary>
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <Link href={`${base}/${a.id}`} className="font-mono text-xs font-semibold text-navy hover:underline">
                          {a.admissionNo}
                        </Link>
                        <span className="block text-[11px] font-normal text-muted">{a.application.applicationNo}</span>
                      </span>
                      {/* Status column is dropped on phones – badges ride in the card title. */}
                      <span className="flex shrink-0 flex-wrap justify-end gap-1 md:hidden">
                        <StatusBadge status={a.status} />
                        {a.certificate && <Badge tone="success">Certified</Badge>}
                      </span>
                    </span>
                  </TD>
                  <TD label="Student">
                    <Link href={`/admin/students/${a.student.id}`} className="flex items-center justify-end gap-3 hover:text-navy md:justify-start">
                      <Avatar name={a.student.name} src={a.student.photoUrl} size={34} />
                      <span className="min-w-0 text-left">
                        <span className="block truncate font-semibold">{a.student.name}</span>
                        <span className="block font-mono text-xs text-muted">{a.student.studentId ?? a.student.mobile}</span>
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
                    <span className="block font-mono">{a.batch.code}</span>
                    <StatusBadge status={a.batch.status} />
                  </TD>
                  <TD label="Trainer" className="text-sm">
                    {a.trainer?.user.name ?? <span className="text-xs text-muted">—</span>}
                  </TD>
                  <TD mobile="hidden">
                    <StatusBadge status={a.status} />
                    {a.certificate && (
                      <Badge tone="success" className="mt-1">
                        Certified
                      </Badge>
                    )}
                  </TD>
                  <TD label="" className="md:min-w-44">
                    {a.progress ? (
                      <>
                        <ProgressBar value={a.progress.attendancePct} label="Attendance" tone={a.progress.attendancePct >= a.course.minAttendancePct ? "success" : "warning"} />
                        <span className="mt-1 block text-[11px] text-muted">
                          {a.progress.classesAttended}/{a.progress.classesHeld} classes · completion {Math.round(a.progress.completionPct)}%{a.progress.certificateEligible ? " · eligible" : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">Attendance not computed</span>
                    )}
                  </TD>
                  <TD label="Admitted" className="text-muted md:whitespace-nowrap">
                    {formatDate(a.admittedAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </TableWrap>
          <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
        </>
      )}
    </div>
  );
}
