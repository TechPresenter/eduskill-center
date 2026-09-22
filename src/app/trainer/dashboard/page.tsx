import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookOpen, Building2, CalendarCheck, CalendarDays, ChevronRight, ClipboardCheck, FileText, FolderOpen, ListChecks, Megaphone, Users, UsersRound } from "lucide-react";
import { requireTrainer } from "@/lib/auth/guards";
import { cn, formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { trainerDashboard, trainerLocationLabel } from "@/server/trainer-scope";
import { formatSchedule } from "@/server/batches";
import { PageHeader, Avatar, KeyValue } from "@/components/ui/misc";
import { StatsCard } from "@/components/ui/stats";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { trainerLinkFor } from "@/components/trainer/notification-links";
import { TodayClasses, TrainerGreeting, TrainerIdCard, TrainerQuickActions, type TrainerQuickAction } from "@/components/trainer/mobile";

export const metadata: Metadata = { title: "Trainer Dashboard" };

export default async function TrainerDashboardPage() {
  const user = await requireTrainer();
  const d = await trainerDashboard(user);
  const p = d.profile;
  const active = p.status === "ACTIVE";
  const location = trainerLocationLabel(p);
  const firstCenter = d.centers[0];
  const dayLabel = formatDate(d.today, "EEEE, dd MMM yyyy");

  // Every badge below is a real count from the dashboard query — never a placeholder.
  const quickActions: TrainerQuickAction[] = [
    { label: "Mark attendance", href: "/trainer/attendance", icon: ClipboardCheck, badge: d.stats.pendingAttendance ? `${d.stats.pendingAttendance} class${d.stats.pendingAttendance === 1 ? "" : "es"} pending` : null, attention: d.stats.pendingAttendance > 0 },
    { label: "My batches", href: "/trainer/batches", icon: UsersRound, badge: d.stats.ongoing ? `${d.stats.ongoing} ongoing` : null },
    { label: "My students", href: "/trainer/students", icon: Users, badge: d.stats.students || null },
    { label: "Timetable", href: "/trainer/timetable", icon: CalendarDays, badge: d.stats.classesToday ? `${d.stats.classesToday} today` : null },
    { label: "Coursework", href: "/trainer/coursework", icon: FileText },
    { label: "Assessments", href: "/trainer/assessments", icon: ListChecks },
    { label: "Study material", href: "/trainer/materials", icon: BookOpen },
    // Announcements has its own section below the grid, so its tile gives way to documents (keeps the grid even).
    { label: "My documents", href: "/trainer/profile/documents", icon: FolderOpen, badge: d.documents.total ? `${d.documents.total} need${d.documents.total === 1 ? "s" : ""} attention` : null, attention: d.documents.total > 0 },
  ];
  // "Needs attention" first, so the tile the trainer must act on is never below the fold.
  quickActions.sort((a, b) => Number(!!b.attention) - Number(!!a.attention));

  const ROW = "flex min-h-16 items-start gap-3 px-4 py-3 tap-highlight-none transition-colors duration-micro active:bg-surface hover:bg-surface/60 motion-reduce:transition-none";

  return (
    <>
      {/* ───────────── Phone home ───────────── */}
      <div className="space-y-4 animate-fade-up motion-reduce:animate-none lg:hidden">
        <TrainerGreeting name={p.user.name} now={d.today} subtitle={dayLabel} />

        <TrainerIdCard
          name={p.user.name}
          trainerId={p.trainerId}
          photoUrl={p.user.avatarUrl}
          level={`${titleCase(p.level)} level volunteer`}
          status={p.status}
          location={location || null}
          center={firstCenter ? `${firstCenter.name} (${firstCenter.code})` : null}
          centerCount={d.centers.length}
        />

        <TodayClasses classes={d.todayClasses} dayLabel={formatDate(d.today, "EEEE")} canMark={active} />

        <TrainerQuickActions items={quickActions} />

        <section aria-label="Recent announcements">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-overline text-muted">Announcements</h2>
            <Link href="/trainer/announcements" className="inline-flex min-h-11 items-center text-body-sm font-semibold text-orange">
              See all
            </Link>
          </div>
          {d.announcements.length === 0 ? (
            <p className="card p-4 text-body-sm text-muted">Notices from the Foundation, your centers and your batches appear here.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {d.announcements.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <Link href="/trainer/announcements" className={ROW}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy" aria-hidden>
                      <Megaphone className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{a.title}</span>
                        <Badge tone="navy" className="shrink-0">
                          {a.audience === "BATCH" && a.batch ? a.batch.code : titleCase(a.audience)}
                        </Badge>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-body-sm text-muted">{a.body}</span>
                      <span className="mt-1 block text-caption text-muted">{formatDateTime(a.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Recent updates">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-overline text-muted">Recent updates</h2>
            <Link href="/trainer/notifications" className="inline-flex min-h-11 items-center text-body-sm font-semibold text-orange">
              Inbox
            </Link>
          </div>
          {d.notifications.length === 0 ? (
            <p className="card p-4 text-body-sm text-muted">Updates about your assignments, batches and the Foundation will appear here.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {d.notifications.slice(0, 3).map((n) => (
                <li key={n.id} className={n.readAt ? undefined : "bg-orange-light/25"}>
                  <Link href={trainerLinkFor(n) ?? "/trainer/notifications"} className={ROW}>
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", n.readAt ? "bg-lavender text-navy" : "bg-orange-light text-orange")} aria-hidden>
                      <Bell className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-body", n.readAt ? "font-semibold text-ink" : "font-bold text-navy")}>{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-body-sm whitespace-pre-line text-muted">{n.body}</span>
                      <span className="mt-1 block text-caption text-muted">
                        {!n.readAt && <span className="sr-only">Unread. </span>}
                        {formatDateTime(n.createdAt)}
                      </span>
                    </span>
                    <ChevronRight className="mt-2.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ───────────── Desktop ───────────── */}
      <div className="hidden lg:block">
        <PageHeader title={`Welcome, ${p.user.name.split(" ")[0]}`} description={`Today is ${dayLabel}`} mobileTitle="Home" />
        <InactiveBanner status={p.status} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Trainer ID card */}
          <Card className="overflow-hidden lg:col-span-1">
            <div className="bg-navy px-5 py-4 text-white">
              <p className="text-overline text-white/60">Volunteer Trainer ID</p>
              <p className="mt-1 font-heading text-h3 tracking-wide text-white">{p.trainerId}</p>
            </div>
            <CardBody>
              <div className="flex items-center gap-4">
                <Avatar name={p.user.name} src={p.user.avatarUrl} size={64} />
                <div className="min-w-0">
                  <p className="truncate text-h4 text-navy">{p.user.name}</p>
                  <p className="text-body-sm text-muted">{titleCase(p.level)} level volunteer</p>
                  <div className="mt-1">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <KeyValue label="Assigned location" value={location || "—"} />
                <KeyValue label="Trainer since" value={formatDate(p.joinedAt)} />
                <KeyValue
                  label={`Assigned centers (${d.centers.length})`}
                  value={
                    d.centers.length === 0 ? (
                      "Not assigned yet"
                    ) : (
                      <ul className="space-y-1">
                        {d.centers.map((c) => (
                          <li key={c.id}>
                            {c.name}{" "}
                            <span className="text-caption font-normal text-muted">
                              ({c.code}) · {[c.district.name, c.state.name].filter(Boolean).join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                />
                <KeyValue
                  label={`Courses (${d.courses.length})`}
                  value={
                    d.courses.length === 0 ? (
                      "—"
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {d.courses.map((c) => (
                          <Badge key={c.id} tone="navy">
                            {c.name}
                          </Badge>
                        ))}
                      </span>
                    )
                  }
                />
                <KeyValue label="Skills" value={p.skills.length ? p.skills.join(", ") : "—"} />
              </div>
              <div className="mt-5">
                <ButtonLink href="/trainer/profile" variant="outline" size="sm" fullWidth>
                  View profile
                </ButtonLink>
              </div>
            </CardBody>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:col-span-2 xl:grid-cols-3">
            <StatsCard label="Active assignments" value={d.stats.activeAssignments} icon={<Building2 className="h-5 w-5" />} tone="navy" href="/trainer/assignments" />
            <StatsCard label="Batches" value={d.stats.ongoing + d.stats.upcoming} hint={`${d.stats.ongoing} ongoing · ${d.stats.upcoming} upcoming`} icon={<UsersRound className="h-5 w-5" />} tone="orange" href="/trainer/batches" />
            <StatsCard label="Students" value={d.stats.students} hint="Active in my batches" icon={<Users className="h-5 w-5" />} tone="success" href="/trainer/students" />
            <StatsCard label="Classes today" value={d.stats.classesToday} icon={<CalendarCheck className="h-5 w-5" />} tone="info" href="/trainer/timetable" />
            <StatsCard label="Pending attendance" value={d.stats.pendingAttendance} hint="Classes today not yet marked" icon={<ClipboardCheck className="h-5 w-5" />} tone={d.stats.pendingAttendance ? "warning" : "success"} href="/trainer/attendance" />
            <StatsCard label="Completed batches" value={d.stats.completed} icon={<UsersRound className="h-5 w-5" />} tone="navy" href="/trainer/batches" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Today's classes"
              description={formatDate(d.today, "EEEE")}
              action={
                <ButtonLink href="/trainer/attendance" size="xs" variant="navy">
                  Mark attendance
                </ButtonLink>
              }
            />
            <CardBody className="p-0">
              {d.todayClasses.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No classes scheduled today" description="Enjoy your day. Your weekly timetable shows what is coming up." className="py-8" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {d.todayClasses.map((c) => (
                    <li key={c.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-body font-semibold text-ink">{c.name}</p>
                        <p className="text-caption text-muted">
                          {c.course.name} · {c.center.name}
                        </p>
                        <p className="mt-1 text-caption font-semibold text-navy tabular-nums">
                          {c.startTime}–{c.endTime}
                          {c.room ? ` · ${c.room}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {c.attendanceMarked ? (
                          <Badge tone="success" dot>
                            Attendance marked
                          </Badge>
                        ) : (
                          <ButtonLink href={`/trainer/attendance?batchId=${c.id}`} size="xs" aria-disabled={!active} variant={active ? "primary" : "outline"}>
                            Mark now
                          </ButtonLink>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="My batches"
              action={
                <ButtonLink href="/trainer/batches" size="xs" variant="outline">
                  View all
                </ButtonLink>
              }
            />
            <CardBody className="p-0">
              {d.batches.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No batches assigned yet" description="The Foundation will assign you to a center and batch." className="py-8" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {d.batches.map((b) => (
                    <li key={b.id}>
                      <Link href={`/trainer/batches/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors duration-micro hover:bg-surface/60 motion-reduce:transition-none">
                        <div className="min-w-0">
                          <p className="truncate text-body font-semibold text-ink">{b.name}</p>
                          <p className="truncate text-caption text-muted">
                            {b.code} · {formatSchedule(b)} · {b._count.admissions} students
                          </p>
                        </div>
                        <StatusBadge status={b.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent announcements"
              action={
                <ButtonLink href="/trainer/announcements" size="xs" variant="outline">
                  All announcements
                </ButtonLink>
              }
            />
            <CardBody className="p-0">
              {d.announcements.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={<Megaphone className="h-7 w-7" />} title="No announcements yet" className="py-8" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {d.announcements.map((a) => (
                    <li key={a.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-body font-semibold text-ink">{a.title}</p>
                        <Badge tone="navy">{a.audience === "BATCH" && a.batch ? a.batch.code : titleCase(a.audience)}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-body-sm text-muted">{a.body}</p>
                      <p className="mt-1 text-caption text-muted">{formatDateTime(a.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent notifications"
              action={
                <ButtonLink href="/trainer/notifications" size="xs" variant="outline">
                  Inbox
                </ButtonLink>
              }
            />
            <CardBody className="p-0">
              {d.notifications.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={<Bell className="h-7 w-7" />} title="You're all caught up" className="py-8" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {d.notifications.map((n) => (
                    <li key={n.id}>
                      <Link href={trainerLinkFor(n) ?? "/trainer/notifications"} className="flex items-start gap-3 px-5 py-3.5 transition-colors duration-micro hover:bg-surface/60 motion-reduce:transition-none">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-line" : "bg-orange"}`} aria-hidden />
                        <div className="min-w-0">
                          <p className={`text-body ${n.readAt ? "font-medium text-ink" : "font-semibold text-navy"}`}>
                            {!n.readAt && <span className="sr-only">Unread: </span>}
                            {n.title}
                          </p>
                          <p className="line-clamp-2 text-body-sm text-muted">{n.body}</p>
                          <p className="mt-0.5 text-caption text-muted">{formatDateTime(n.createdAt)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
