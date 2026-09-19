import Link from "next/link";
import type { Metadata } from "next";
import { Award, BookOpen, CalendarDays, ClipboardCheck, FileText, ListChecks, School, TrendingUp } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ACTIVE_ADMISSION_STATUSES, listStudentAssessments, listStudentAssignments, listStudentMaterials, studentAdmissions } from "@/server/student-portal";
import { formatSchedule } from "@/server/batches";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/stats";
import { upcomingClassDays } from "@/components/student/timetable-utils";
import { QuickActions, type QuickAction } from "@/components/student/mobile";

export const metadata: Metadata = { title: "Training" };

export default async function StudentTrainingPage() {
  const user = await requireStudent();
  const [admissions, materials, assignments, assessments, certificates] = await Promise.all([
    studentAdmissions(user.student.id),
    listStudentMaterials(user.student.id),
    listStudentAssignments(user.student.id),
    listStudentAssessments(user.student.id),
    db.certificate.count({ where: { studentId: user.student.id, status: "ISSUED" } }),
  ]);

  const active = admissions.filter((a) => (ACTIVE_ADMISSION_STATUSES as string[]).includes(a.status));
  const classDays = active.flatMap((a) => upcomingClassDays(a.batch).map((d) => ({ ...d, batch: a.batch.name, course: a.course.name })));
  const pendingAssignments = assignments.filter((a) => a.studentStatus === "NOT_SUBMITTED" || a.studentStatus === "OVERDUE").length;
  const upcomingAssessments = assessments.filter((a) => a.isUpcoming).length;
  const gradedAssessments = assessments.filter((a) => a.result).length;
  const primary = active[0] ?? admissions[0] ?? null;
  const progress = primary?.progress ?? null;

  const tiles: QuickAction[] = [
    { label: "Timetable", href: "/student/timetable", icon: CalendarDays, badge: classDays.length ? `${classDays.length} class${classDays.length === 1 ? "" : "es"} this week` : null },
    { label: "Attendance", href: "/student/attendance", icon: ClipboardCheck, badge: progress ? `${Math.round(progress.attendancePct)}%` : null, attention: !!progress && !!primary && progress.attendancePct < primary.course.minAttendancePct },
    { label: "Study Material", href: "/student/materials", icon: BookOpen, badge: materials.length || null },
    { label: "Assignments", href: "/student/assignments", icon: FileText, badge: pendingAssignments ? `${pendingAssignments} pending` : assignments.length || null, attention: pendingAssignments > 0 },
    { label: "Assessments", href: "/student/assessments", icon: ListChecks, badge: upcomingAssessments ? `${upcomingAssessments} upcoming` : gradedAssessments ? `${gradedAssessments} graded` : null },
    { label: "Progress", href: "/student/progress", icon: TrendingUp, badge: progress ? `${Math.round(progress.completionPct)}% complete` : null },
    { label: "Certificates", href: "/student/certificates", icon: Award, badge: certificates || null },
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader title="Training" mobileTitle="Training" description="Everything about your classes: timetable, attendance, material, assignments, assessments, progress and certificates." />

      {admissions.length === 0 ? (
        <EmptyState
          icon={<School className="h-7 w-7" />}
          title="No training yet"
          description="Your timetable, attendance and study material appear here once your admission is confirmed."
          action={<ButtonLink href="/student/applications" variant="outline">My applications</ButtonLink>}
        />
      ) : (
        <>
          {primary && (
            <section className="card p-4" aria-label="Current batch">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-heading text-[16px] font-extrabold text-navy">{primary.course.name}</h2>
                  <p className="truncate text-[13px] text-muted">
                    {primary.batch.name} · {formatSchedule(primary.batch)}
                  </p>
                  <p className="truncate text-[12px] text-muted">
                    {primary.center.name} · {formatDate(primary.batch.startDate)} – {formatDate(primary.batch.endDate)}
                  </p>
                </div>
                <StatusBadge status={primary.status} />
              </div>
              {progress && (
                <div className="mt-3 space-y-2">
                  <ProgressBar label={`Course progress ${Math.round(progress.completionPct)}%`} value={progress.completionPct} tone="orange" />
                  <p className="text-[12px] text-muted">
                    {progress.classesAttended} of {progress.classesHeld} classes attended
                    {primary.batch.trainer?.user.name ? ` · Trainer ${primary.batch.trainer.user.name}` : ""}
                  </p>
                </div>
              )}
            </section>
          )}

          <section aria-label="Classes this week">
            <h2 className="mb-2 px-1 text-[13px] font-bold tracking-[0.14em] text-muted uppercase">Classes this week</h2>
            {classDays.length === 0 ? (
              <p className="card p-4 text-[13px] text-muted">No more classes scheduled this week.</p>
            ) : (
              <ul className="hscroll gap-2 py-0.5">
                {classDays.map((d) => (
                  <li key={`${d.batch}-${d.iso}`} className="card min-w-[10.5rem] p-3">
                    <p className="text-[13px] font-bold text-navy">{d.label}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">{d.course}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Training sections">
            <h2 className="mb-2 px-1 text-[13px] font-bold tracking-[0.14em] text-muted uppercase">Sections</h2>
            <QuickActions items={tiles} label="Training sections" className="lg:grid-cols-4" />
          </section>

          {pendingAssignments > 0 && (
            <Link href="/student/assignments" className="flex min-h-14 items-center gap-3 rounded-2xl bg-warning-light px-4 text-[14px] font-semibold text-amber-900">
              <FileText className="h-5 w-5 shrink-0" aria-hidden />
              {pendingAssignments} assignment{pendingAssignments === 1 ? "" : "s"} waiting for your submission
            </Link>
          )}
        </>
      )}
    </div>
  );
}
