import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { requireTrainer } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";
import { myBatches } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { InactiveBanner } from "@/components/trainer/inactive-banner";

export const metadata: Metadata = { title: "My Batches" };

export default async function TrainerBatchesPage() {
  const user = await requireTrainer();
  const batches = await myBatches(user.trainer.id);
  return (
    <>
      <PageHeader title="My Batches" description="Batches you teach or are actively assigned to." />
      <InactiveBanner status={user.trainer.status} />
      {batches.length === 0 ? (
        <EmptyState title="No batches yet" description="Batches appear here when the Foundation assigns you as the trainer." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {batches.map((b) => (
            <Link key={b.id} href={`/trainer/batches/${b.id}`} className="card card-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted">{b.code}</p>
                  <h3 className="mt-0.5 truncate text-base font-bold text-navy">{b.name}</h3>
                  <p className="text-sm text-muted">{b.course.name}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <dl className="mt-4 space-y-2 text-sm text-muted">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <dd className="truncate">{b.center.name}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <dd>
                    {formatDate(b.startDate)} – {formatDate(b.endDate)}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <dd className="truncate">
                    {b.days.join(", ")} · {b.startTime}–{b.endTime}
                    {b.room ? ` · ${b.room}` : ""}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0" />
                  <dd>
                    {b._count.admissions} / {b.capacity} students
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-4 border-t border-line pt-3 text-xs text-muted">
                <span>{b._count.assignments} assignments</span>
                <span>{b._count.assessments} assessments</span>
                <span>{b._count.studyMaterials} materials</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
