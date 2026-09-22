import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { listStudentAssessments } from "@/server/student-portal";
import { formatDate, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";

export const metadata: Metadata = { title: "Assessments" };

export default async function StudentAssessmentsPage() {
  const user = await requireStudent();
  const assessments = await listStudentAssessments(user.student.id);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Assessments" description="Quizzes, practicals and exams for your batch, with your results once evaluated." />
      {assessments.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-7 w-7" />} title="No assessments yet" description="Assessments scheduled by your trainer will be listed here." />
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {assessments.map((a) => (
              <li key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-navy">{a.title}</p>
                    <p className="text-caption text-muted">
                      {a.batch.course.name} · {titleCase(a.type)} · {formatDate(a.date)}
                    </p>
                  </div>
                  <ResultBadge a={a} />
                </div>
                <p className="mt-2 text-body-sm text-ink">
                  Max {a.maxMarks} · Pass {a.passingMarks}
                  {a.result && (
                    <>
                      {" "}
                      · <span className="font-semibold">Scored {a.result.marks}</span>
                      {a.result.grade ? ` (${a.result.grade})` : ""}
                    </>
                  )}
                </p>
                {a.result?.remarks && <p className="mt-1 text-caption text-muted">Remarks: {a.result.remarks}</p>}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <TableWrap>
              <THead>
                <tr>
                  <TH>Assessment</TH>
                  <TH>Batch</TH>
                  <TH>Date</TH>
                  <TH className="text-right">Max</TH>
                  <TH className="text-right">Passing</TH>
                  <TH className="text-right">Your marks</TH>
                  <TH>Grade</TH>
                  <TH>Result</TH>
                </tr>
              </THead>
              <TBody>
                {assessments.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-caption text-muted">{titleCase(a.type)}</p>
                    </TD>
                    <TD className="text-body-sm">
                      {a.batch.course.name}
                      <p className="text-caption text-muted">{a.batch.name}</p>
                    </TD>
                    <TD className="text-body-sm">{formatDate(a.date)}</TD>
                    <TD className="text-right tabular-nums">{a.maxMarks}</TD>
                    <TD className="text-right tabular-nums">{a.passingMarks}</TD>
                    <TD className="text-right font-semibold tabular-nums">{a.result ? a.result.marks : "—"}</TD>
                    <TD className="text-body-sm">{a.result?.grade ?? "—"}</TD>
                    <TD>
                      <ResultBadge a={a} />
                      {a.result?.remarks && <p className="mt-0.5 max-w-[14rem] text-caption text-muted">{a.result.remarks}</p>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          </div>
        </>
      )}
    </div>
  );
}

function ResultBadge({ a }: { a: { isUpcoming: boolean; passingMarks: number; result: { marks: number } | null } }) {
  if (a.result) {
    const passed = a.result.marks >= a.passingMarks;
    return <Badge tone={passed ? "success" : "danger"}>{passed ? "Passed" : "Not passed"}</Badge>;
  }
  if (a.isUpcoming) return <Badge tone="info">Upcoming</Badge>;
  return <Badge tone="warning">Awaiting result</Badge>;
}
