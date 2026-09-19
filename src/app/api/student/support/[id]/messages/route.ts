import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { addTicketMessage } from "@/server/support";

const schema = z.object({ message: z.string().trim().min(2, "Write a message").max(5000) });

/** POST /api/student/support/[id]/messages – reply on the student's own ticket. */
export const POST = apiHandler<{ id: string }>({ roles: ["STUDENT"], rateLimit: { limit: 60, windowSec: 3600, keyBy: "user", name: "support-reply" } }, async ({ req, params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Ticket");
  const body = await parseBody(req, schema);
  const msg = await addTicketMessage(params.id, { id: user!.id, name: user!.name, role: user!.role }, body.message, { userId: user!.id });
  return { id: msg.id, createdAt: msg.createdAt };
});
