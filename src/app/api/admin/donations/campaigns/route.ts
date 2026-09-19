import { apiHandler, parseBody } from "@/lib/api/handler";
import { campaignSchema, createCampaign, listCampaigns } from "@/server/donations-admin";

export const GET = apiHandler({ permission: "donations.view" }, async () => listCampaigns());

export const POST = apiHandler({ permission: "donations.update" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, campaignSchema);
  return createCampaign(body, { user: user!, ip, userAgent });
});
