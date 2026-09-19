import { apiHandler, parseQuery } from "@/lib/api/handler";
import { enquiryListSchema, listEnquiries } from "@/server/support";

export const GET = apiHandler({ permission: "support.view" }, async ({ req }) => listEnquiries(parseQuery(req, enquiryListSchema)));
