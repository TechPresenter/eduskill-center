import Link from "next/link";
import { UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import { admissionListSchema, listAdmissions, getAdminLookups } from "@/server/admissions";
import { Avatar } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pager } from "@/components/admin/pickers/pager";
import { EmptyState } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/stats";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { RowLead } from "@/components/admin/locations/list-kit";
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
    <AdminListPage
      header={{
        title: "Admissions",
        description: `${formatNumber(data.meta.total)} admission${data.meta.total === 1 ? "" : "s"} in the current view.`,
        actions: <ExportButton href={withParams("/api/admin/admissions/export", sp, { page: undefined, limit: undefined })} disabled={!canExport} />,
      }}
      tabs={<QueryTabs param="status" keep={filterKeys} items={[{ value: "", label: "All", count: all }, ...STATUS_TABS.map((s) => ({ value: s, label: titleCase(s), count: countOf(s) }))]} />}
      filters={
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
      }
      pagination={all === 0 ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {all === 0 ? (
        <EmptyState icon={<UserCheck className="h-7 w-7" />} title="No admissions yet" description="Admissions are created when an application is confirmed. Confirm an approved application to create the first one." action={<ButtonLink href="/admin/applications?status=APPROVED" variant="outline">Review approved applications</ButtonLink>} />
      ) : (
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
                  {/* Phones: an app list row led by the student, with the status trailing. */}
                  <RowLead
                    className="md:hidden"
                    href={`${base}/${a.id}`}
                    lead={<Avatar name={a.student.name} src={a.student.photoUrl} size={40} />}
                    title={a.student.name}
                    meta={
                      <>
                        <span className="font-mono font-semibold text-navy">{a.admissionNo}</span> · {a.course.name}
                      </>
                    }
                    trailing={
                      <span className="flex flex-col items-end gap-1">
                        <StatusBadge status={a.status} />
                        {a.certificate && <Badge tone="success">Certified</Badge>}
                      </span>
                    }
                  />
                  <span className="hidden items-start justify-between gap-2 md:flex">
                    <span className="min-w-0">
                      <Link href={`${base}/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                        {a.admissionNo}
                      </Link>
                      <span className="block text-caption font-normal text-muted">{a.application.applicationNo}</span>
                    </span>
                  </span>
                </TD>
                <TD label="Student" mobile="hidden">
                  <Link href={`/admin/students/${a.student.id}`} className="flex items-center justify-end gap-3 hover:text-navy md:justify-start">
                    <Avatar name={a.student.name} src={a.student.photoUrl} size={34} />
                    <span className="min-w-0 text-left">
                      <span className="block truncate font-semibold">{a.student.name}</span>
                      <span className="block font-mono text-caption text-muted">{a.student.studentId ?? a.student.mobile}</span>
                    </span>
                  </Link>
                </TD>
                <TD label="Course">
                  <span className="block">{a.course.name}</span>
                  <span className="text-caption text-muted">{a.course.code}</span>
                </TD>
                <TD label="Center">
                  <span className="block">{a.center.name}</span>
                  <span className="text-caption text-muted">
                    {a.center.district.name}, {a.center.state.name}
                  </span>
                </TD>
                <TD label="Batch" className="text-caption">
                  <span className="block font-mono">{a.batch.code}</span>
                  <StatusBadge status={a.batch.status} />
                </TD>
                <TD label="Trainer" className="text-body-sm">
                  {a.trainer?.user.name ?? <span className="text-caption text-muted">—</span>}
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
                      <span className="mt-1 block text-caption text-muted">
                        {a.progress.classesAttended}/{a.progress.classesHeld} classes · completion {Math.round(a.progress.completionPct)}%{a.progress.certificateEligible ? " · eligible" : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-caption text-muted">Attendance not computed</span>
                  )}
                </TD>
                <TD label="Admitted" className="text-muted md:whitespace-nowrap">
                  {formatDate(a.admittedAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
