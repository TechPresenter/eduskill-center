import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { setTrainerStatus } from "@/server/trainers";

const schema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export const POST = apiHandler<{ id: string }>({ permission: "trainers.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  await setTrainerStatus(params.id, body.status, { user: user!, ip, userAgent });
  return { status: body.status };
});
