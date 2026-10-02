import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { getChallengeToken } from "@/lib/auth/challenge-cookie";
import { verifyAdminSecondFactor } from "@/server/admin-auth";
import { noStore, requestMeta, startSession } from "../../_lib/respond";

const schema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app").optional(),
    backupCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{4}[\s-]?[A-Za-z0-9]{4}$/, "Enter a backup code like ABCD-EFGH")
      .optional(),
  })
  .refine((b) => Number(!!b.code) + Number(!!b.backupCode) === 1, {
    message: "Enter either an authenticator code or a backup code",
    path: ["code"],
  });

/**
 * Step 3: the authenticator code — or one single-use backup code — for an administrator with
 * two-factor authentication on. Wrong codes count per account with an escalating cooldown (429).
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 20, windowSec: 15 * 60, name: "admin-2fa-verify", failClosed: true } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const r = await verifyAdminSecondFactor(await getChallengeToken(), body.code ? { code: body.code } : { backupCode: body.backupCode }, await requestMeta(ip, userAgent));
  if (r.step !== "done") return noStore({ step: r.step, state: r.state });
  await startSession(r.session);
  return noStore({ step: "done" as const, redirect: r.session.redirect });
});
