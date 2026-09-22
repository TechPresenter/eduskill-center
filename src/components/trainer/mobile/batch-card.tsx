import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";

export interface BatchCardData {
  id: string;
  code: string;
  name: string;
  status: string;
  courseName: string;
  centerName: string;
  startDate: string | Date;
  endDate: string | Date;
  days: string[];
  startTime: string;
  endTime: string;
  room: string | null;
  admitted: number;
  capacity: number;
  counts?: { assignments: number; assessments: number; materials: number };
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted" aria-hidden>
        {icon}
      </span>
      <dd className="min-w-0 flex-1 text-body-sm text-muted">{children}</dd>
    </div>
  );
}

/**
 * One batch, as a card. The same card serves the phone list and the desktop grid — the audit's point
 * about the same record cropping differently in two places applies to layout as much as to photos.
 * The whole card is the tap target, so there is nothing smaller than 44px to aim at.
 */
export function BatchCard({ batch: b, className }: { batch: BatchCardData; className?: string }) {
  const seatsPct = b.capacity > 0 ? Math.min(100, Math.round((b.admitted / b.capacity) * 100)) : 0;
  return (
    <Link href={`/trainer/batches/${b.id}`} className={cn("card card-hover flex flex-col p-5 tap-highlight-none", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-caption font-semibold text-muted">{b.code}</p>
          {/* Batch and course names are long and the card has the room: wrap to two lines rather than
              truncating, which at 360px was hiding the part that tells two batches apart. */}
          <h3 className="mt-0.5 line-clamp-2 text-h4 text-navy">{b.name}</h3>
          <p className="line-clamp-2 text-body-sm text-muted">{b.courseName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge status={b.status} />
          <ChevronRight className="h-5 w-5 text-muted lg:hidden" aria-hidden />
        </div>
      </div>

      <dl className="mt-4 space-y-2">
        <Meta icon={<MapPin className="h-4 w-4" />}>
          <span className="line-clamp-2">{b.centerName}</span>
        </Meta>
        <Meta icon={<CalendarDays className="h-4 w-4" />}>
          {formatDate(b.startDate)} – {formatDate(b.endDate)}
        </Meta>
        <Meta icon={<Clock className="h-4 w-4" />}>
          {b.days.join(", ")} · {b.startTime}–{b.endTime}
          {b.room ? ` · ${b.room}` : ""}
        </Meta>
        <Meta icon={<Users className="h-4 w-4" />}>
          <span className="font-semibold text-ink tabular-nums">{b.admitted}</span> of {b.capacity} seats filled
        </Meta>
      </dl>

      <div className="mt-3" aria-hidden>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-lavender">
          <div className="h-full rounded-full bg-navy" style={{ width: `${seatsPct}%` }} />
        </div>
      </div>

      {b.counts && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-caption text-muted">
          <span>{b.counts.assignments} assignments</span>
          <span>{b.counts.assessments} assessments</span>
          <span>{b.counts.materials} materials</span>
        </div>
      )}
    </Link>
  );
}
