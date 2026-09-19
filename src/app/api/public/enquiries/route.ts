import { apiHandler, parseBody } from "@/lib/api/handler";
import { createEnquiry, enquiryInputSchema } from "@/server/enquiries";

/** POST /api/public/enquiries → stores a contact-form enquiry (rate limited: 5 per 10 minutes per IP). */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 5, windowSec: 600, name: "public-enquiries" } }, async ({ req, ip }) => {
  const body = await parseBody(req, enquiryInputSchema);
  const result = await createEnquiry(body, { ip });
  return { received: true, id: result.id };
});
