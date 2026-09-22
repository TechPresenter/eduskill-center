import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/utils";
import { listTrainerApplications, trainerApplicationListSchema } from "@/server/trainers";
import { getAdminLookups } from "@/server/admissions";
import { Avatar } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { Pager } from "@/components/admin/pickers/pager";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Trainer Applications" };

const STATUS_TABS = ["SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "SHORTLISTED", "INTERVIEW", "VERIFIED", "APPROVED", "REJECTED"] as const;
const LEVELS = ["BLOCK", "DISTRICT", "STATE"] as const;

export default async function TrainerApplicationsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("trainers.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(trainerApplicationListSchema, sp);
  const [data, lookups, counts, skillRows] = await Promise.all([
    listTrainerApplications(q),
    getAdminLookups(),
    db.trainerApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    db.trainerApplication.findMany({ select: { skills: true }, take: 2000 }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((n, c) => n + c._count._all, 0);
  const skills = [...new Set(skillRows.flatMap((r) => r.skills))].sort((a, b) => a.localeCompare(b));
  const canExport = hasPermission(user, "trainers.export");
  const base = "/admin/trainer-applications";
  const filterKeys = ["level", "stateId", "districtId", "blockId", "skill", "courseId", "from", "to", "q"];

  return (
    <AdminListPage
      header={{
        title: "Trainer Applications",
        mobileTitle: "Trainer applications",
        description: `${formatNumber(data.meta.total)} volunteer application${data.meta.total === 1 ? "" : "s"} in the current view.`,
        actions: <ExportButton href={withParams("/api/admin/trainer-applications/export", sp, { page: undefined, limit: undefined })} disabled={!canExport} />,
      }}
      tabs={<QueryTabs param="status" keep={filterKeys} items={[{ value: "", label: "All", count: all }, ...STATUS_TABS.map((s) => ({ value: s, label: titleCase(s), count: countOf(s) }))]} />}
      filters={
        <FilterBar
          lookups={lookups}
          preserve={["status"]}
          fields={[
            { type: "search", placeholder: "Application no, name, email or mobile" },
            { type: "select", name: "level", label: "Volunteer level", options: LEVELS.map((l) => ({ value: l, label: titleCase(l) })) },
            { type: "select", name: "skill", label: "Skill", options: skills.map((s) => ({ value: s, label: s })), placeholder: skills.length ? "All skills" : "No skills yet" },
            { type: "course", label: "Preferred course" },
            { type: "location" },
            { type: "date-range", label: "Submitted between" },
          ]}
        />
      }
      pagination={all === 0 ? undefined : <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />}
    >
      {all === 0 ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="No trainer applications yet" description="Volunteer applications submitted from the Become a Trainer page land here for review." />
      ) : (
        <TableWrap>
          <THead>
            <tr>
              <TH>Application</TH>
              <TH>Applicant</TH>
              <TH>Level & location</TH>
              <TH>Skills</TH>
              <TH className="text-center">Experience</TH>
              <TH className="text-center">Docs</TH>
              <TH>Status</TH>
              <TH>Submitted</TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={8}>No applications match these filters.</EmptyRow>}
            {data.items.map((a) => (
              <TR key={a.id}>
                <TD label="Application" mobile="hidden">
                  <Link href={`${base}/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                    {a.applicationNo}
                  </Link>
                  {a.interviewAt && <span className="mt-0.5 block text-caption text-muted">Interview {formatDateTime(a.interviewAt)}</span>}
                </TD>
                <TD mobile="full">
                  <Link href={`${base}/${a.id}`} className="flex items-center gap-3 tap-highlight-none md:hover:text-navy">
                    <Avatar name={a.name} src={a.photoUrl} size={40} />
                    <span className="min-w-0">
                      <span className="block font-mono text-caption font-semibold text-orange md:hidden">{a.applicationNo}</span>
                      <span className="block truncate font-semibold">{a.name}</span>
                      <span className="block truncate text-caption font-normal text-muted">{a.email}</span>
                      <span className="block text-caption font-normal text-muted tabular-nums">{a.mobile}</span>
                    </span>
                  </Link>
                  {a.interviewAt && <span className="mt-1 block text-caption font-normal text-orange md:hidden">Interview {formatDateTime(a.interviewAt)}</span>}
                </TD>
                <TD label="Level & location" className="max-md:text-right">
                  <Badge tone="navy">{titleCase(a.level)}</Badge>
                  <span className="mt-1 block text-caption text-muted">{[a.block?.name, a.district?.name, a.state.name].filter(Boolean).join(", ")}</span>
                </TD>
                <TD label="Skills" className="md:max-w-[16rem]">
                  <span className="flex flex-wrap gap-1 max-md:justify-end">
                    {a.skills.slice(0, 3).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                    {a.skills.length > 3 && <span className="text-caption text-muted">+{a.skills.length - 3} more</span>}
                  </span>
                </TD>
                <TD label="Experience" className="text-caption tabular-nums md:text-center">
                  <span className="block">{a.experienceYears} yrs</span>
                  <span className="text-muted">{a.teachingExperienceYears} yrs teaching</span>
                </TD>
                <TD label="Documents" className="tabular-nums md:text-center">
                  {a._count.documents}
                </TD>
                <TD label="Status">
                  <StatusBadge status={a.status} />
                </TD>
                <TD label="Submitted" className="text-muted md:whitespace-nowrap">
                  {formatDate(a.submittedAt)}
                </TD>
                <TD mobile="actions" className="md:hidden">
                  <ButtonLink href={`${base}/${a.id}`} variant="navy" size="sm" className="w-full">
                    Review application
                  </ButtonLink>
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      )}
    </AdminListPage>
  );
}
