import { apiHandler } from "@/lib/api/handler";
import { clearChallengeCookie, getChallengeToken } from "@/lib/auth/challenge-cookie";
import { cancelAdminChallenge } from "@/server/admin-auth";
import { noStore } from "../_lib/respond";

/** "Change email" / "Cancel sign-in": ends the sign-in in progress in this browser. Its codes stop working. */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 30, windowSec: 15 * 60, name: "admin-login-cancel", failClosed: true } }, async () => {
  await cancelAdminChallenge(await getChallengeToken());
  await clearChallengeCookie();
  return noStore({ cancelled: true });
});
