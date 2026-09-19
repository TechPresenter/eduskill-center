import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { isoDay, myBatches, utcToday } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { toBatchOption } from "@/components/trainer/serialize";
import { CourseworkClient } from "./coursework-client";

export const metadata: Metadata = { title: "Coursework" };

export default async function TrainerCourseworkPage({ searchParams }: PageProps<"/trainer/coursework">) {
  const user = await requireTrainer();
  const sp = await searchParams;
  const batches = await myBatches(user.trainer.id);
  return (
    <>
      <PageHeader title="Coursework" description="Set assignments for your batches, review student submissions and grade them." />
      <InactiveBanner status={user.trainer.status} />
      <CourseworkClient batches={batches.map(toBatchOption)} initialBatchId={typeof sp.batchId === "string" ? sp.batchId : ""} today={isoDay(utcToday())} disabled={user.trainer.status !== "ACTIVE"} />
    </>
  );
}
