import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { disableTwoFactor } from "@/server/two-factor";

const schema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app").optional(),
    backupCode: z.string().trim().min(8, "Enter a backup code like ABCD-EFGH").max(16, "Enter a backup code like ABCD-EFGH").optional(),
  })
  .refine((b) => !!b.code !== !!b.backupCode, { message: "Enter a code from your authenticator app or one backup code", path: ["code"] });

/** Turns two-factor authentication off — needs a current authenticator or backup code; refused while it is required. */
export const POST = apiHandler(
  { roles: ["SUPER_ADMIN", "STAFF"], rateLimit: { limit: 10, windowSec: 15 * 60, keyBy: "user", name: "2fa-disable", failClosed: true } },
  async ({ req, user, ip, userAgent }) => {
    const body = await parseBody(req, schema);
    await disableTwoFactor(body.code ? { code: body.code } : { backupCode: body.backupCode }, { user: user!, ip, userAgent });
    return { disabled: true };
  }
);
