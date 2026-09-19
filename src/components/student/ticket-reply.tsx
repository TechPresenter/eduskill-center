"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";

export function TicketReply({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api.post(`/api/student/support/${ticketId}/messages`, { message });
      setMessage("");
      toast.success("Reply sent");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors.message) setError(err.fieldErrors.message);
      else toast.error("Could not send", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="Reply" htmlFor="reply" error={error}>
        <Textarea id="reply" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} invalid={!!error} placeholder="Write your reply…" maxLength={5000} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={busy} disabled={message.trim().length < 2} leftIcon={<Send className="h-4 w-4" />}>
          Send reply
        </Button>
      </div>
    </form>
  );
}
