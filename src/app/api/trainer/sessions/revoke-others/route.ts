import { apiHandler } from "@/lib/api/handler";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/** POST /api/trainer/sessions/revoke-others → logs out every other device. */
export const POST = apiHandler({ roles: ["TRAINER"] }, async ({ user, ip, userAgent }) => {
  const r = await db.session.updateMany({ where: { userId: user!.id, revokedAt: null, id: { not: user!.sessionId } }, data: { revokedAt: new Date() } });
  await audit({ user: { id: user!.id, name: user!.name, role: user!.role }, action: "revoke_sessions", module: "auth", recordType: "User", recordId: user!.id, description: `${user!.name} logged out ${r.count} other device(s)`, ip, userAgent });
  return { revoked: r.count };
});
