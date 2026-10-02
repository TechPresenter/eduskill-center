import { apiHandler } from "@/lib/api/handler";
import { getChallengeToken } from "@/lib/auth/challenge-cookie";
import { getAdminChallengeState } from "@/server/admin-auth";
import { noStore } from "../_lib/respond";

/**
 * The sign-in in progress in this browser, if any — so /login/admin can resume it after a reload or
 * after the password form handed over (`mfaRequired`). `{ state: null }` means start from the email.
 */
export const GET = apiHandler({ auth: "none", rateLimit: { limit: 60, windowSec: 5 * 60, name: "admin-challenge-state", failClosed: true } }, async () => {
  return noStore({ state: await getAdminChallengeState(await getChallengeToken()) });
});
