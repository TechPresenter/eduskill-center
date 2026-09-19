import { apiHandler, parseQuery } from "@/lib/api/handler";
import { centerSearchSchema } from "@/lib/validation/centers";
import { searchCenters } from "@/server/centers";

/** GET /api/public/centers?stateId=&districtId=&blockId=&courseId=&q=&pincode=&page=&limit= → paged active centers. */
export const GET = apiHandler({ auth: "none", csrf: false, rateLimit: { limit: 60, windowSec: 60, name: "public-centers" } }, async ({ req }) => {
  const q = parseQuery(req, centerSearchSchema);
  return searchCenters(q);
});
