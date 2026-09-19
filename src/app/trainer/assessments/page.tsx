import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { myBatches } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { toBatchOption } from "@/components/trainer/serialize";
import { AssessmentsClient } from "./assessments-client";

export const metadata: Metadata = { title: "Assessments" };

export default async function TrainerAssessmentsPage({ searchParams }: PageProps<"/trainer/assessments">) {
  const user = await requireTrainer();
  const sp = await searchParams;
  const batches = await myBatches(user.trainer.id);
  return (
    <>
      <PageHeader title="Assessments" description="Schedule quizzes, practicals and exams for your batches and enter results. Grades are calculated automatically." />
      <InactiveBanner status={user.trainer.status} />
      <AssessmentsClient batches={batches.map(toBatchOption)} initialBatchId={typeof sp.batchId === "string" ? sp.batchId : ""} disabled={user.trainer.status !== "ACTIVE"} />
    </>
  );
}
