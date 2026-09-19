"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { cn, formatDateTime, titleCase } from "@/lib/utils";

export interface ThreadMessage {
  id: string;
  message: string;
  isStaff: boolean;
  createdAt: string | Date;
  user: { id: string; name: string; role: string };
}

export function TicketMessages({ messages, currentUserId }: { messages: ThreadMessage[]; currentUserId: string }) {
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = m.user.id === currentUserId;
        return (
          <li key={m.id} className={cn("flex gap-3", m.isStaff && "flex-row-reverse")}>
            <Avatar name={m.user.name} size={34} className={m.isStaff ? "bg-navy text-white" : undefined} />
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", m.isStaff ? "rounded-tr-sm bg-navy text-white" : "rounded-tl-sm bg-surface text-ink")}>
              <p className={cn("mb-1 text-[11px] font-semibold", m.isStaff ? "text-white/70" : "text-muted")}>
                {mine ? "You" : m.user.name} · {m.isStaff ? "Foundation staff" : titleCase(m.user.role)} · {formatDateTime(m.createdAt)}
              </p>
              <p className="whitespace-pre-line">{m.message}</p>
            </div>
          </li>
        );
      })}
      <div ref={endRef} />
    </ol>
  );
}

export function TicketReplyForm({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const router = useRouter();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/support/tickets/${ticketId}/messages`, { message });
      setMessage("");
      toast.success("Reply sent", "The user has been notified.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? (err.fieldErrors.message ?? err.message) : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (closed) return <Alert tone="info">This ticket is closed. Re-open it to reply.</Alert>;

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="Reply to the user" htmlFor="tk-reply" error={error}>
        <Textarea id="tk-reply" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} invalid={!!error} placeholder="Write your reply…" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={busy} disabled={message.trim().length < 2} leftIcon={<Send className="h-4 w-4" />}>
          Send reply
        </Button>
      </div>
    </form>
  );
}

export function TicketStatusForm({ ticketId, status, assignedToId, staff }: { ticketId: string; status: string; assignedToId: string | null; staff: { id: string; name: string; role: string }[] }) {
  const router = useRouter();
  const [next, setNext] = React.useState(status);
  const [assignee, setAssignee] = React.useState(assignedToId ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const dirty = next !== status || assignee !== (assignedToId ?? "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.post(`/api/admin/support/tickets/${ticketId}/status`, { status: next, assignedToId: assignee });
      toast.success("Ticket updated");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fieldErrors);
      toast.error("Could not update ticket", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Status" htmlFor="tk-status" error={errors.status}>
        <Select id="tk-status" value={next} onChange={(e) => setNext(e.target.value)} options={["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => ({ value: s, label: titleCase(s) }))} />
      </Field>
      <Field label="Assigned to" htmlFor="tk-assign" error={errors.assignedToId}>
        <Select id="tk-assign" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Unassigned" options={staff.map((s) => ({ value: s.id, label: `${s.name} · ${s.role}` }))} invalid={!!errors.assignedToId} />
      </Field>
      <Button type="submit" variant="navy" size="sm" fullWidth loading={busy} disabled={!dirty}>
        Update ticket
      </Button>
    </form>
  );
}
