import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { myBatches, visibleAnnouncements } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { toBatchOption } from "@/components/trainer/serialize";
import { AnnouncementsClient } from "./announcements-client";

export const metadata: Metadata = { title: "Announcements" };

export default async function TrainerAnnouncementsPage({ searchParams }: PageProps<"/trainer/announcements">) {
  const user = await requireTrainer();
  const sp = await searchParams;
  const [batches, announcements] = await Promise.all([myBatches(user.trainer.id), visibleAnnouncements(user.trainer.id)]);
  return (
    <>
      <PageHeader title="Announcements" description="Notices from the Foundation, your centers and your batches. Post announcements to the students of a batch." />
      <InactiveBanner status={user.trainer.status} />
      <AnnouncementsClient
        batches={batches.map(toBatchOption)}
        announcements={announcements.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          audience: a.audience,
          createdAt: a.createdAt.toISOString(),
          mine: a.createdById === user.id,
          batch: a.batch ? { id: a.batch.id, code: a.batch.code, name: a.batch.name } : null,
          center: a.center ? { id: a.center.id, code: a.center.code, name: a.center.name } : null,
        }))}
        initialBatchId={typeof sp.batchId === "string" ? sp.batchId : ""}
        disabled={user.trainer.status !== "ACTIVE"}
      />
    </>
  );
}
