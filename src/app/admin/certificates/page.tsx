import Link from "next/link";
import { Award } from "lucide-react";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { optionalUuid, paginationSchema } from "@/lib/api/query";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import { certificateListSchema, gradeFor, listCertificateCandidates, listCertificates } from "@/server/certificates";
import { getAdminLookups, progressNumbers } from "@/server/admissions";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pager } from "@/components/admin/pickers/pager";
import { EmptyState } from "@/components/ui/feedback";
import { StatsCard } from "@/components/ui/stats";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { QueryTabs } from "@/components/admin/pickers/query-tabs";
import { ExportButton } from "@/components/admin/pickers/export-button";
import { CertificateRowActions } from "@/components/admin/certificates/certificate-actions";
import { EligibleTable, type Candidate } from "@/components/admin/certificates/eligible-table";
import { ForceIssueForm } from "@/components/admin/certificates/force-issue-form";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Certificates" };

const candidateSchema = paginationSchema.extend({ centerId: optionalUuid, courseId: optionalUuid, batchId: optionalUuid });

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("certificates.view");
  const sp = flattenSearchParams(await searchParams);
  const tab = sp.tab === "eligible" || sp.tab === "force" ? sp.tab : "issued";
  const can = { issue: hasPermission(user, "certificates.issue"), revoke: hasPermission(user, "certificates.revoke"), export: hasPermission(user, "certificates.export") };
  const [lookups, issuedCount, revokedCount, eligibleCount, verifications] = await Promise.all([
    getAdminLookups(),
    db.certificate.count({ where: { status: "ISSUED" } }),
    db.certificate.count({ where: { status: "REVOKED" } }),
    db.admission.count({ where: { certificate: null, progress: { certificateEligible: true } } }),
    db.certificate.aggregate({ _sum: { verificationCount: true } }),
  ]);
  const base = "/admin/certificates";

  let body: React.ReactNode;
  if (tab === "issued") {
    const q = parseListQuery(certificateListSchema, sp);
    const data = await listCertificates(q);
    body = (
      <>
        <FilterBar
          lookups={lookups}
          preserve={["tab"]}
          fields={[
            { type: "search", placeholder: "Certificate no, student name or Student ID" },
            {
              type: "select",
              name: "status",
              label: "Status",
              options: [
                { value: "ISSUED", label: "Issued" },
                { value: "REVOKED", label: "Revoked" },
              ],
            },
            { type: "center" },
            { type: "course" },
            { type: "date-range", label: "Issued between" },
          ]}
        />
        {data.meta.total === 0 && !Object.keys(sp).some((k) => k !== "tab") ? (
          <EmptyState icon={<Award className="h-7 w-7" />} title="No certificates issued yet" description="Issue certificates to eligible students from the Eligible tab." action={<Link href={withParams(base, {}, { tab: "eligible" })} className="text-sm font-semibold text-navy hover:underline">View eligible students</Link>} />
        ) : (
          <>
            <TableWrap>
              <THead>
                <tr>
                  <TH>Certificate</TH>
                  <TH>Student</TH>
                  <TH>Course</TH>
                  <TH>Center & batch</TH>
                  <TH>Completed</TH>
                  <TH>Issued</TH>
                  <TH>Grade</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </tr>
              </THead>
              <TBody>
                {data.items.length === 0 && <EmptyRow colSpan={9}>No certificates match these filters.</EmptyRow>}
                {data.items.map((c) => (
                  <TR key={c.id}>
                    <TD primary>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="font-mono text-xs font-semibold text-navy">{c.certificateNo}</span>
                          <span className="block text-[11px] font-normal text-muted">
                            {formatNumber(c.verificationCount)} verification{c.verificationCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        {/* The status column is dropped on phones – the badge leads the card instead. */}
                        <span className="shrink-0 md:hidden">
                          <StatusBadge status={c.status} />
                        </span>
                      </span>
                      {c.revokedAt && (
                        <span className="mt-1 block text-[11px] font-normal text-danger md:hidden">
                          {formatDate(c.revokedAt)} · {c.revokedReason}
                        </span>
                      )}
                    </TD>
                    <TD label="Student">
                      <Link href={`/admin/students/${c.student.id}`} className="font-semibold hover:text-navy">
                        {c.studentName}
                      </Link>
                      <span className="block font-mono text-xs text-muted">{c.student.studentId ?? "—"}</span>
                    </TD>
                    <TD label="Course">
                      {c.courseName}
                      <span className="block text-xs text-muted">{c.durationText}</span>
                    </TD>
                    <TD label="Center & batch">
                      <span className="block">{c.centerName}</span>
                      <Link href={`/admin/admissions/${c.admission.id}`} className="font-mono text-xs text-muted hover:text-navy">
                        {c.admission.batch.code} · {c.admission.admissionNo}
                      </Link>
                    </TD>
                    <TD label="Completed" className="text-muted md:whitespace-nowrap">
                      {formatDate(c.completionDate)}
                    </TD>
                    <TD label="Issued" className="text-muted md:whitespace-nowrap">
                      {formatDate(c.issuedAt)}
                    </TD>
                    <TD label="Grade">{c.grade ?? "—"}</TD>
                    <TD mobile="hidden">
                      <StatusBadge status={c.status} />
                      {c.revokedAt && (
                        <span className="block max-w-48 text-[11px] text-danger" title={c.revokedReason ?? undefined}>
                          {formatDate(c.revokedAt)} · {c.revokedReason}
                        </span>
                      )}
                    </TD>
                    <TD actions>
                      <CertificateRowActions certificateId={c.id} certificateNo={c.certificateNo} status={c.status} canRevoke={can.revoke} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
            <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
          </>
        )}
      </>
    );
  } else if (tab === "eligible") {
    const q = parseListQuery(candidateSchema, sp);
    const data = await listCertificateCandidates(q);
    const items: Candidate[] = data.items.map((a) => {
      const p = progressNumbers(a.progress);
      const finalPct = p ? (p.finalMarksPct !== null ? p.finalMarksPct : p.assessmentAvgPct || null) : null;
      return {
        admissionId: a.id,
        admissionNo: a.admissionNo,
        studentId: a.student.id,
        studentName: a.student.name,
        studentCode: a.student.studentId,
        courseName: a.course.name,
        centerName: a.center.name,
        batchCode: a.batch.code,
        completedAt: a.completedAt,
        attendancePct: p?.attendancePct ?? 0,
        assessmentAvgPct: p?.assessmentAvgPct ?? 0,
        finalMarksPct: p?.finalMarksPct ?? null,
        autoGrade: gradeFor(finalPct),
      };
    });
    body = (
      <>
        <FilterBar lookups={lookups} preserve={["tab"]} fields={[{ type: "center" }, { type: "course" }, { type: "batch", statuses: ["ONGOING", "COMPLETED"] }]} />
        <EligibleTable items={items} canIssue={can.issue} />
        <Pager className="mt-4" page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} base={base} params={sp} />
      </>
    );
  } else {
    const admissionId = z.string().uuid().safeParse(sp.admissionId);
    body = <ForceIssueForm initialAdmissionId={admissionId.success ? admissionId.data : undefined} canIssue={can.issue} />;
  }

  return (
    <div>
      <PageHeader
        title="Certificates"
        description="Issue, download, verify and revoke course completion certificates."
        actions={tab === "issued" ? <ExportButton href={withParams("/api/admin/certificates/export", sp, { page: undefined, limit: undefined, tab: undefined })} disabled={!can.export} /> : undefined}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard label="Issued" value={issuedCount} tone="success" href={withParams(base, {}, { status: "ISSUED" })} />
        <StatsCard label="Revoked" value={revokedCount} tone="warning" href={withParams(base, {}, { status: "REVOKED" })} />
        <StatsCard label="Eligible, not issued" value={eligibleCount} tone="orange" href={withParams(base, {}, { tab: "eligible" })} />
        <StatsCard label="Public verifications" value={verifications._sum.verificationCount ?? 0} tone="navy" hint={titleCase("all time")} />
      </div>
      <QueryTabs
        param="tab"
        defaultValue="issued"
        className="mb-4"
        items={[
          { value: "issued", label: "Issued", count: issuedCount + revokedCount },
          { value: "eligible", label: "Eligible", count: eligibleCount },
          { value: "force", label: "Force issue" },
        ]}
      />
      {body}
    </div>
  );
}
