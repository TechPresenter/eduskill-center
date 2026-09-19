import { apiHandler, parseBody } from "@/lib/api/handler";
import { donationStatusSchema, setDonationStatus } from "@/server/donations-admin";

/** Manual gateway: mark a pending donation completed (adds to the campaign total) or failed. */
export const POST = apiHandler<{ id: string }>({ permission: "donations.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, donationStatusSchema);
  return setDonationStatus(params.id, body, { user: user!, ip, userAgent });
});
