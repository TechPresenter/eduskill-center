import { apiHandler, parseBody } from "@/lib/api/handler";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword } from "@/server/auth";

export const POST = apiHandler({ rateLimit: { limit: 10, windowSec: 15 * 60, keyBy: "user", name: "change-password" } }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, changePasswordSchema);
  await changePassword(user!.id, body.currentPassword, body.newPassword, user!.sessionId, { ip, userAgent });
  return { message: "Password changed successfully." };
});
