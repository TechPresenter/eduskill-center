import type { Metadata } from "next";
import { CalendarDays, ClipboardList, FileText } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { studentTimetable } from "@/server/student-portal";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeDays, timeSortKey, WEEK_DAYS, type WeekDay } from "@/components/student/timetable-utils";

export const metadata: Metadata = { title: "Timetable" };

interface Slot {
  day: WeekDay;
  startTime: string;
  endTime: string;
  room: string | null;
  course: string;
  batch: string;
  batchCode: string;
  trainer: string | null;
  center: string;
  centerCode: string;
  startDate: Date;
  endDate: Date;
}

export default async function StudentTimetablePage() {
  const user = await requireStudent();
  const { admissions, assessments, assignments } = await studentTimetable(user.student.id);

  const slots: Slot[] = [];
  for (const a of admissions) {
    for (const day of normalizeDays(a.batch.days)) {
      slots.push({ day, startTime: a.batch.startTime, endTime: a.batch.endTime, room: a.batch.room, course: a.course.name, batch: a.batch.name, batchCode: a.batch.code, trainer: a.batch.trainer?.user.name ?? a.trainer?.user.name ?? null, center: a.center.name, centerCode: a.center.code, startDate: a.batch.startDate, endDate: a.batch.endDate });
    }
  }
  const byDay = new Map<WeekDay, Slot[]>(WEEK_DAYS.map((d) => [d, []]));
  for (const s of slots) byDay.get(s.day)!.push(s);
  for (const list of byDay.values()) list.sort((x, y) => timeSortKey(x.startTime) - timeSortKey(y.startTime));
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon = 0

  return (
    <div className="space-y-6">
      <PageHeader title="Timetable" description={admissions.length ? admissions.map((a) => `${a.batch.name} · ${formatDate(a.batch.startDate)} – ${formatDate(a.batch.endDate)}`).join(" | ") : "Your weekly class schedule appears here once your admission is confirmed."} />

      {admissions.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No active batch" description="Your timetable is built from the batches you are admitted to." action={<ButtonLink href="/student/applications" variant="outline">My applications</ButtonLink>} />
      ) : (
        <>
          {/* Desktop grid */}
          <div className="hidden lg:grid lg:grid-cols-7 lg:gap-3">
            {WEEK_DAYS.map((d, i) => {
              const list = byDay.get(d)!;
              const isToday = i === todayIdx;
              return (
                <div key={d} className={`card flex min-h-[14rem] flex-col ${isToday ? "ring-2 ring-orange/40" : ""}`}>
                  <div className={`rounded-t-card px-3 py-2 text-center text-xs font-bold tracking-wide uppercase ${isToday ? "bg-orange text-white" : "bg-navy text-white"}`}>{d}</div>
                  <div className="flex-1 space-y-2 p-2">
                    {list.length === 0 ? (
                      <p className="pt-6 text-center text-xs text-muted">No class</p>
                    ) : (
                      list.map((s, k) => <SlotCard key={k} slot={s} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile list */}
          <div className="space-y-3 lg:hidden">
            {WEEK_DAYS.map((d, i) => {
              const list = byDay.get(d)!;
              if (list.length === 0) return null;
              return (
                <Card key={d}>
                  <CardHeader title={d} description={i === todayIdx ? "Today" : undefined} />
                  <CardBody className="space-y-2">
                    {list.map((s, k) => (
                      <SlotCard key={k} slot={s} />
                    ))}
                  </CardBody>
                </Card>
              );
            })}
            {slots.length === 0 && <EmptyState title="No class days set" description="Your batch does not have class days configured yet." />}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming assessments" action={<ButtonLink href="/student/assessments" variant="ghost" size="sm">All</ButtonLink>} />
          {assessments.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted">No assessments scheduled.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {assessments.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-muted">
                      {a.batch.course.name} · {titleCase(a.type)} · Max {a.maxMarks} marks
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-navy">{formatDate(a.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Assignments due" action={<ButtonLink href="/student/assignments" variant="ghost" size="sm">All</ButtonLink>} />
          {assignments.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted">No assignments due.</p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-muted">{a.batch.course.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-navy">{formatDateTime(a.dueDate)}</p>
                    {a.submissions.length > 0 ? <Badge tone="success">Submitted</Badge> : <Badge tone="warning">Pending</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SlotCard({ slot }: { slot: Slot }) {
  return (
    <div className="rounded-lg border border-line bg-lavender/60 p-2.5 text-xs">
      <p className="font-bold text-navy">
        {slot.startTime}–{slot.endTime}
      </p>
      <p className="mt-0.5 font-semibold text-ink">{slot.course}</p>
      <p className="text-muted">
        {slot.batch}
        {slot.room ? ` · Room ${slot.room}` : ""}
      </p>
      {slot.trainer && <p className="text-muted">Trainer: {slot.trainer}</p>}
      <p className="truncate text-muted" title={slot.center}>
        {slot.center}
      </p>
    </div>
  );
}
