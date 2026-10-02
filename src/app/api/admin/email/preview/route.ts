import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { previewEmail } from "@/server/email";

const previewSchema = z.object({
  html: z.string().max(400_000, "The email is too long"),
  includeSignature: z.boolean().default(true),
  subject: z.string().trim().max(200).optional().default(""),
});

/** Renders exactly what would be sent: the server-sanitised body, the signature and the email layout. */
export const POST = apiHandler({ permission: "email.send", rateLimit: { limit: 120, windowSec: 600, keyBy: "user", name: "admin-email-preview" } }, async ({ req }) => {
  const body = await parseBody(req, previewSchema);
  return previewEmail(body);
});
