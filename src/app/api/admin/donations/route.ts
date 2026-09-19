import { apiHandler, parseQuery } from "@/lib/api/handler";
import { donationListSchema, listDonations } from "@/server/donations-admin";

export const GET = apiHandler({ permission: "donations.view" }, async ({ req }) => listDonations(parseQuery(req, donationListSchema)));
