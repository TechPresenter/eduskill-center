import type { Metadata } from "next";
import { requireTrainer } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/misc";
import { InactiveBanner } from "@/components/trainer/inactive-banner";
import { NotificationsClient } from "./notifications-client";

export const metadata: Metadata = { title: "Notifications" };

export default async function TrainerNotificationsPage() {
  const user = await requireTrainer();
  return (
    <>
      <PageHeader title="Notifications" description="Assignments, batch updates and messages from the Foundation." />
      <InactiveBanner status={user.trainer.status} />
      <NotificationsClient />
    </>
  );
}
