import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { setTicketStatus } from "@/server/support";

const schema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  /** Staff user id to assign; empty string clears; omit to keep. */
  assignedToId: z.union([z.literal(""), z.string().uuid()]).optional(),
});

export const POST = apiHandler<{ id: string }>({ permission: "support.respond" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  let assignedToId: string | null | undefined = undefined;
  if (body.assignedToId !== undefined) {
    if (body.assignedToId === "") assignedToId = null;
    else {
      const staff = await db.user.findFirst({ where: { id: body.assignedToId, role: { in: ["SUPER_ADMIN", "STAFF"] }, status: "ACTIVE", deletedAt: null }, select: { id: true } });
      if (!staff) throw Errors.validation("Please correct the highlighted fields.", { assignedToId: "Select an active staff member" });
      assignedToId = staff.id;
    }
  }
  return setTicketStatus(params.id, body.status, { user: user!, ip, userAgent }, assignedToId);
});
