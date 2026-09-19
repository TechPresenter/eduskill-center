import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { addTicketMessage } from "@/server/support";

const schema = z.object({ message: z.string().trim().min(2, "Write a reply").max(5000) });

/** Staff reply on a ticket (notifies the ticket owner). */
export const POST = apiHandler<{ id: string }>({ permission: "support.respond" }, async ({ req, params, user }) => {
  const body = await parseBody(req, schema);
  return addTicketMessage(params.id, { id: user!.id, name: user!.name, role: user!.role }, body.message);
});
