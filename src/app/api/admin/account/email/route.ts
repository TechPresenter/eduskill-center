import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { requestLoginEmailChange } from "@/server/security";

const schema = z.object({ email: z.string().trim().min(3, "Enter the new email address").max(190, "This email address is too long") });

/** Super Admin: emails a 6-digit code to the NEW login address (the service limits requests per hour). */
export const POST = apiHandler({ roles: ["SUPER_ADMIN"] }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  return requestLoginEmailChange(body.email, { user: user!, ip, userAgent });
});
