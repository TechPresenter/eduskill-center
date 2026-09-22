import Link from "next/link";
import { Coins } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatINR, formatNumber, titleCase } from "@/lib/utils";
import { awardListSchema, listAwards, listPendingScholarshipRequests, listPrograms, pendingRequestSchema, programListSchema, scholarshipCounts } from "@/server/scholarship-programs";
import { getAdminLookups } from "@/server/admissions";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pager } from "@/components/admin/pickers/pager";
import { EmptyState } from "@/components/ui/feedback";
import { StatsCard } from "@/components/ui/stats";
import { AdminListPage } from "@/components/admin/shared/list-page";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { NewProgramButton, ProgramRowActions } from "@/components/admin/scholarships/program-actions";
import { QuickDecideButton } from "@/components/admin/scholarships/quick-decide";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Scholarships" };

const TYPE_OPTIONS = ["FULL", "PARTIAL", "NEED_BASED", "SPECIAL"].map((t) => ({ value: t, label: titleCase(t) }));
const AWARD_STATUS_OPTIONS = ["APPROVED", "REJECTED", "PENDING"].map((t) => ({ value: t, label: titleCase(t) }));

export default async function ScholarshipsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("scholarships.view");
  const sp = flattenSearchParams(await searchParams);
  const tab = sp.tab === "awards" || sp.tab === "requests" ? sp.tab : "programs";
  const can = {
    create: hasPermission(user, "scholarships.create"),
    update: hasPermission(user, "scholarships.update"),
    delete: hasPermission(user, "scholarships.delete"),
    approve: hasPermission(user, "scholarships.approve"),
    export: hasPermission(user, "scholarships.view"),
  };
  const [counts, lookups] = await Promise.all([scholarshipCounts(), getAdminLookups()]);
  const base = "/admin/scholarships";

  let body: React.ReactNode;
  if (tab === "programs") {
    const q = parseListQuery(programListSchema, sp);
    const data = await listPrograms(q);
    body = (
      <>
        <FilterBar
          preserve={["tab"]}
          fields={[
            { type: "search", placeholder: "Program name or slug" },
            { type: "select", name: "type", label: "Type", options: TYPE_OPTIONS },
            {
              type: "select",
              name: "active",
              label: "Status",
              options: [
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
            },
          ]}
        />
        {data.meta.total === 0 && !sp.q && !sp.type && !sp.active ? (
          <EmptyState icon={<Coins className="h-7 w-7" />} title="No scholarship programs" description="Create a program to give staff a default award amount and eligibility criteria." action={<NewProgramButton allowed={can.create} />} />
        ) : (
          <>
            <TableWrap>
              <THead>
                <tr>
                  <TH>Program</TH>
                  <TH>Type</TH>
                  <TH>Default award</TH>
                  <TH className="text-right">Budget</TH>
                  <TH className="text-right">Approved</TH>
                  <TH>Validity</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </tr>
              </THead>
              <TBody>
                {data.items.length === 0 && <EmptyRow colSpan={8}>No programs match these filters.</EmptyRow>}
                {data.items.map((p) => (
                  <TR key={p.id}>
                    <TD primary>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block font-semibold">{p.name}</span>
                          <span className="block text-caption font-normal text-muted">{p.slug}</span>
                          {p.eligibilityCriteria && (
                            <span className="block truncate text-caption font-normal text-muted md:max-w-72" title={p.eligibilityCriteria}>
                              {p.eligibilityCriteria}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 md:hidden">
                          <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} />
                        </span>
                      </span>
                    </TD>
                    <TD label="Type">{titleCase(p.type)}</TD>
                    <TD label="Default award">
                      {p.fixedAmount !== null ? formatINR(p.fixedAmount) : p.percentage !== null ? `${p.percentage}% of fee` : <span className="text-caption text-muted">Case by case</span>}
                      {p.maxAmount !== null && <span className="block text-caption text-muted">max {formatINR(p.maxAmount)}</span>}
                    </TD>
                    <TD label="Budget" className="text-right tabular-nums">
                      {p.budget !== null ? formatINR(p.budget) : "—"}
                    </TD>
                    <TD label="Approved" className="text-right tabular-nums">
                      <span className="block font-semibold">{formatINR(p.awardedTotal)}</span>
                      <span className="text-caption text-muted">
                        {p.approvedCount} approved · {p.awardsCount} total
                      </span>
                      {p.budget !== null && p.budget > 0 && p.awardedTotal > p.budget && (
                        <Badge tone="danger" className="mt-1">
                          Over budget
                        </Badge>
                      )}
                    </TD>
                    <TD label="Validity" className="text-caption text-muted md:whitespace-nowrap">
                      {p.startDate || p.endDate ? `${p.startDate ? formatDate(p.startDate) : "…"} – ${p.endDate ? formatDate(p.endDate) : "…"}` : "Open-ended"}
                    </TD>
                    <TD mobile="hidden">
                      <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} />
                    </TD>
                    <TD actions>
                      <ProgramRowActions program={p} can={can} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
            <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
          </>
        )}
      </>
    );
  } else if (tab === "awards") {
    const q = parseListQuery(awardListSchema, sp);
    const data = await listAwards(q);
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatsCard label="Awards in view" value={data.meta.total} tone="navy" />
          <StatsCard label="Approved amount" value={formatINR(data.approvedTotal)} tone="success" />
          <StatsCard label="Pending requests" value={counts.pending} tone="warning" href={withParams(base, {}, { tab: "requests" })} />
        </div>
        <FilterBar
          lookups={lookups}
          preserve={["tab"]}
          fields={[
            { type: "search", placeholder: "Student name, Student ID, mobile or application no" },
            { type: "program" },
            { type: "select", name: "status", label: "Decision", options: AWARD_STATUS_OPTIONS },
            { type: "center" },
            { type: "course" },
            { type: "date-range", label: "Decided between" },
          ]}
        />
        <TableWrap>
          <THead>
            <tr>
              <TH>Student</TH>
              <TH>Application</TH>
              <TH>Program</TH>
              <TH className="text-right">Fee</TH>
              <TH className="text-right">Scholarship</TH>
              <TH className="text-right">Payable</TH>
              <TH>Decision</TH>
              <TH>Decided by</TH>
            </tr>
          </THead>
          <TBody>
            {data.items.length === 0 && <EmptyRow colSpan={8}>No awards match these filters.</EmptyRow>}
            {data.items.map((a) => (
              <TR key={a.id}>
                <TD primary>
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <Link href={`/admin/students/${a.student.id}`} className="font-semibold hover:text-navy">
                        {a.student.name}
                      </Link>
                      <span className="block font-mono text-caption font-normal text-muted">{a.student.studentId ?? a.student.mobile}</span>
                    </span>
                    <span className="shrink-0 text-right md:hidden">
                      <span className="block text-h4 text-success-dark tabular-nums">{formatINR(a.scholarshipAmount)}</span>
                      <StatusBadge status={a.status} className="mt-1" />
                    </span>
                  </span>
                </TD>
                <TD label="Application">
                  <Link href={`/admin/applications/${a.application.id}`} className="font-mono text-caption text-navy hover:underline">
                    {a.application.applicationNo}
                  </Link>
                  <span className="block text-caption text-muted">{a.course.name}</span>
                  <span className="block text-caption text-muted">{a.application.center.name}</span>
                </TD>
                <TD label="Program">{a.program ? a.program.name : <span className="text-caption text-muted">Ad-hoc</span>}</TD>
                <TD label="Fee" className="text-right tabular-nums">
                  {formatINR(a.originalFee)}
                </TD>
                <TD mobile="hidden" className="text-right font-semibold text-success-dark tabular-nums">
                  {formatINR(a.scholarshipAmount)}
                </TD>
                <TD label="Payable" className="text-right tabular-nums">
                  {formatINR(a.payableFee)}
                </TD>
                <TD label="Remarks">
                  <span className="hidden md:inline">
                    <StatusBadge status={a.status} />
                  </span>
                  {a.remarks ? (
                    <span className="block truncate text-caption text-muted md:max-w-48" title={a.remarks}>
                      {a.remarks}
                    </span>
                  ) : (
                    <span className="text-caption text-muted md:hidden">—</span>
                  )}
                </TD>
                <TD label="Decided by" className="text-caption text-muted">
                  {a.approvedByName ?? "—"}
                  <span className="block">{formatDate(a.approvedAt ?? a.createdAt)}</span>
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
        <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
      </>
    );
  } else {
    const q = parseListQuery(pendingRequestSchema, sp);
    const data = await listPendingScholarshipRequests(q);
    body = (
      <>
        <FilterBar
          lookups={lookups}
          preserve={["tab"]}
          fields={[
            { type: "search", placeholder: "Application no, student name or mobile" },
            { type: "center" },
            { type: "course" },
          ]}
        />
        {data.meta.total === 0 && !sp.q && !sp.centerId && !sp.courseId ? (
          <EmptyState icon={<Coins className="h-7 w-7" />} title="No pending requests" description="Every scholarship request has a decision. New requests appear here when students apply." />
        ) : (
          <>
            <TableWrap>
              <THead>
                <tr>
                  <TH>Application</TH>
                  <TH>Student</TH>
                  <TH>Course & center</TH>
                  <TH className="text-right">Fee</TH>
                  <TH>Reason</TH>
                  <TH>Submitted</TH>
                  <TH>Actions</TH>
                </tr>
              </THead>
              <TBody>
                {data.items.length === 0 && <EmptyRow colSpan={7}>No requests match these filters.</EmptyRow>}
                {data.items.map((a) => (
                  <TR key={a.id}>
                    <TD primary>
                      <span className="flex items-start justify-between gap-2">
                        <Link href={`/admin/applications/${a.id}`} className="font-mono text-caption font-semibold text-navy hover:underline">
                          {a.applicationNo}
                        </Link>
                        <span className="shrink-0 md:hidden">
                          <StatusBadge status={a.status} />
                        </span>
                      </span>
                      <span className="mt-1 hidden md:block">
                        <StatusBadge status={a.status} />
                      </span>
                    </TD>
                    <TD label="Student">
                      <Link href={`/admin/students/${a.student.id}`} className="font-semibold hover:text-navy">
                        {a.student.name}
                      </Link>
                      <span className="block text-caption text-muted">{[a.student.familyIncome, titleCase(a.student.areaType), a.student.qualification].filter(Boolean).join(" · ") || a.student.mobile}</span>
                    </TD>
                    <TD label="Course & center">
                      <span className="block">{a.course.name}</span>
                      <span className="text-caption text-muted">{a.center.name}</span>
                      {!a.course.scholarshipAvailable && (
                        <Badge tone="warning" className="mt-1">
                          Course not scholarship-eligible
                        </Badge>
                      )}
                    </TD>
                    <TD label="Fee" className="text-right tabular-nums">
                      {formatINR(a.originalFee)}
                      {a.discountAmount > 0 && <span className="block text-caption text-muted">discount {formatINR(a.discountAmount)}</span>}
                    </TD>
                    <TD label="Reason" className="text-caption text-muted md:max-w-64">
                      <span className="line-clamp-3" title={a.scholarshipReason ?? undefined}>
                        {a.scholarshipReason ?? "—"}
                      </span>
                    </TD>
                    <TD label="Submitted" className="text-muted md:whitespace-nowrap">
                      {formatDate(a.submittedAt ?? a.createdAt)}
                    </TD>
                    <TD actions>
                      <div className="flex flex-wrap items-center justify-end gap-2 md:gap-1.5">
                        <QuickDecideButton applicationId={a.id} applicationNo={a.applicationNo} studentName={a.student.name} courseName={a.course.name} originalFee={a.originalFee} discountAmount={a.discountAmount} reason={a.scholarshipReason} programs={lookups.programs} allowed={can.approve} />
                        <ButtonLink href={`/admin/applications/${a.id}`} variant="outline" size="sm">
                          Open application
                        </ButtonLink>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
            <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
          </>
        )}
      </>
    );
  }

  return (
    <AdminListPage
      header={{
        title: "Scholarships",
        description: `${formatNumber(counts.programs)} program${counts.programs === 1 ? "" : "s"} · ${formatNumber(counts.awards)} award${counts.awards === 1 ? "" : "s"} · ${formatNumber(counts.pending)} pending request${counts.pending === 1 ? "" : "s"}.`,
        actions: (
          <>
            {tab === "awards" && <ExportButton href={withParams("/api/admin/scholarships/awards/export", sp, { page: undefined, limit: undefined, tab: undefined })} disabled={!can.export} />}
            {tab === "programs" && <NewProgramButton allowed={can.create} />}
          </>
        ),
      }}
      tabs={
        <QueryTabs
          param="tab"
          defaultValue="programs"
          items={[
            { value: "programs", label: "Programs", count: counts.programs },
            { value: "awards", label: "Awards", count: counts.awards },
            { value: "requests", label: "Pending requests", count: counts.pending },
          ]}
        />
      }
    >
      {body}
    </AdminListPage>
  );
}
