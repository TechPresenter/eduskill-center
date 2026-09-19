import Link from "next/link";
import type { Metadata } from "next";
import { Award, Bell, BookOpen, CalendarDays, ClipboardCheck, ClipboardList, CreditCard, GraduationCap, LifeBuoy, MapPin, Phone, UserCircle } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getStudentDashboard } from "@/server/students";
import { missingDocuments } from "@/server/applications";
import { formatSchedule } from "@/server/batches";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { RingProgress, StatsCard } from "@/components/ui/stats";
import { nextAction, PAYABLE_STATUSES } from "@/components/student/application-status";
import { upcomingClassDays } from "@/components/student/timetable-utils";
import { ApplicationTracker, HomeGreeting, ProgressSummaryCard, QuickActions, StudentIdCard, type QuickAction } from "@/components/student/mobile";

export const metadata: Metadata = { title: "Dashboard" };

const OPEN = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "PAYMENT_PENDING", "PAYMENT_COMPLETED", "WAITLISTED"];
const DOCS_PENDING_STATUSES = ["DRAFT", "DOCUMENTS_REQUIRED"];

export default async function StudentDashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireStudent();
  const { welcome } = await searchParams;
  const data = await getStudentDashboard(user.student.id);
  const { student, applications, admissions, certificates, notifications, unread } = data;

  const activeApplication = applications.find((a) => OPEN.includes(a.status)) ?? applications[0] ?? null;
  const currentAdmission = admissions.find((a) => a.status === "ACTIVE" || a.status === "ON_HOLD") ?? null;
  const attendancePct = currentAdmission?.progress?.attendancePct ?? null;
  const feesDue = applications.filter((a) => PAYABLE_STATUSES.includes(a.status)).reduce((s, a) => s + Math.max(0, a.payableAmount - a.paidAmount), 0);
  const issuedCertificates = certificates.filter((c) => c.status === "ISSUED");
  const classDays = currentAdmission ? upcomingClassDays(currentAdmission.batch) : [];
  const firstName = student.name.split(" ")[0] ?? student.name;

  // Documents still missing for the open application (only queried when the status can need them).
  let missingDocsCount = 0;
  if (activeApplication && DOCS_PENDING_STATUSES.includes(activeApplication.status)) {
    const withCourse = await db.application.findFirst({ where: { id: activeApplication.id, studentId: user.student.id }, select: { studentId: true, course: { select: { requiredDocuments: true } } } });
    if (withCourse) missingDocsCount = (await missingDocuments(withCourse)).length;
  }

  const applicationAction = activeApplication ? nextAction({ ...activeApplication, missingDocuments: Array.from({ length: missingDocsCount }, () => ({ name: "" })) }) : null;
  const location = [student.block?.name, student.district?.name, student.state?.name].filter(Boolean).join(", ") || null;

  const quickActions: QuickAction[] = [
    { label: "Find Center", href: "/student/apply", icon: MapPin },
    { label: "My Courses", href: "/student/courses", icon: GraduationCap, badge: admissions.length || null },
    {
      label: "My Application",
      href: activeApplication ? `/student/applications/${activeApplication.id}` : "/student/applications",
      icon: ClipboardList,
      badge: missingDocsCount > 0 ? `${missingDocsCount} document${missingDocsCount === 1 ? "" : "s"} due` : null,
      attention: missingDocsCount > 0,
    },
    { label: "Fees & Payments", href: "/student/payments", icon: CreditCard, badge: feesDue > 0 ? formatINR(feesDue) : null, attention: feesDue > 0 },
    { label: "Attendance", href: "/student/attendance", icon: ClipboardCheck, badge: attendancePct !== null ? `${Math.round(attendancePct)}%` : null, attention: attendancePct !== null && !!currentAdmission && attendancePct < currentAdmission.course.minAttendancePct },
    { label: "Study Material", href: "/student/materials", icon: BookOpen },
    { label: "Certificate", href: "/student/certificates", icon: Award, badge: issuedCertificates.length || null },
    { label: "Support", href: "/student/support", icon: LifeBuoy },
  ];

  return (
    <>
      {/* ───────────── Phone home ───────────── */}
      <div className="space-y-4 animate-fade-up motion-reduce:animate-none lg:hidden">
        <HomeGreeting name={student.name} />

        {welcome === "1" ? (
          <Alert tone="success" title="Your account is ready" className="p-3 text-[13px]">
            <Link href="/student/profile/edit" className="font-semibold underline">
              Complete your profile
            </Link>{" "}
            to apply for a course near you.
          </Alert>
        ) : !student.profileCompleted ? (
          <Alert tone="warning" title="Complete your profile" className="p-3 text-[13px]">
            Applications can only be started once your details, address and education are filled in.{" "}
            <Link href="/student/profile/edit" className="font-semibold underline">
              Complete now
            </Link>
          </Alert>
        ) : null}

        <StudentIdCard
          name={student.name}
          studentId={student.studentId}
          photoUrl={student.photoUrl ?? user.avatarUrl}
          course={currentAdmission?.course.name ?? null}
          center={currentAdmission ? `${currentAdmission.center.name} (${currentAdmission.center.code})` : null}
          batch={currentAdmission ? `${currentAdmission.batch.name} · ${formatSchedule(currentAdmission.batch)}` : null}
          location={location}
        />

        {activeApplication && applicationAction && (
          <div className="space-y-3">
            <ApplicationTracker application={activeApplication} applicationNo={activeApplication.applicationNo} href={`/student/applications/${activeApplication.id}`} />
            <ButtonLink href={applicationAction.href} variant={applicationAction.actionable ? "primary" : "outline"} fullWidth>
              {applicationAction.label}
            </ButtonLink>
          </div>
        )}

        <QuickActions items={quickActions} />

        {currentAdmission && currentAdmission.progress && (
          <ProgressSummaryCard
            courseName={currentAdmission.course.name}
            minAttendancePct={currentAdmission.course.minAttendancePct}
            progress={{
              completionPct: currentAdmission.progress.completionPct,
              classesHeld: currentAdmission.progress.classesHeld,
              classesAttended: currentAdmission.progress.classesAttended,
              totalClasses: currentAdmission.progress.totalClasses || currentAdmission.course.totalClasses,
              attendancePct: currentAdmission.progress.attendancePct,
              assignmentsCompleted: currentAdmission.progress.assignmentsCompleted,
              assignmentsTotal: currentAdmission.progress.assignmentsTotal,
              assessmentAvgPct: currentAdmission.progress.assessmentAvgPct,
            }}
          />
        )}

        {currentAdmission && classDays.length > 0 && (
          <section className="card p-4" aria-label="Classes this week">
            <p className="text-[13px] font-bold text-navy">Classes this week</p>
            <ul className="snap-row mt-2">
              {classDays.map((d) => (
                <li key={d.iso} className="rounded-xl bg-lavender px-3 py-2 text-[12px] font-semibold whitespace-nowrap text-navy">
                  {d.label}
                </li>
              ))}
            </ul>
            <Link href="/student/timetable" className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold text-orange">
              Full timetable
            </Link>
          </section>
        )}

        <section aria-label="Recent updates">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-[13px] font-bold tracking-[0.14em] text-muted uppercase">Recent updates</h2>
            <Link href="/student/notifications" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-orange">
              See all
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="card p-4 text-[13px] text-muted">Updates about your applications, payments and classes will appear here.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {notifications.slice(0, 3).map((n) => (
                <li key={n.id} className={n.readAt ? "px-4 py-3" : "bg-orange-light/25 px-4 py-3"}>
                  <p className="text-[14px] font-semibold text-ink">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{n.body}</p>
                  <p className="mt-1 text-[12px] text-muted">{formatDateTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ───────────── Desktop (unchanged) ───────────── */}
      <div className="hidden space-y-6 lg:block">
        <PageHeader title={`Welcome, ${firstName}`} description="Your applications, training and updates at a glance." mobileTitle="Home" hideMobileTitle={false} />

        {welcome === "1" && (
          <Alert tone="success" title="Your account is ready">
            Complete your profile to apply for a course at a training center near you. <Link href="/student/profile" className="font-semibold underline">Go to My Profile</Link>
          </Alert>
        )}
        {!student.profileCompleted && (
          <Alert tone="warning" title="Complete your profile" action={<ButtonLink href="/student/profile" size="sm" variant="navy">Complete profile</ButtonLink>}>
            Your profile is incomplete. Applications can only be started once your details, address and education are filled in.
          </Alert>
        )}

        {/* Hero */}
        <Card className="overflow-hidden">
          <div className="bg-navy px-5 py-6 text-white sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar name={student.name} src={student.photoUrl ?? user.avatarUrl} size={72} className="ring-4 ring-white/20" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold tracking-[0.18em] text-white/60 uppercase">Student</p>
                <h2 className="truncate font-heading text-2xl font-extrabold text-white">{student.name}</h2>
                <p className="mt-1 text-sm text-white/80">
                  {student.studentId ? (
                    <>
                      Student ID: <span className="font-mono font-semibold text-white">{student.studentId}</span>
                    </>
                  ) : (
                    "Student ID will be issued on admission"
                  )}
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  {location ?? "Address not set"} · {student.mobile}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/student/profile" variant="white" size="sm" leftIcon={<UserCircle className="h-4 w-4" />}>
                  My profile
                </ButtonLink>
                <ButtonLink href="/student/apply" size="sm" leftIcon={<MapPin className="h-4 w-4" />}>
                  Find a center
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatsCard label="Active application" value={activeApplication ? <StatusBadge status={activeApplication.status} className="text-sm" /> : "None"} hint={activeApplication ? activeApplication.applicationNo : "Start your first application"} icon={<ClipboardList className="h-5 w-5" />} tone="orange" href={activeApplication ? `/student/applications/${activeApplication.id}` : "/student/apply"} />
          <StatsCard label="Admissions" value={admissions.length} hint={currentAdmission ? `${currentAdmission.course.name}` : "No admission yet"} icon={<GraduationCap className="h-5 w-5" />} tone="navy" href="/student/progress" />
          <StatsCard label="Attendance" value={attendancePct !== null ? `${Math.round(attendancePct)}%` : "—"} hint={currentAdmission ? `Required ${currentAdmission.course.minAttendancePct}%` : "No active batch"} icon={<CalendarDays className="h-5 w-5" />} tone={attendancePct !== null && currentAdmission && attendancePct < currentAdmission.course.minAttendancePct ? "warning" : "success"} href="/student/attendance" />
          <StatsCard label="Fees due" value={formatINR(feesDue)} hint={feesDue > 0 ? "Pay now to confirm your seat" : "Nothing due"} icon={<CreditCard className="h-5 w-5" />} tone={feesDue > 0 ? "warning" : "success"} href="/student/payments" />
          <StatsCard label="Certificates" value={issuedCertificates.length} hint={issuedCertificates[0] ? issuedCertificates[0].certificateNo : "Issued on course completion"} icon={<Award className="h-5 w-5" />} tone="info" href="/student/certificates" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Current training */}
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader title="Current training" description={currentAdmission ? `Admission ${currentAdmission.admissionNo} · since ${formatDate(currentAdmission.admittedAt)}` : "You are not enrolled in a batch yet"} action={currentAdmission ? <ButtonLink href="/student/timetable" variant="outline" size="sm">Timetable</ButtonLink> : undefined} />
              <CardBody>
                {currentAdmission ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="space-y-4 md:col-span-2">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Course</p>
                        <p className="text-base font-bold text-navy">{currentAdmission.course.name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Training center</p>
                        <p className="font-semibold text-ink">
                          {currentAdmission.center.name} <span className="font-mono text-xs text-muted">({currentAdmission.center.code})</span>
                        </p>
                        <p className="text-sm text-muted">{currentAdmission.center.address}</p>
                        {currentAdmission.center.phone && (
                          <a href={`tel:${currentAdmission.center.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-navy hover:underline">
                            <Phone className="h-3.5 w-3.5" /> {currentAdmission.center.phone}
                          </a>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Batch</p>
                          <p className="font-semibold text-ink">
                            {currentAdmission.batch.name} <span className="font-mono text-xs text-muted">({currentAdmission.batch.code})</span>
                          </p>
                          <p className="text-sm text-muted">{formatSchedule(currentAdmission.batch)}</p>
                          {currentAdmission.batch.room && <p className="text-sm text-muted">Room: {currentAdmission.batch.room}</p>}
                          <p className="text-xs text-muted">
                            {formatDate(currentAdmission.batch.startDate)} – {formatDate(currentAdmission.batch.endDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Trainer</p>
                          <p className="font-semibold text-ink">{currentAdmission.batch.trainer?.user.name ?? "To be assigned"}</p>
                          <p className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">Classes this week</p>
                          {classDays.length ? (
                            <ul className="mt-1 flex flex-wrap gap-1.5">
                              {classDays.map((d) => (
                                <li key={d.iso} className="rounded-lg bg-lavender px-2 py-1 text-xs font-semibold text-navy">
                                  {d.label}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted">No more classes this week</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface p-4">
                      <RingProgress value={currentAdmission.progress?.completionPct ?? 0} label="Complete" size={110} />
                      <p className="text-center text-xs text-muted">
                        {currentAdmission.progress?.classesAttended ?? 0} of {currentAdmission.progress?.classesHeld ?? 0} classes attended
                      </p>
                      <ButtonLink href="/student/progress" variant="link" size="sm">
                        View progress
                      </ButtonLink>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<GraduationCap className="h-7 w-7" />}
                    title="No active training"
                    description={applications.length ? "Once your admission is confirmed, your batch, trainer and timetable appear here." : "Find a training center near you and apply for a course to get started."}
                    action={applications.length === 0 ? <ButtonLink href="/student/apply">Find a center & apply</ButtonLink> : <ButtonLink href="/student/applications" variant="outline">View applications</ButtonLink>}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Applications" action={<ButtonLink href="/student/applications" variant="outline" size="sm">View all</ButtonLink>} />
              {applications.length === 0 ? (
                <CardBody>
                  <EmptyState title="No applications yet" description="Choose a training center, course and batch to start your first application." action={<ButtonLink href="/student/apply">Find a center & apply</ButtonLink>} />
                </CardBody>
              ) : (
                <ul className="divide-y divide-line">
                  {applications.slice(0, 4).map((a) => {
                    const action = nextAction(a);
                    return (
                      <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/student/applications/${a.id}`} className="font-mono text-sm font-semibold text-navy hover:underline">
                              {a.applicationNo}
                            </Link>
                            <StatusBadge status={a.status} />
                          </div>
                          <p className="mt-0.5 truncate text-sm text-ink">
                            {a.course.name} · {a.center.name}
                          </p>
                          <p className="text-xs text-muted">Applied {formatDate(a.createdAt)}</p>
                        </div>
                        <ButtonLink href={action.href} size="sm" variant={action.actionable ? "primary" : "outline"}>
                          {action.label}
                        </ButtonLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Notifications */}
          <Card className="self-start">
            <CardHeader title="Recent updates" description={unread ? `${unread} unread` : "You are all caught up"} action={<ButtonLink href="/student/notifications" variant="ghost" size="sm" leftIcon={<Bell className="h-4 w-4" />}>Inbox</ButtonLink>} />
            {notifications.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">Updates about your applications, payments and classes will appear here.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.slice(0, 6).map((n) => (
                  <li key={n.id} className={`px-5 py-3 ${n.readAt ? "" : "bg-orange-light/30"}`}>
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
