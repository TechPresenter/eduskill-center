import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber } from "@/lib/utils";
import { listStudents, studentListSchema } from "@/server/students";
import { getAdminLookups } from "@/server/admissions";
import { Avatar } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pager } from "@/components/admin/pickers/pager";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Students" };

const STATUS_OPTIONS = [
  { value: "registered", label: "Registered (no application)" },
  { value: "applied", label: "Applied" },
  { value: "admitted", label: "Admitted" },
  { value: "completed", label: "Completed a course" },
  { value: "incomplete_profile", label: "Incomplete profile" },
];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("students.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(studentListSchema, sp);
  const [data, lookups] = await Promise.all([listStudents(q), getAdminLookups()]);
  const canExport = hasPermission(user, "students.export");
  const base = "/admin/students";

  const isEmpty = data.meta.total === 0 && !Object.keys(sp).length;

  return (
    <AdminListPage
      header={{
        title: "Students",
        description: `${formatNumber(data.meta.total)} registered student${data.meta.total === 1 ? "" : "s"} match the current filters.`,
        actions: <ExportButton href={withParams("/api/admin/students/export", sp, { page: undefined, limit: undefined })} disabled={!canExport} />,
      }}
      filters={
        <FilterBar
          lookups={lookups}
          fields={[
            { type: "search", placeholder: "Name, Student ID, mobile or email" },
            { type: "select", name: "status", label: "Status", options: STATUS_OPTIONS },
            { type: "location" },
            { type: "center" },
            { type: "course" },
            { type: "batch" },
            { type: "date-range", label: "Registered between" },
          ]}
        />
      }
      pagination={isEmpty ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {isEmpty ? (
        <EmptyState icon={<GraduationCap className="h-7 w-7" />} title="No students yet" description="Students appear here the moment they register on the website — no manual entry needed." />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Student ID</TH>
              <TH>Mobile</TH>
              <TH>Location</TH>
              <TH className="text-center">Applications</TH>
              <TH className="text-center">Admissions</TH>
              <TH className="text-center">Certificates</TH>
              <TH>Account</TH>
              <TH>Registered</TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={9}>No students match these filters.</EmptyRow>}
            {data.items.map((s) => (
              <TR key={s.id}>
                <TD primary>
                  <Link href={`${base}/${s.id}`} className="flex items-center gap-3 hover:text-navy">
                    <Avatar name={s.name} src={s.photoUrl} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{s.name}</span>
                      <span className="block truncate text-caption font-normal text-muted">{s.email ?? "—"}</span>
                    </span>
                  </Link>
                  {/* Counts move into the card title on phones (the numeric columns are dropped there). */}
                  <span className="mt-2 flex flex-wrap gap-1.5 md:hidden">
                    <Badge tone="neutral">{s._count.applications} applications</Badge>
                    <Badge tone="neutral">{s._count.admissions} admissions</Badge>
                    <Badge tone="neutral">{s._count.certificates} certificates</Badge>
                  </span>
                </TD>
                <TD label="Student ID">{s.studentId ? <span className="font-mono text-caption font-semibold text-navy">{s.studentId}</span> : <span className="text-caption text-muted">Not generated</span>}</TD>
                <TD label="Mobile" className="tabular-nums">
                  <a href={`tel:${s.mobile}`} className="font-medium text-navy md:text-ink md:hover:text-navy">
                    {s.mobile}
                  </a>
                </TD>
                <TD label="Location">
                  <span className="block text-body-sm">{[s.block?.name, s.district?.name].filter(Boolean).join(", ") || "—"}</span>
                  <span className="block text-caption text-muted">{s.state?.name ?? ""}</span>
                </TD>
                <TD mobile="hidden" className="text-center tabular-nums">
                  {s._count.applications}
                </TD>
                <TD mobile="hidden" className="text-center tabular-nums">
                  {s._count.admissions}
                </TD>
                <TD mobile="hidden" className="text-center tabular-nums">
                  {s._count.certificates}
                </TD>
                <TD label="Account">
                  <span className="flex flex-wrap items-center justify-end gap-1 md:justify-start">
                    <StatusBadge status={s.user.status} />
                    {!s.profileCompleted && <Badge tone="warning">Profile incomplete</Badge>}
                  </span>
                </TD>
                <TD label="Registered" className="text-muted md:whitespace-nowrap">
                  {formatDate(s.createdAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
