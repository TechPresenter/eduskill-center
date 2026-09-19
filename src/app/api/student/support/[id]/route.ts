import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { getTicket } from "@/server/support";

/** GET /api/student/support/[id] – one of the student's tickets with its message thread. */
export const GET = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Ticket");
  return getTicket(params.id, { userId: user!.id });
});
