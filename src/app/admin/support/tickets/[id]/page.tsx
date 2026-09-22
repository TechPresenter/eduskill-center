import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { formatDateTime, titleCase } from "@/lib/utils";
import { getTicket } from "@/server/support";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { LifeBuoy } from "lucide-react";
import { IconTile } from "@/components/admin/content/app-list";
import { TicketMessages, TicketReplyForm, TicketStatusForm } from "@/components/admin/support/ticket-thread";

export const metadata = { title: "Support Ticket" };

const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" };

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin("support.view");
  const { id } = await params;
  const ticket = await getTicket(id).catch(() => null);
  if (!ticket) notFound();
  const canRespond = hasPermission(user, "support.respond");

  const [staffUsers, assignee, portalRecord] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "STAFF"] }, status: "ACTIVE", deletedAt: null, OR: [{ role: "SUPER_ADMIN" }, { staff: { deletedAt: null } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, staff: { select: { designation: true, role: { select: { name: true } } } } },
    }),
    ticket.assignedToId ? db.user.findUnique({ where: { id: ticket.assignedToId }, select: { name: true } }) : Promise.resolve(null),
    ticket.user.role === "STUDENT"
      ? db.student.findUnique({ where: { userId: ticket.user.id }, select: { id: true, studentId: true } }).then((s) => (s ? { href: `/admin/students/${s.id}`, label: s.studentId ?? "Student profile" } : null))
      : ticket.user.role === "TRAINER"
        ? db.trainer.findUnique({ where: { userId: ticket.user.id }, select: { id: true, trainerId: true } }).then((t) => (t ? { href: `/admin/trainers/${t.id}`, label: t.trainerId } : null))
        : Promise.resolve(null),
  ]);
  const staff = staffUsers.map((u) => ({ id: u.id, name: u.name, role: u.role === "SUPER_ADMIN" ? "Super Admin" : (u.staff?.role?.name ?? u.staff?.designation ?? "Staff") }));
  const first = ticket.messages[0];

  return (
    <div>
      <PageHeader
        mobileTitle={ticket.ticketNo}
        backHref="/admin/support/tickets"
        breadcrumbs={[{ label: "Support tickets", href: "/admin/support/tickets" }, { label: ticket.ticketNo }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {ticket.subject}
            <StatusBadge status={ticket.status} />
            <Badge tone={PRIORITY_TONE[ticket.priority] ?? "neutral"}>{titleCase(ticket.priority)} priority</Badge>
          </span>
        }
        description={
          <span className="hidden lg:inline">
            <span className="font-mono text-navy">{ticket.ticketNo}</span> · raised by {ticket.user.name} ({titleCase(ticket.user.role)}) on {formatDateTime(ticket.createdAt)}
            {ticket.category ? ` · ${ticket.category}` : ""}
          </span>
        }
      />

      {/* Phones: the subject and state (the app bar shows only the ticket number). */}
      <Card className="mb-4 flex items-start gap-3 p-4 lg:hidden">
        <IconTile tone={ticket.status === "OPEN" ? "orange" : ticket.status === "RESOLVED" ? "success" : "lavender"}>
          <LifeBuoy />
        </IconTile>
        <div className="min-w-0 flex-1">
          <h2 className="text-h4 break-words text-navy">{ticket.subject}</h2>
          <p className="mt-0.5 text-body-sm text-muted">
            {ticket.user.name} · {titleCase(ticket.user.role)} · {formatDateTime(ticket.createdAt)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={ticket.status} />
            <Badge tone={PRIORITY_TONE[ticket.priority] ?? "neutral"}>{titleCase(ticket.priority)} priority</Badge>
            {ticket.category && <Badge tone="navy">{ticket.category}</Badge>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="space-y-4 lg:col-span-2 lg:space-y-5">
          <Card>
            <CardHeader title="Conversation" description={`${ticket.messages.length} message${ticket.messages.length === 1 ? "" : "s"}${first ? ` · opened ${formatDateTime(first.createdAt)}` : ""}`} />
            <CardBody>
              <TicketMessages messages={ticket.messages} currentUserId={user.id} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Reply" description="Your reply is emailed / sent to the user and appears in their portal." />
            <CardBody>{canRespond ? <TicketReplyForm ticketId={ticket.id} closed={ticket.status === "CLOSED"} /> : <Alert tone="info">You need the &ldquo;Respond&rdquo; permission to reply to tickets.</Alert>}</CardBody>
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-4">
              <KeyValue
                label="Raised by"
                value={
                  <span>
                    {ticket.user.name}
                    <span className="block text-caption font-normal break-all text-muted">{[ticket.user.email, ticket.user.mobile].filter(Boolean).join(" · ") || "—"}</span>
                  </span>
                }
              />
              <KeyValue label="Role" value={titleCase(ticket.user.role)} />
              {portalRecord && (
                <KeyValue
                  label="Record"
                  value={
                    <Link href={portalRecord.href} className="font-mono text-navy hover:underline">
                      {portalRecord.label}
                    </Link>
                  }
                />
              )}
              <KeyValue label="Category" value={ticket.category ?? "—"} />
              <KeyValue label="Priority" value={<Badge tone={PRIORITY_TONE[ticket.priority] ?? "neutral"}>{titleCase(ticket.priority)}</Badge>} />
              <KeyValue label="Assigned to" value={assignee?.name ?? "Unassigned"} />
              <KeyValue label="Opened" value={formatDateTime(ticket.createdAt)} />
              <KeyValue label="Last activity" value={formatDateTime(ticket.updatedAt)} />
            </CardBody>
          </Card>
          {canRespond && (
            <Card>
              <CardHeader title="Status & assignment" />
              <CardBody>
                <TicketStatusForm ticketId={ticket.id} status={ticket.status} assignedToId={ticket.assignedToId} staff={staff} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
