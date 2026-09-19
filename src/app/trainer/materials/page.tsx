import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { myBatches } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { toBatchOption } from "@/components/trainer/serialize";
import { MaterialsClient } from "./materials-client";

export const metadata: Metadata = { title: "Training Materials" };

export default async function TrainerMaterialsPage({ searchParams }: PageProps<"/trainer/materials">) {
  const user = await requireTrainer();
  const sp = await searchParams;
  const batches = await myBatches(user.trainer.id);
  return (
    <>
      <PageHeader title="Training Materials" description="Share notes, worksheets, slides and videos with the students of your batches." />
      <InactiveBanner status={user.trainer.status} />
      <MaterialsClient batches={batches.map(toBatchOption)} initialBatchId={typeof sp.batchId === "string" ? sp.batchId : ""} disabled={user.trainer.status !== "ACTIVE"} />
    </>
  );
}
