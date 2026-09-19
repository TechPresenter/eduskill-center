import { addDays, format, startOfWeek } from "date-fns";

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

const ALIASES: Record<string, WeekDay> = {
  mon: "Mon", monday: "Mon",
  tue: "Tue", tues: "Tue", tuesday: "Tue",
  wed: "Wed", wednesday: "Wed",
  thu: "Thu", thur: "Thu", thurs: "Thu", thursday: "Thu",
  fri: "Fri", friday: "Fri",
  sat: "Sat", saturday: "Sat",
  sun: "Sun", sunday: "Sun",
};

/** Normalises stored day names ("Mon", "monday", "MON") to the canonical three-letter form. */
export function normalizeDay(day: string): WeekDay | null {
  return ALIASES[day.trim().toLowerCase()] ?? null;
}

export function normalizeDays(days: string[]): WeekDay[] {
  const set = new Set<WeekDay>();
  for (const d of days) {
    const n = normalizeDay(d);
    if (n) set.add(n);
  }
  return WEEK_DAYS.filter((d) => set.has(d));
}

export interface BatchLike {
  days: string[];
  startDate: Date | string;
  endDate: Date | string;
  startTime: string;
  endTime: string;
}

/** Remaining class days in the current week (Mon–Sun) for a batch, from today onwards and within the batch dates. */
export function upcomingClassDays(batch: BatchLike, now = new Date()) {
  const days = new Set(normalizeDays(batch.days));
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const start = new Date(batch.startDate);
  const end = new Date(batch.endDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: { iso: string; label: string; day: WeekDay }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const day = WEEK_DAYS[i]!;
    if (!days.has(day)) continue;
    if (date < today) continue;
    if (date < new Date(start.getFullYear(), start.getMonth(), start.getDate())) continue;
    if (date > new Date(end.getFullYear(), end.getMonth(), end.getDate())) continue;
    out.push({ iso: format(date, "yyyy-MM-dd"), label: `${day} ${format(date, "d MMM")} · ${batch.startTime}–${batch.endTime}`, day });
  }
  return out;
}

/** Sort key for "HH:mm" strings. */
export function timeSortKey(t: string) {
  const [h, m] = t.split(":").map((x) => Number(x));
  return (h ?? 0) * 60 + (m ?? 0);
}
