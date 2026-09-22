import Link from "next/link";
import { CalendarCheck, Check, ChevronRight, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TodayClass {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  room: string | null;
  course: { name: string };
  center: { name: string; code: string };
  attendanceMarked: boolean;
}

export interface TodayClassesProps {
  classes: TodayClass[];
  /** Weekday label rendered in the section header ("Tuesday"). */
  dayLabel: string;
  /** Marking is disabled for an inactive trainer — the row then only links to the batch. */
  canMark?: boolean;
  className?: string;
}

/**
 * "Today" strip on the trainer phone home: one row per class with its time, centre and room, and the
 * single most useful action — mark attendance, or a quiet "Marked" confirmation once it is done.
 *
 * Rows are 64px+ and the primary action is a 44px control of its own, so a thumb never has to choose
 * between "open the batch" and "mark the register".
 */
export function TodayClasses({ classes, dayLabel, canMark = true, className }: TodayClassesProps) {
  const pending = classes.filter((c) => !c.attendanceMarked).length;

  return (
    <section className={cn("card overflow-hidden", className)} aria-label={`Classes today, ${dayLabel}`}>
      <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-h4 text-navy">Today&rsquo;s classes</h2>
          <p className="truncate text-caption text-muted">
            {dayLabel}
            {classes.length > 0 && ` · ${pending ? `${pending} to mark` : "all marked"}`}
          </p>
        </div>
        <Link href="/trainer/timetable" className="inline-flex min-h-11 shrink-0 items-center text-body-sm font-semibold text-orange tap-highlight-none">
          Timetable
        </Link>
      </header>

      {classes.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-lavender text-navy">
            <CalendarCheck className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-body-sm text-muted">No classes scheduled today. Your weekly timetable shows what is coming up.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {classes.map((c) => (
            <li key={c.id} className="flex items-stretch gap-2 px-3 py-2">
              <Link href={`/trainer/batches/${c.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-2 tap-highlight-none active:bg-surface">
                <span className="w-16 shrink-0 text-center">
                  <span className="block text-body-sm font-bold text-navy tabular-nums">{c.startTime}</span>
                  <span className="block text-caption text-muted tabular-nums">{c.endTime}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink">{c.name}</span>
                  <span className="block truncate text-caption text-muted">{c.course.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 truncate text-caption text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {c.center.name}
                    {c.room ? ` · ${c.room}` : ""}
                  </span>
                </span>
              </Link>
              <div className="flex shrink-0 items-center">
                {c.attendanceMarked ? (
                  <span className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-success-light px-2.5 text-caption font-bold text-success-dark">
                    <Check className="h-4 w-4" aria-hidden /> Marked
                  </span>
                ) : canMark ? (
                  <Link
                    href={`/trainer/attendance?batchId=${c.id}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md bg-orange px-3 text-body-sm font-semibold text-white tap-highlight-none transition duration-micro active:scale-[0.98] motion-reduce:transition-none"
                  >
                    <Clock className="h-4 w-4" aria-hidden /> Mark
                  </Link>
                ) : (
                  <ChevronRight className="mr-1 h-5 w-5 text-muted" aria-hidden />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
