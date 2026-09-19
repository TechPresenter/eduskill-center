import type { Metadata } from "next";
import Link from "next/link";
import { requireTrainer } from "@/lib/auth/guards";
import { cn, formatDate, titleCase } from "@/lib/utils";
import { weeklyTimetable } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { InactiveBanner } from "@/components/trainer/inactive-banner";

export const metadata: Metadata = { title: "Timetable" };

const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function TrainerTimetablePage() {
  const user = await requireTrainer();
  const t = await weeklyTimetable(user.trainer.id);
  // Show Monday → Sunday
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ index: i, ...t.grid[i]! }));
  const hasAny = ordered.some((d) => d.classes.length > 0);

  return (
    <>
      <PageHeader title="Weekly Timetable" description={`Today is ${formatDate(t.today, "EEEE, dd MMM yyyy")}. Ongoing and upcoming batches only.`} />
      <InactiveBanner status={user.trainer.status} />
      {!hasAny ? (
        <EmptyState title="No scheduled classes" description="Your timetable fills in once you are assigned to an ongoing or upcoming batch." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {ordered.map((d) => {
            const isToday = d.index === t.todayIndex;
            return (
              <section key={d.day} className={cn("card flex flex-col overflow-hidden", isToday && "ring-2 ring-orange")} aria-label={FULL[d.index]}>
                <header className={cn("flex items-center justify-between px-3 py-2.5", isToday ? "bg-orange text-white" : "bg-surface text-navy")}>
                  <span className="text-sm font-bold">{FULL[d.index]}</span>
                  {isToday && <span className="text-[10px] font-bold tracking-widest uppercase">Today</span>}
                </header>
                <div className="flex-1 space-y-2 p-2.5">
                  {d.classes.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-muted">No classes</p>
                  ) : (
                    d.classes.map((c) => {
                      const notStarted = c.startDate > t.today;
                      return (
                        <Link key={c.id} href={`/trainer/batches/${c.id}`} className={cn("block rounded-xl border p-3 transition-colors hover:border-navy/40", notStarted ? "border-dashed border-line bg-surface/60" : "border-line bg-white")}>
                          <p className="text-xs font-bold text-navy">
                            {c.startTime}–{c.endTime}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-ink">{c.name}</p>
                          <p className="text-xs text-muted">{c.course.name}</p>
                          <p className="mt-1 truncate text-xs text-muted">
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
            <p className="px-5 py-8 text-center text-sm text-muted">No upcoming assessments scheduled.</p>
          ) : (
            <ul className="divide-y divide-line">
              {t.upcomingAssessments.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-muted">
                      {a.batch.name} · {a.batch.code} · Max {a.maxMarks} marks
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="navy">{titleCase(a.type)}</Badge>
                    <span className="text-sm font-medium text-ink">{formatDate(a.date)}</span>
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
