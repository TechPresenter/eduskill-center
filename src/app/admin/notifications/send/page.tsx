import { requireAdmin } from "@/lib/auth/guards";
import { enabledChannels } from "@/server/notifications-admin";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/feedback";
import { SendMessageForm } from "@/components/admin/notifications/send-message-form";

export const metadata = { title: "Send Message" };

export default async function SendMessagePage() {
  await requireAdmin("notifications.send");
  const enabled = await enabledChannels();
  const off = (["EMAIL", "SMS", "WHATSAPP"] as const).filter((c) => !enabled[c]);

  return (
    <div>
      <PageHeader title="Send a message" mobileTitle="Send message" description="Send a one-off message to a single student, trainer or staff member. It always lands in their in-app inbox; add email, SMS or WhatsApp when enabled." />
      {off.length > 0 && (
        <Alert tone="info" className="mb-4">
          {off.map((c) => (c === "EMAIL" ? "Email" : c === "SMS" ? "SMS" : "WhatsApp")).join(", ")} {off.length === 1 ? "is" : "are"} switched off in Settings → Communication, so only the remaining channels can be used.
        </Alert>
      )}
      <SendMessageForm enabled={enabled} />
    </div>
  );
}
