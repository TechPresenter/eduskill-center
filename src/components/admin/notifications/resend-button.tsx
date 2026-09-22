"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";

/** Re-queues a failed email / SMS / WhatsApp. `compact` is the 44px icon form used in phone list rows. */
export function ResendButton({ id, channel, compact }: { id: string; channel: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const resend = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/notifications/log/${id}`);
      toast.success(`${channel} queued for resend`, "Check the log in a moment for the delivery result.");
      router.refresh();
    } catch (err) {
      toast.error("Could not resend", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  if (compact) return <IconButton variant="outline" icon={<RefreshCw className="h-4 w-4" />} aria-label={`Resend ${channel}`} onClick={resend} loading={busy} />;
  return (
    <Button size="sm" variant="outline" onClick={resend} loading={busy} leftIcon={<RefreshCw className="h-4 w-4" />}>
      Resend
    </Button>
  );
}
