import { apiHandler, parseBody } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { donationVerifySchema, verifyDonationPayment } from "@/server/donations";

/** POST /api/public/donations/[id]/verify → verifies the Razorpay checkout signature and completes the donation. */
export const POST = apiHandler<{ id: string }>({ auth: "none", rateLimit: { limit: 20, windowSec: 600, name: "public-donations-verify" } }, async ({ req, params }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Donation");
  const body = await parseBody(req, donationVerifySchema);
  return verifyDonationPayment(params.id, body);
});
