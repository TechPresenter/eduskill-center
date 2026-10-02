import { apiHandler } from "@/lib/api/handler";
import { revokeAdminSession } from "@/server/security";
import { MANAGE_RATE_LIMIT, routeId } from "@/app/api/admin/security/_shared";

/** Signs one administrator session out. The service refuses the caller's own session and higher tiers. */
export const DELETE = apiHandler<{ id: string }>({ permission: "security.manage", rateLimit: MANAGE_RATE_LIMIT }, async ({ params, user, ip, userAgent }) => {
  await revokeAdminSession(routeId(params.id, "Session"), { user: user!, ip, userAgent });
  return { revoked: true };
});
