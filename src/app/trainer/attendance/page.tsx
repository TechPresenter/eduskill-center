import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { isoDay, myBatches, utcToday } from "@/server/trainer-scope";
import { PageHeader } from "@/components/ui/misc";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { toBatchOption } from "@/components/trainer/serialize";
import { AttendanceClient } from "./attendance-client";

export const metadata: Metadata = { title: "Attendance" };

export default async function TrainerAttendancePage({ searchParams }: PageProps<"/trainer/attendance">) {
  const user = await requireTrainer();
  const sp = await searchParams;
  const batches = await myBatches(user.trainer.id);
  const markable = batches.filter((b) => b.status !== "CANCELLED");
  return (
    <>
      <PageHeader title="Attendance" description="Mark daily attendance for your batches and review attendance reports." />
      <InactiveBanner status={user.trainer.status} />
      <AttendanceClient batches={markable.map(toBatchOption)} initialBatchId={typeof sp.batchId === "string" ? sp.batchId : ""} today={isoDay(utcToday())} disabled={user.trainer.status !== "ACTIVE"} />
    </>
  );
}
