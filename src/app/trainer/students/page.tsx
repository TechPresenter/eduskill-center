import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { myBatches } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { toBatchOption } from "@/components/trainer/serialize";
import { StudentsClient } from "./students-client";

export const metadata: Metadata = { title: "My Students" };

export default async function TrainerStudentsPage({ searchParams }: PageProps<"/trainer/students">) {
  const user = await requireTrainer();
  const sp = await searchParams;
  const batches = await myBatches(user.trainer.id);
  return (
    <>
      <PageHeader title="My Students" description="Students admitted to your batches. Tap a row for a quick profile." />
      <InactiveBanner status={user.trainer.status} />
      <StudentsClient batches={batches.map(toBatchOption)} initialBatchId={typeof sp.batchId === "string" ? sp.batchId : ""} />
    </>
  );
}
