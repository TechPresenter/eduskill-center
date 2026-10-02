import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { setAdministratorStatus } from "@/server/security";
import { MANAGE_RATE_LIMIT, routeId } from "@/app/api/admin/security/_shared";

const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

/** Super Admin: disable (SUSPENDED, every session ends) or re-enable (ACTIVE) an administrator account. */
export const POST = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], rateLimit: MANAGE_RATE_LIMIT }, async ({ req, params, user, ip, userAgent }) => {
  const id = routeId(params.id, "Administrator");
  const body = await parseBody(req, statusSchema);
  return setAdministratorStatus(id, body.status, { user: user!, ip, userAgent });
});
