import { apiHandler, parseBody } from "@/lib/api/handler";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/server/auth";

export const POST = apiHandler({ auth: "none", rateLimit: { limit: 5, windowSec: 15 * 60, name: "forgot" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, forgotPasswordSchema);
  await requestPasswordReset(body.identifier, { ip, userAgent });
  return { message: "If an account exists, password reset instructions have been sent." };
});
