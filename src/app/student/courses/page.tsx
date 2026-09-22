import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, ChevronRight, Clock, GraduationCap, MapPin } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { studentAdmissions } from "@/server/student-portal";
import { formatSchedule } from "@/server/batches";
import { formatDate, formatINR, titleCase, toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { RingProgress } from "@/components/ui/stats";

export const metadata: Metadata = { title: "My Courses" };

export default async function StudentCoursesPage() {
  const user = await requireStudent();
  const [admissions, catalogue] = await Promise.all([
    studentAdmissions(user.student.id),
    db.course.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 12,
      select: { id: true, name: true, durationText: true, level: true, mode: true, courseFee: true, scholarshipAvailable: true, category: { select: { name: true } } },
    }),
  ]);
  const enrolledCourseIds = new Set(admissions.map((a) => a.courseId));
  const discover = catalogue.filter((c) => !enrolledCourseIds.has(c.id));

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="My Courses"
        mobileTitle="Courses"
        description="The courses you are admitted to, and the ones you can still apply for."
        actions={<ButtonLink href="/student/apply">New application</ButtonLink>}
      />

      {admissions.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-7 w-7" />}
          title="You are not enrolled in a course yet"
          description="Pick a training center near you and apply – your course, batch and progress appear here once your admission is confirmed."
          action={<ButtonLink href="/student/apply">Find a center & apply</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {admissions.map((a) => {
            const p = a.progress;
            return (
              <li key={a.id} className="card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <RingProgress value={p?.completionPct ?? 0} size={64} stroke={7} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 text-h4 text-navy">{a.course.name}</h2>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-0.5 flex items-start gap-1 text-body-sm text-muted">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">
                        {a.center.name} ({a.center.code})
                      </span>
                    </p>
                    <p className="flex items-start gap-1 text-body-sm text-muted">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">
                        {a.batch.name} · {formatSchedule(a.batch)}
                      </span>
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-2 border-t border-line px-4 py-3 text-center">
                  <div>
                    <dt className="text-caption text-muted">Attendance</dt>
                    <dd className="text-body font-bold text-navy tabular-nums">{p ? `${Math.round(p.attendancePct)}%` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted">Classes</dt>
                    <dd className="text-body font-bold text-navy tabular-nums">
                      {p?.classesAttended ?? 0}/{p?.classesHeld ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted">Assignments</dt>
                    <dd className="text-body font-bold text-navy tabular-nums">
                      {p?.assignmentsCompleted ?? 0}/{p?.assignmentsTotal ?? 0}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-center gap-2 border-t border-line p-3">
                  <ButtonLink href="/student/training" variant="outline" size="sm" className="flex-1">
                    Training
                  </ButtonLink>
                  <ButtonLink href="/student/progress" size="sm" className="flex-1">
                    Progress
                  </ButtonLink>
                </div>

                {a.certificate?.status === "ISSUED" && (
                  <Link href="/student/certificates" className="flex min-h-11 items-center gap-2 border-t border-line bg-success-light px-4 text-body-sm font-semibold text-green-900">
                    Certificate {a.certificate.certificateNo} issued {formatDate(a.certificate.issuedAt)}
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardHeader
          title="Browse courses & apply"
          description={discover.length ? `${discover.length} more course${discover.length === 1 ? "" : "s"} open for admission` : "You have applied for every course currently open."}
          action={
            <ButtonLink href="/student/apply" variant="outline" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Find a center
            </ButtonLink>
          }
        />
        {discover.length === 0 ? (
          <CardBody>
            <p className="text-body-sm text-muted">New courses are added regularly – check back or contact the Foundation for upcoming batches.</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {discover.map((c) => (
              <li key={c.id}>
                <Link href={`/student/apply?courseId=${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 tap-highlight-none active:bg-surface">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
                    <BookOpen className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-ink">{c.name}</span>
                    <span className="block truncate text-caption text-muted">
                      {[c.category?.name, c.durationText, titleCase(c.level), titleCase(c.mode)].filter(Boolean).join(" · ")}
                    </span>
                    <span className="block text-caption font-semibold text-orange">
                      {formatINR(toNumber(c.courseFee))}
                      {c.scholarshipAvailable ? " · scholarship available" : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
