import { apiHandler } from "@/lib/api/handler";
import { resetTwoFactorFor } from "@/server/two-factor";
import { MANAGE_RATE_LIMIT, routeId } from "@/app/api/admin/security/_shared";

/** Super Admin: removes another administrator's authenticator and backup codes, and signs them out everywhere. */
export const POST = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], rateLimit: MANAGE_RATE_LIMIT }, async ({ params, user, ip, userAgent }) =>
  resetTwoFactorFor(routeId(params.id, "Administrator"), { user: user!, ip, userAgent })
);
