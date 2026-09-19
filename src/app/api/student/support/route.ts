import { apiHandler, parseBody } from "@/lib/api/handler";
import { createTicket, createTicketSchema, listUserTickets } from "@/server/support";

/** GET /api/student/support – the student's tickets. */
export const GET = apiHandler({ roles: ["STUDENT"] }, async ({ user }) => {
  return { items: await listUserTickets(user!.id) };
});

/** POST /api/student/support – open a new support ticket. */
export const POST = apiHandler({ roles: ["STUDENT"], rateLimit: { limit: 20, windowSec: 3600, keyBy: "user", name: "support-ticket" } }, async ({ req, user }) => {
  const body = await parseBody(req, createTicketSchema);
  const ticket = await createTicket(user!.id, body);
  return { id: ticket.id, ticketNo: ticket.ticketNo, status: ticket.status };
});
