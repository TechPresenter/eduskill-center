import { apiHandler } from "@/lib/api/handler";
import { getChallengeToken } from "@/lib/auth/challenge-cookie";
import { resendAdminEmailOtp } from "@/server/admin-auth";
import { noStore, requestMeta } from "../../_lib/respond";

/** Emails a fresh code for the sign-in in progress in THIS browser (the challenge cookie). Earlier codes stop working. */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 15, windowSec: 15 * 60, name: "admin-otp-resend", failClosed: true } }, async ({ ip, userAgent }) => {
  const r = await resendAdminEmailOtp(await getChallengeToken(), await requestMeta(ip, userAgent));
  return noStore({ message: r.message, state: r.state });
});
