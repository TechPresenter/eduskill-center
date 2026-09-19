import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { sendTestEmail } from "@/lib/notifications";

const schema = z.object({ to: z.email("Enter a valid email address") });

export const POST = apiHandler({ permission: "settings.update", rateLimit: { limit: 10, windowSec: 600, keyBy: "user", name: "test-email" } }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  try {
    await sendTestEmail(body.to);
  } catch (err) {
    throw Errors.badRequest(`Email could not be sent: ${err instanceof Error ? err.message : "unknown error"}`);
  }
  await audit({ user: user!, action: "test_email", module: "settings", recordType: "Setting", recordId: "comms", description: `${user!.name} sent a test email to ${body.to}`, ip, userAgent });
  return { sent: true, to: body.to };
});
