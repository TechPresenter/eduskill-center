import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { verifyCenter } from "@/server/centers";

const schema = z.object({ verified: z.coerce.boolean() });

export const PATCH = apiHandler<{ id: string }>({ permission: "centers.verify" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return verifyCenter(params.id, body.verified, { user: user!, ip, userAgent });
});
