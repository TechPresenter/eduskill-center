import { apiHandler, parseBody } from "@/lib/api/handler";
import { campaignSchema, deleteCampaign, updateCampaign } from "@/server/donations-admin";

export const PUT = apiHandler<{ id: string }>({ permission: "donations.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, campaignSchema);
  return updateCampaign(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ permission: "donations.update" }, async ({ params, user, ip, userAgent }) => {
  await deleteCampaign(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
