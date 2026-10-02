import { apiHandler } from "@/lib/api/handler";
import { unlockAdministrator } from "@/server/security";
import { MANAGE_RATE_LIMIT, routeId } from "@/app/api/admin/security/_shared";

/** Clears the password and second-factor lockouts of an administrator. */
export const POST = apiHandler<{ id: string }>({ permission: "security.manage", rateLimit: MANAGE_RATE_LIMIT }, async ({ params, user, ip, userAgent }) => {
  await unlockAdministrator(routeId(params.id, "Administrator"), { user: user!, ip, userAgent });
  return { unlocked: true };
});
