import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api/errors";
import { getTicket } from "@/server/support";
import { formatDateTime, isUuid, titleCase } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { TicketReply } from "@/components/student/ticket-reply";

export const metadata: Metadata = { title: "Support ticket" };

export default async function StudentTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  let ticket: Awaited<ReturnType<typeof getTicket>>;
  try {
    ticket = await getTicket(id, { userId: user.id });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Support", href: "/student/support" }, { label: ticket.ticketNo }]}
        title={ticket.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{ticket.ticketNo}</span>
            <StatusBadge status={ticket.status} />
            <Badge tone={ticket.priority === "HIGH" ? "danger" : ticket.priority === "LOW" ? "neutral" : "warning"}>{titleCase(ticket.priority)} priority</Badge>
            {ticket.category && <span>· {ticket.category}</span>}
            <span>· Opened {formatDateTime(ticket.createdAt)}</span>
          </span>
        }
      />

      {ticket.status === "RESOLVED" && <Alert tone="success">This ticket is marked as resolved. Reply below if you still need help – it will be reopened.</Alert>}
      {ticket.status === "CLOSED" && <Alert tone="info">This ticket is closed. Please open a new ticket for further help.</Alert>}

      <Card>
        <CardHeader title="Conversation" description={`${ticket.messages.length} message${ticket.messages.length === 1 ? "" : "s"}`} />
        <CardBody className="space-y-4">
          {ticket.messages.map((m) => {
            const mine = m.userId === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-card px-4 py-3 text-body-sm ${mine ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-lavender text-ink"}`}>
                  <p className={`mb-1 text-caption font-semibold ${mine ? "text-white/70" : "text-navy/70"}`}>
                    {mine ? "You" : `${m.user.name} · ${m.isStaff ? "Foundation" : titleCase(m.user.role)}`} · {formatDateTime(m.createdAt)}
                  </p>
                  <p className="whitespace-pre-line">{m.message}</p>
                </div>
              </div>
            );
          })}
        </CardBody>
        {ticket.status !== "CLOSED" && (
          <div className="border-t border-line p-5">
            <TicketReply ticketId={ticket.id} />
          </div>
        )}
      </Card>
    </div>
  );
}
