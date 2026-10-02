import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { confirmLoginEmailChange } from "@/server/security";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

/** Super Admin: confirms the login email change with the code sent to the new address. */
export const POST = apiHandler(
  { roles: ["SUPER_ADMIN"], rateLimit: { limit: 10, windowSec: 15 * 60, keyBy: "user", name: "email-change-verify", failClosed: true } },
  async ({ req, user, ip, userAgent }) => {
    const body = await parseBody(req, schema);
    return confirmLoginEmailChange(body.code, { user: user!, ip, userAgent });
  }
);
