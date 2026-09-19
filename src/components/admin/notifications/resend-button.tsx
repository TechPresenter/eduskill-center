"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";

export function ResendButton({ id, channel }: { id: string; channel: string }) {
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
  return (
    <Button size="xs" variant="outline" onClick={resend} loading={busy} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
      Resend
    </Button>
  );
}
