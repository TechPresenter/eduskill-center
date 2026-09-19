import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Building2, CalendarCheck, ClipboardCheck, Megaphone, Users, UsersRound } from "lucide-react";
import { requireTrainer } from "@/lib/auth/guards";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { trainerDashboard, trainerLocationLabel } from "@/server/trainer-scope";
import { formatSchedule } from "@/server/batches";
import { PageHeader, Avatar, KeyValue } from "@/components/ui/misc";
import { StatsCard } from "@/components/ui/stats";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { InactiveBanner } from "@/components/trainer/inactive-banner";

export const metadata: Metadata = { title: "Trainer Dashboard" };

export default async function TrainerDashboardPage() {
  const user = await requireTrainer();
  const d = await trainerDashboard(user);
  const p = d.profile;

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={`Today is ${formatDate(d.today, "EEEE, dd MMM yyyy")}`} />
      <InactiveBanner status={p.status} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Trainer ID card */}
        <Card className="overflow-hidden lg:col-span-1">
          <div className="bg-navy px-5 py-4 text-white">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/60 uppercase">Volunteer Trainer ID</p>
            <p className="mt-1 font-heading text-xl font-extrabold tracking-wide">{p.trainerId}</p>
          </div>
          <CardBody>
            <div className="flex items-center gap-4">
              <Avatar name={p.user.name} src={p.user.avatarUrl} size={64} />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-navy">{p.user.name}</p>
                <p className="text-sm text-muted">{titleCase(p.level)} level volunteer</p>
                <div className="mt-1">
                  <StatusBadge status={p.status} />
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <KeyValue label="Assigned location" value={trainerLocationLabel(p) || "—"} />
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
                          {c.name} <span className="text-xs font-normal text-muted">({c.code}) · {[c.district.name, c.state.name].filter(Boolean).join(", ")}</span>
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Today's classes" description={formatDate(d.today, "EEEE")} action={<ButtonLink href="/trainer/attendance" size="xs" variant="navy">Mark attendance</ButtonLink>} />
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
                      <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                      <p className="text-xs text-muted">
                        {c.course.name} · {c.center.name}
                      </p>
                      <p className="mt-1 text-xs font-medium text-navy">
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
                        <Link href={`/trainer/attendance?batchId=${c.id}`} className="inline-flex h-8 items-center rounded-lg bg-orange px-3 text-xs font-semibold text-white hover:bg-orange-hover">
                          Mark now
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="My batches" action={<ButtonLink href="/trainer/batches" size="xs" variant="outline">View all</ButtonLink>} />
          <CardBody className="p-0">
            {d.batches.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No batches assigned yet" description="The Foundation will assign you to a center and batch." className="py-8" />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {d.batches.map((b) => (
                  <li key={b.id}>
                    <Link href={`/trainer/batches/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface/60">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{b.name}</p>
                        <p className="truncate text-xs text-muted">
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
          <CardHeader title="Recent announcements" action={<ButtonLink href="/trainer/announcements" size="xs" variant="outline">All announcements</ButtonLink>} />
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
                      <p className="text-sm font-semibold text-ink">{a.title}</p>
                      <Badge tone="navy">{a.audience === "BATCH" && a.batch ? a.batch.code : titleCase(a.audience)}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{a.body}</p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent notifications" action={<ButtonLink href="/trainer/notifications" size="xs" variant="outline">Inbox</ButtonLink>} />
          <CardBody className="p-0">
            {d.notifications.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<Bell className="h-7 w-7" />} title="You're all caught up" className="py-8" />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {d.notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-line" : "bg-orange"}`} aria-hidden />
                    <div className="min-w-0">
                      <p className={`text-sm ${n.readAt ? "font-medium text-ink" : "font-semibold text-navy"}`}>{n.title}</p>
                      <p className="line-clamp-2 text-sm text-muted">{n.body}</p>
                      <p className="mt-0.5 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
