import type { Metadata } from "next";
import { UsersRound } from "lucide-react";
import { requireTrainer } from "@/lib/auth/guards";
import { myBatches } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/feedback";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { BatchCard } from "@/components/trainer/mobile";

export const metadata: Metadata = { title: "My Batches" };

export default async function TrainerBatchesPage() {
  const user = await requireTrainer();
  const batches = await myBatches(user.trainer.id);
  const ongoing = batches.filter((b) => b.status === "ONGOING").length;

  return (
    <>
      <PageHeader
        title="My Batches"
        description={batches.length ? `${batches.length} batch${batches.length === 1 ? "" : "es"} · ${ongoing} ongoing` : "Batches you teach or are actively assigned to."}
      />
      <InactiveBanner status={user.trainer.status} />
      {batches.length === 0 ? (
        <EmptyState icon={<UsersRound className="h-7 w-7" />} title="No batches yet" description="Batches appear here when the Foundation assigns you as the trainer." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {batches.map((b) => (
            <li key={b.id} className="flex">
              <BatchCard
                className="w-full"
                batch={{
                  id: b.id,
                  code: b.code,
                  name: b.name,
                  status: b.status,
                  courseName: b.course.name,
                  centerName: b.center.name,
                  startDate: b.startDate,
                  endDate: b.endDate,
                  days: b.days,
                  startTime: b.startTime,
                  endTime: b.endTime,
                  room: b.room,
                  admitted: b._count.admissions,
                  capacity: b.capacity,
                  counts: { assignments: b._count.assignments, assessments: b._count.assessments, materials: b._count.studyMaterials },
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
