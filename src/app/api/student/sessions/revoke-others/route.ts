import { apiHandler } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { revokeOtherSessions } from "@/server/student-portal";

/** POST /api/student/sessions/revoke-others – log out every other device (keeps the current session). */
export const POST = apiHandler({ roles: ["STUDENT"] }, async ({ user, ip, userAgent }) => {
  const result = await revokeOtherSessions(user!.id, user!.sessionId);
  await audit({ user: { id: user!.id, name: user!.name, role: user!.role }, action: "revoke_sessions", module: "auth", recordType: "User", recordId: user!.id, description: `${user!.name} logged out ${result.revoked} other device(s)`, ip, userAgent });
  return result;
});
