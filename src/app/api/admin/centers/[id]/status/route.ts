import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { setCenterStatus } from "@/server/centers";

const schema = z.object({ status: z.enum(["PENDING", "ACTIVE", "INACTIVE"]) });

export const PATCH = apiHandler<{ id: string }>({ permission: "centers.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return setCenterStatus(params.id, body.status, { user: user!, ip, userAgent });
});
