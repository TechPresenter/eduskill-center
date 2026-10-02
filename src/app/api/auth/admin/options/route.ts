import { apiHandler } from "@/lib/api/handler";
import { adminLoginOptions } from "@/server/admin-auth";
import { noStore } from "../_lib/respond";

/** What Secure Admin Login can offer right now (email codes / password). Says nothing about any account. */
export const GET = apiHandler({ auth: "none", rateLimit: { limit: 60, windowSec: 5 * 60, name: "admin-login-options", failClosed: true } }, async () => {
  return noStore(await adminLoginOptions());
});
