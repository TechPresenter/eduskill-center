import { db, type Prisma } from "@/lib/db";
import type { TicketPriority, TicketStatus, EnquiryStatus } from "@/generated/prisma/enums";
import { Errors } from "@/lib/api/errors";
import { audit, type AuditActor } from "@/lib/audit";
import { notify, notifyStaff } from "@/lib/notifications";
import { generateTicketNo } from "@/lib/ids";
import { paginationSchema, getPaging, buildOrderBy, paged } from "@/lib/api/query";
import { z } from "zod";

export interface Ctx {
  user: AuditActor;
  ip?: string | null;
  userAgent?: string | null;
}

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "Enter a subject").max(200),
  category: z.string().trim().max(60).optional().nullable(),
  message: z.string().trim().min(5, "Describe your issue").max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export async function createTicket(userId: string, input: z.infer<typeof createTicketSchema>) {
  const ticket = await db.$transaction(async (tx) => {
    const ticketNo = await generateTicketNo(tx);
    return tx.supportTicket.create({
      data: { ticketNo, userId, subject: input.subject, category: input.category ?? null, priority: (input.priority as TicketPriority) ?? "MEDIUM", messages: { create: [{ userId, message: input.message }] } },
      include: { messages: true, user: { select: { name: true, email: true, mobile: true } } },
    });
  });
  await notify({
    userId,
    email: ticket.user.email,
    mobile: ticket.user.mobile,
    event: "SUPPORT_TICKET_CREATED",
    data: { name: ticket.user.name, ticketNo: ticket.ticketNo, subject: ticket.subject },
  });
  await notifyStaff({
    permission: "support.view",
    title: `New support ticket ${ticket.ticketNo}`,
    body: `${ticket.user.name} raised a ${ticket.priority.toLowerCase()} priority ticket.\n\nSubject: ${ticket.subject}\n\n${input.message}`,
    path: `/admin/support/tickets/${ticket.id}`,
  });
  return ticket;
}

export async function listUserTickets(userId: string) {
  return db.supportTicket.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { messages: true } } } });
}

export async function getTicket(id: string, scope?: { userId?: string }) {
  const t = await db.supportTicket.findFirst({
    where: { id, ...(scope?.userId ? { userId: scope.userId } : {}) },
    include: { user: { select: { id: true, name: true, email: true, mobile: true, role: true } }, messages: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, role: true } } } } },
  });
  if (!t) throw Errors.notFound("Ticket");
  return t;
}

export async function addTicketMessage(ticketId: string, author: { id: string; name: string; role: string }, message: string, scope?: { userId?: string }) {
  const ticket = await getTicket(ticketId, scope);
  if (ticket.status === "CLOSED") throw Errors.badRequest("This ticket is closed. Please open a new ticket.");
  const isStaff = author.role === "SUPER_ADMIN" || author.role === "STAFF";
  const msg = await db.$transaction(async (tx) => {
    const m = await tx.ticketMessage.create({ data: { ticketId, userId: author.id, message, isStaff } });
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status: isStaff ? "IN_PROGRESS" : ticket.status === "RESOLVED" ? "OPEN" : ticket.status, updatedAt: new Date() } });
    return m;
  });
  if (isStaff) {
    await notify({ userId: ticket.userId, email: ticket.user.email, mobile: ticket.user.mobile, event: "SUPPORT_REPLY", data: { name: ticket.user.name, ticketNo: ticket.ticketNo, message } });
    await audit({ user: author, action: "reply", module: "support", recordType: "SupportTicket", recordId: ticketId, description: `${author.name} replied on ticket ${ticket.ticketNo}` });
  }
  return msg;
}

export async function setTicketStatus(ticketId: string, status: TicketStatus, ctx: Ctx, assignedToId?: string | null) {
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw Errors.notFound("Ticket");
  const updated = await db.supportTicket.update({ where: { id: ticketId }, data: { status, assignedToId: assignedToId === undefined ? ticket.assignedToId : assignedToId } });
  await audit({ user: ctx.user, action: "status", module: "support", recordType: "SupportTicket", recordId: ticketId, description: `${ctx.user.name} set ticket ${ticket.ticketNo} to ${status}`, oldValue: { status: ticket.status }, newValue: { status }, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}

export const ticketListSchema = paginationSchema.extend({
  status: z.string().optional(),
  priority: z.string().optional(),
  role: z.string().optional(),
});

export async function listTicketsAdmin(q: z.infer<typeof ticketListSchema>) {
  const where: Prisma.SupportTicketWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",") as TicketStatus[] };
  if (q.priority) where.priority = { in: q.priority.split(",") as TicketPriority[] };
  if (q.role) where.user = { role: q.role as "STUDENT" | "TRAINER" | "STAFF" | "SUPER_ADMIN" };
  if (q.q) where.OR = [{ ticketNo: { contains: q.q, mode: "insensitive" } }, { subject: { contains: q.q, mode: "insensitive" } }, { user: { name: { contains: q.q, mode: "insensitive" } } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["updatedAt", "createdAt", "status", "priority"] as const, "updatedAt");
  const [items, total] = await Promise.all([
    db.supportTicket.findMany({ where, orderBy, ...getPaging(q), include: { user: { select: { id: true, name: true, role: true } }, _count: { select: { messages: true } } } }),
    db.supportTicket.count({ where }),
  ]);
  return paged(items, total, q);
}

// ───────────── Enquiries (public contact form) ─────────────

export const enquiryListSchema = paginationSchema.extend({ status: z.string().optional(), type: z.string().optional() });

export async function listEnquiries(q: z.infer<typeof enquiryListSchema>) {
  const where: Prisma.EnquiryWhereInput = {};
  if (q.status) where.status = { in: q.status.split(",") as EnquiryStatus[] };
  if (q.type) where.type = q.type as Prisma.EnquiryWhereInput["type"];
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { mobile: { contains: q.q } }, { subject: { contains: q.q, mode: "insensitive" } }];
  const orderBy = buildOrderBy(q.sort, q.order, ["createdAt", "status", "type"] as const, "createdAt");
  const [items, total] = await Promise.all([db.enquiry.findMany({ where, orderBy, ...getPaging(q) }), db.enquiry.count({ where })]);
  return paged(items, total, q);
}

export async function respondToEnquiry(id: string, response: string, status: EnquiryStatus, ctx: Ctx) {
  const enquiry = await db.enquiry.findUnique({ where: { id } });
  if (!enquiry) throw Errors.notFound("Enquiry");
  const updated = await db.enquiry.update({ where: { id }, data: { response, status, respondedById: ctx.user.id, respondedAt: new Date() } });
  if (response.trim()) {
    await notify({ email: enquiry.email, mobile: enquiry.mobile, event: "GENERIC", data: { title: `Reply to your enquiry${enquiry.subject ? `: ${enquiry.subject}` : ""}`, body: `Dear ${enquiry.name},\n\n${response}\n\nEduSkill India Foundation` } });
  }
  await audit({ user: ctx.user, action: "respond", module: "support", recordType: "Enquiry", recordId: id, description: `${ctx.user.name} responded to enquiry from ${enquiry.name}`, newValue: { status }, ip: ctx.ip, userAgent: ctx.userAgent });
  return updated;
}
