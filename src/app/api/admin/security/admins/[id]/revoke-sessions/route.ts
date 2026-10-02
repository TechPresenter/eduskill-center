import { apiHandler } from "@/lib/api/handler";
import { revokeAllAdminSessions } from "@/server/security";
import { MANAGE_RATE_LIMIT, routeId } from "@/app/api/admin/security/_shared";

/** Signs an administrator out of every device (your own: every device but this one). */
export const POST = apiHandler<{ id: string }>({ permission: "security.manage", rateLimit: MANAGE_RATE_LIMIT }, async ({ params, user, ip, userAgent }) =>
  revokeAllAdminSessions(routeId(params.id, "Administrator"), { user: user!, ip, userAgent })
);
