import { apiHandler, parseBody } from "@/lib/api/handler";
import { loginOtpRequestSchema } from "@/lib/validation/auth";
import { requestLoginOtp } from "@/server/login-otp";

/**
 * Step 1 of admission-number sign-in. Always answers with the same neutral message whether or not
 * the details matched (see src/server/login-otp.ts). The per-IP limit is deliberately looser than
 * the per-mobile one inside the service: a whole class at a training centre often shares one IP.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 30, windowSec: 60 * 60, name: "login-otp-request" } }, async ({ req, ip, userAgent }) => {
  const body = await parseBody(req, loginOtpRequestSchema);
  return requestLoginOtp({ ...body, ip, userAgent });
});
