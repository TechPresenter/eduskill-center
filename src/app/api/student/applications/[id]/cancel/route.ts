import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { studentCancelApplication } from "@/server/applications";

const schema = z.object({ reason: z.string().trim().max(500).optional().nullable() });

/** POST /api/student/applications/[id]/cancel – student withdraws an application that is not yet approved. */
export const POST = apiHandler<{ id: string }>({ roles: ["STUDENT"] }, async ({ req, params, user }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Application");
  const body = await parseBody(req, schema);
  await studentCancelApplication(params.id, user!.student!.id, body.reason || undefined);
  return { id: params.id, status: "CANCELLED" };
});
