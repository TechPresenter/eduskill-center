import { apiHandler, parseBody } from "@/lib/api/handler";
import { createDonation, donationInputSchema } from "@/server/donations";

/** POST /api/public/donations → creates a PENDING donation and returns gateway checkout params or bank details. */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 10, windowSec: 600, name: "public-donations" } }, async ({ req }) => {
  const body = await parseBody(req, donationInputSchema);
  return createDonation(body);
});
