import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { revokeSessionById } from "@/lib/auth/session";
import { deviceLabel } from "@/lib/auth/device";

const idSchema = z.string().uuid();

/** Signs one of the administrator's OWN other sessions out. The current session is refused (use Log out). */
export const DELETE = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN", "STAFF"] }, async ({ params, user, ip, userAgent }) => {
  const parsed = idSchema.safeParse(params.id);
  if (!parsed.success) throw Errors.notFound("Session");
  const id = parsed.data;
  if (id === user!.sessionId) throw Errors.badRequest("This is your current session. Use Log out instead.");
  const session = await db.session.findFirst({ where: { id, userId: user!.id, revokedAt: null }, select: { userAgent: true } });
  if (!session) throw Errors.notFound("Session");
  const revoked = await revokeSessionById(id, user!.id);
  if (revoked === 0) throw Errors.notFound("Session");
  await audit({ user: user!, action: "session_revoke", module: "auth", recordType: "Session", recordId: id, description: `${user!.name} signed out one of their devices (${deviceLabel(session.userAgent)})`, ip, userAgent });
  return { revoked };
});
