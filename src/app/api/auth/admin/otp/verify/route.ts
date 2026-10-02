import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { getChallengeToken } from "@/lib/auth/challenge-cookie";
import { verifyAdminEmailOtp } from "@/server/admin-auth";
import { noStore, requestMeta, startSession } from "../../_lib/respond";

const schema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

/**
 * Step 2: the emailed code. Next comes the authenticator, first-time authenticator set-up, or —
 * when neither is needed — the session itself.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 20, windowSec: 15 * 60, name: "admin-otp-verify", failClosed: true } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const r = await verifyAdminEmailOtp(await getChallengeToken(), body.code, await requestMeta(ip, userAgent));
  if (r.step === "done") {
    await startSession(r.session);
    return noStore({ step: "done" as const, redirect: r.session.redirect });
  }
  return noStore({ step: r.step, state: r.state });
});
