import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDate, formatNumber } from "@/lib/utils";
import { admissionListSchema, listAdmissions, getAdminLookups } from "@/server/admissions";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD, EmptyRow } from "@/components/ui/table";
import { Pager } from "@/components/admin/pickers/pager";
import { EmptyState } from "@/components/ui/feedback";
import { ProgressBar, StatsCard } from "@/components/ui/stats";
import { FilterBar } from "@/components/admin/pickers/filter-bar";
import { BatchProgressActions, ProgressRowActions } from "@/components/admin/progress/progress-actions";
import { flattenSearchParams, parseListQuery, withParams, type RawSearchParams } from "@/components/admin/pickers/search-params";

export const metadata = { title: "Student Progress" };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireAdmin("progress.view");
  const sp = flattenSearchParams(await searchParams);
  const q = parseListQuery(admissionListSchema, sp);
  const [data, lookups, totals] = await Promise.all([
    listAdmissions(q),
    getAdminLookups(),
    Promise.all([
      db.admission.count({ where: { status: { in: ["ACTIVE", "ON_HOLD"] } } }),
      db.admission.count({ where: { status: "COMPLETED" } }),
      db.admission.count({ where: { progress: { certificateEligible: true }, certificate: null } }),
    ]),
  ]);
  const canUpdate = hasPermission(user, "progress.update");
  const base = "/admin/progress";
  const batch = q.batchId ? lookups.batches.find((b) => b.id === q.batchId) : undefined;
  const activeInBatch = batch ? await db.admission.count({ where: { batchId: batch.id, status: { in: ["ACTIVE", "ON_HOLD"] } } }) : 0;

  return (
    <div>
      <PageHeader title="Student Progress" description={`${formatNumber(data.meta.total)} admission${data.meta.total === 1 ? "" : "s"} in the current view.`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatsCard label="In training" value={totals[0]} tone="info" href={withParams(base, {}, { completed: "false" })} />
        <StatsCard label="Completed" value={totals[1]} tone="navy" href={withParams(base, {}, { completed: "true" })} />
        <StatsCard label="Awaiting certificate" value={totals[2]} tone="success" href="/admin/certificates?tab=eligible" />
      </div>

      <FilterBar
        lookups={lookups}
        fields={[
          { type: "search", placeholder: "Admission no, student name, Student ID or mobile" },
          {
            type: "select",
            name: "completed",
            label: "Training",
            options: [
              { value: "false", label: "In training" },
              { value: "true", label: "Completed" },
            ],
          },
          {
            type: "select",
            name: "eligible",
            label: "Certificate eligibility",
            options: [
              { value: "true", label: "Eligible" },
              { value: "false", label: "Not eligible" },
            ],
          },
          { type: "center" },
          { type: "course" },
          { type: "batch" },
        ]}
      />

      {batch && (
        <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-navy">
              Batch {batch.code} <StatusBadge status={batch.status} className="ml-1" />
            </p>
            <p className="text-xs text-muted">
              {batch.name} · {formatDate(batch.startDate)} – {formatDate(batch.endDate)} · {activeInBatch} active student{activeInBatch === 1 ? "" : "s"}
            </p>
          </div>
          <BatchProgressActions batchId={batch.id} batchCode={batch.code} batchStatus={batch.status} activeCount={activeInBatch} allowed={canUpdate} />
        </div>
      )}

      {data.meta.total === 0 && !Object.keys(sp).length ? (
        <EmptyState icon={<TrendingUp className="h-7 w-7" />} title="No admissions yet" description="Progress is tracked for every confirmed admission." />
      ) : (
        <>
          <TableWrap>
            <THead>
              <tr>
                <TH>Student</TH>
                <TH>Course & batch</TH>
                <TH>Attendance</TH>
                <TH>Assessment</TH>
                <TH>Completion</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </tr>
            </THead>
            <TBody>
              {data.items.length === 0 && <EmptyRow colSpan={7}>No admissions match these filters.</EmptyRow>}
              {data.items.map((a) => {
                const p = a.progress;
                return (
                  <TR key={a.id}>
                    <TD primary>
                      <span className="flex items-start justify-between gap-2">
                        <Link href={`${base}/${a.id}`} className="flex min-w-0 items-center gap-3 hover:text-navy">
                          <Avatar name={a.student.name} src={a.student.photoUrl} size={34} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{a.student.name}</span>
                            <span className="block font-mono text-xs font-normal text-muted">{a.student.studentId ?? a.admissionNo}</span>
                          </span>
                        </Link>
                        {/* The status column is dropped on phones – badges lead the card instead. */}
                        <span className="flex shrink-0 flex-wrap justify-end gap-1 md:hidden">
                          <StatusBadge status={a.status} />
                          {a.certificate ? <Badge tone="success">Certified</Badge> : p?.certificateEligible ? <Badge tone="navy">Eligible</Badge> : null}
                        </span>
                      </span>
                    </TD>
                    <TD label="Course & batch">
                      <span className="block">{a.course.name}</span>
                      <span className="text-xs text-muted">
                        {a.batch.code} · {a.center.name}
                      </span>
                    </TD>
                    <TD label="Attendance" className="md:min-w-36">
                      {p ? (
                        <>
                          <ProgressBar value={p.attendancePct} tone={p.attendancePct >= a.course.minAttendancePct ? "success" : "warning"} />
                          <span className="text-[11px] text-muted">
                            {p.attendancePct}% · {p.classesAttended}/{p.classesHeld} (min {a.course.minAttendancePct}%)
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </TD>
                    <TD label="Assessment" className="md:min-w-36">
                      {p ? (
                        <>
                          <ProgressBar value={p.assessmentAvgPct} tone={p.assessmentAvgPct === 0 ? "navy" : p.assessmentAvgPct >= a.course.passingMarksPct ? "success" : "warning"} />
                          <span className="text-[11px] text-muted">{p.assessmentAvgPct > 0 ? `${p.assessmentAvgPct}% (pass ${a.course.passingMarksPct}%)` : "No assessments yet"}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </TD>
                    <TD label="Completion" className="md:min-w-36">
                      {p ? (
                        <>
                          <ProgressBar value={p.completionPct} tone="orange" />
                          <span className="text-[11px] text-muted">{Math.round(p.completionPct)}%{p.isCompleted ? ` · done ${formatDate(p.completedAt)}` : ""}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">Not computed</span>
                      )}
                    </TD>
                    <TD mobile="hidden">
                      <StatusBadge status={a.status} />
                      {a.certificate ? (
                        <Badge tone="success" className="mt-1">
                          Certified
                        </Badge>
                      ) : p?.certificateEligible ? (
                        <Badge tone="navy" className="mt-1">
                          Eligible
                        </Badge>
                      ) : null}
                    </TD>
                    <TD actions>
                      <ProgressRowActions admissionId={a.id} studentName={a.student.name} status={a.status} allowed={canUpdate} compact />
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
