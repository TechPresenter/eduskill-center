import { apiHandler, parseBody } from "@/lib/api/handler";
import { sendComposedEmail, sendSchema } from "@/server/email";

/**
 * Sends the composed email through the configured SMTP account. More than the bulk threshold of
 * recipients needs `confirmBulk: true` (422 otherwise). A delivery failure is recorded and returned
 * as a FAILED message rather than thrown, so the composer can show the server's error.
 */
export const POST = apiHandler({ permission: "email.send", rateLimit: { limit: 30, windowSec: 600, keyBy: "user", name: "admin-email-send" } }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, sendSchema);
  return sendComposedEmail(body, { user: user!, ip, userAgent });
});
