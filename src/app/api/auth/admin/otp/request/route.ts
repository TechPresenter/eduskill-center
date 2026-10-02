import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { getChallengeToken, setChallengeCookie } from "@/lib/auth/challenge-cookie";
import { cancelAdminChallenge, startAdminEmailOtp } from "@/server/admin-auth";
import { noStore, requestMeta } from "../../_lib/respond";

const schema = z.object({
  email: z.string().trim().max(190, "Enter a valid email address").pipe(z.email("Enter a valid email address")),
  next: z.string().max(500).optional(),
});

/**
 * Step 1 of Secure Admin Login: email a 6-digit code.
 *
 * The answer is the same for every address — administrator or not, over quota or not — and nothing
 * in it (message, stage, cooldown) differs. A sign-in already in progress in this browser is ended
 * first, so only the newest challenge's code can ever work.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 10, windowSec: 15 * 60, name: "admin-otp-request", failClosed: true } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, schema);
  const meta = await requestMeta(ip, userAgent);
  await cancelAdminChallenge(await getChallengeToken());
  const r = await startAdminEmailOtp({ email: body.email, next: body.next, ...meta });
  await setChallengeCookie(r.challengeToken, r.expiresAt);
  return noStore({ message: r.message, state: r.state });
});
