import { apiHandler } from "@/lib/api/handler";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/** Logs the current admin out of every other device (keeps this session). */
export const POST = apiHandler({ roles: ["SUPER_ADMIN", "STAFF"] }, async ({ user, ip, userAgent }) => {
  const res = await db.session.updateMany({ where: { userId: user!.id, revokedAt: null, id: { not: user!.sessionId } }, data: { revokedAt: new Date() } });
  await audit({ user: user!, action: "revoke_sessions", module: "auth", recordType: "User", recordId: user!.id, description: `${user!.name} logged out of ${res.count} other device(s)`, ip, userAgent });
  return { revoked: res.count };
});
