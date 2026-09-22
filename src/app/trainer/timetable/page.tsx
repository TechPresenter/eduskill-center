import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ClipboardCheck } from "lucide-react";
import { requireTrainer } from "@/lib/auth/guards";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { weeklyTimetable } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { InactiveBanner } from "@/components/trainer/inactive-banner";

export const metadata: Metadata = { title: "Timetable" };

const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TrainerTimetablePage() {
  const user = await requireTrainer();
  const t = await weeklyTimetable(user.trainer.id);
  // Monday → Sunday, the way a class register reads.
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ index: i, ...t.grid[i]! }));
  const hasAny = ordered.some((d) => d.classes.length > 0);
  const todayClasses = ordered.find((d) => d.index === t.todayIndex)?.classes.length ?? 0;

  return (
    <>
      <PageHeader
        title="Weekly Timetable"
        description={`${formatDate(t.today, "EEEE, dd MMM yyyy")} · ${todayClasses} class${todayClasses === 1 ? "" : "es"} today. Ongoing and upcoming batches only.`}
        actions={
          <ButtonLink href="/trainer/attendance" variant="navy" size="sm" leftIcon={<ClipboardCheck className="h-4 w-4" />}>
            Mark attendance
          </ButtonLink>
        }
      />
      <InactiveBanner status={user.trainer.status} />

      {!hasAny ? (
        <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No scheduled classes" description="Your timetable fills in once you are assigned to an ongoing or upcoming batch." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {ordered.map((d) => {
            const isToday = d.index === t.todayIndex;
            return (
              <section key={d.day} className={cn("card flex flex-col overflow-hidden", isToday && "ring-2 ring-orange")} aria-label={FULL[d.index]}>
                <header className={cn("flex items-center justify-between gap-2 px-3 py-2.5", isToday ? "bg-orange text-white" : "bg-surface text-navy")}>
                  <span className="text-h4">
                    <span className="xl:hidden">{FULL[d.index]}</span>
                    <span className="hidden xl:inline">{SHORT[d.index]}</span>
                  </span>
                  <span className={cn("text-caption font-bold tabular-nums", isToday ? "text-white/90" : "text-muted")}>
                    {isToday ? "TODAY" : d.classes.length ? `${d.classes.length}` : ""}
                  </span>
                </header>
                <div className="flex-1 space-y-2 p-2.5">
                  {d.classes.length === 0 ? (
                    <p className="px-1 py-3 text-center text-caption text-muted">No classes</p>
                  ) : (
                    d.classes.map((c) => {
                      const notStarted = c.startDate > t.today;
                      return (
                        <Link
                          key={c.id}
                          href={`/trainer/batches/${c.id}`}
                          className={cn(
                            "block rounded-lg border p-3 tap-highlight-none transition-colors duration-micro hover:border-navy/40 motion-reduce:transition-none",
                            notStarted ? "border-dashed border-line bg-surface/60" : "border-line bg-white"
                          )}
                        >
                          <p className="text-caption font-bold text-navy tabular-nums">
                            {c.startTime}–{c.endTime}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-body font-semibold text-ink">{c.name}</p>
                          <p className="truncate text-caption text-muted">{c.course.name}</p>
                          <p className="mt-1 truncate text-caption text-muted">
                            {c.center.name}
                            {c.room ? ` · ${c.room}` : ""}
                          </p>
                          {notStarted && (
                            <Badge tone="info" className="mt-2">
                              Starts {formatDate(c.startDate)}
                            </Badge>
                          )}
                        </Link>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title="Upcoming assessments" description="Scheduled tests and practicals across your batches." />
        <CardBody className="p-0">
          {t.upcomingAssessments.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No upcoming assessments scheduled" size="sm" bare className="py-6" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {t.upcomingAssessments.map((a) => (
                <li key={a.id} className="flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">{a.title}</p>
                    <p className="text-caption text-muted">
                      {a.batch.name} · {a.batch.code} · Max {a.maxMarks} marks
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="navy">{titleCase(a.type)}</Badge>
                    <span className="text-body-sm font-semibold text-ink">{formatDate(a.date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
