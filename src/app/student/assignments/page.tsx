import type { Metadata } from "next";
import { FileText, Paperclip } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { listStudentAssignments } from "@/server/student-portal";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { AssignmentSubmit } from "@/components/student/assignment-submit";

export const metadata: Metadata = { title: "Assignments" };

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  NOT_SUBMITTED: { label: "Not submitted", tone: "warning" },
  OVERDUE: { label: "Overdue", tone: "danger" },
  SUBMITTED: { label: "Submitted", tone: "info" },
  LATE: { label: "Submitted late", tone: "warning" },
  GRADED: { label: "Graded", tone: "success" },
};

export default async function StudentAssignmentsPage() {
  const user = await requireStudent();
  const assignments = await listStudentAssignments(user.student.id);
  const pending = assignments.filter((a) => a.studentStatus === "NOT_SUBMITTED" || a.studentStatus === "OVERDUE").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Assignments" description={assignments.length ? `${pending} pending · ${assignments.length - pending} submitted` : "Assignments set by your trainer appear here."} />
      {assignments.length === 0 ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="No assignments yet" description="Your trainer has not set any assignments for your batch." />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const st = STATUS[a.studentStatus] ?? STATUS.NOT_SUBMITTED!;
            return (
              <Card key={a.id}>
                <CardHeader
                  title={a.title}
                  description={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        {a.batch.course.name} · {a.batch.name}
                      </span>
                      {a.trainer && <span>Set by {a.trainer.user.name}</span>}
                      <span>Max {a.maxMarks} marks</span>
                      {a.dueDate && <span className={a.studentStatus === "OVERDUE" ? "font-semibold text-danger" : ""}>Due {formatDateTime(a.dueDate)}</span>}
                    </span>
                  }
                  action={<Badge tone={st.tone}>{st.label}</Badge>}
                />
                <CardBody className="space-y-4">
                  {a.description && <p className="text-sm whitespace-pre-line text-ink">{a.description}</p>}
                  {a.attachmentUrl && (
                    <a href={a.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">
                      <Paperclip className="h-4 w-4" /> Assignment attachment
                    </a>
                  )}
                  {a.submission && (
                    <div className="rounded-xl border border-line bg-surface/60 p-4 text-sm">
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Your submission · {formatDateTime(a.submission.submittedAt)}</p>
                      {a.submission.text && <p className="mt-1 whitespace-pre-line text-ink">{a.submission.text}</p>}
                      {a.submission.fileUrl && (
                        <a href={a.submission.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-navy hover:underline">
                          <Paperclip className="h-4 w-4" /> Attached file
                        </a>
                      )}
                      {a.submission.status === "GRADED" && (
                        <div className="mt-3 rounded-lg bg-success-light p-3">
                          <p className="font-bold text-green-800">
                            Marks: {a.submission.marks ?? "—"} / {a.maxMarks}
                          </p>
                          {a.submission.feedback && <p className="mt-0.5 text-green-900">Feedback: {a.submission.feedback}</p>}
                          {a.submission.gradedAt && <p className="mt-0.5 text-xs text-green-800/80">Graded {formatDateTime(a.submission.gradedAt)}</p>}
                        </div>
                      )}
                    </div>
                  )}
                  {a.canSubmit && <AssignmentSubmit assignmentId={a.id} hasSubmission={!!a.submission} overdue={a.studentStatus === "OVERDUE"} initialText={a.submission?.text ?? ""} />}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
