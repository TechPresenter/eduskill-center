import { apiHandler, parseBody } from "@/lib/api/handler";
import { sendTestComposedEmail, testSchema } from "@/server/email";

/** Sends a "[TEST]" copy of the composed email to one address (default: the administrator's own). */
export const POST = apiHandler({ permission: "email.send", rateLimit: { limit: 20, windowSec: 600, keyBy: "user", name: "admin-email-test" } }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, testSchema);
  return sendTestComposedEmail(body, { user: user!, ip, userAgent });
});
