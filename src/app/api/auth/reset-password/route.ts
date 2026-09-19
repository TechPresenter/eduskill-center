import { apiHandler, parseBody } from "@/lib/api/handler";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/server/auth";

export const POST = apiHandler({ auth: "none", rateLimit: { limit: 10, windowSec: 15 * 60, name: "reset" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, resetPasswordSchema);
  await resetPassword(body.token, body.password, { ip, userAgent });
  return { message: "Password updated. You can now log in." };
});
