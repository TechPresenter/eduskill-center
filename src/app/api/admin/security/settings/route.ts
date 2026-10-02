import { apiHandler, parseBody } from "@/lib/api/handler";
import { getSecuritySettings, securitySettingsSchema, updateSecuritySettings } from "@/server/security";
import { MANAGE_RATE_LIMIT } from "@/app/api/admin/security/_shared";

/** Super Admin only: the 2FA requirement, the alert mailbox and new-device emails (plus the read-only .env policy). */
export const GET = apiHandler({ roles: ["SUPER_ADMIN"] }, async () => getSecuritySettings());

export const PUT = apiHandler({ roles: ["SUPER_ADMIN"], rateLimit: MANAGE_RATE_LIMIT }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, securitySettingsSchema);
  return updateSecuritySettings(body, { user: user!, ip, userAgent });
});
