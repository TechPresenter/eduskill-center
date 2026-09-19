import { apiHandler, parseQuery } from "@/lib/api/handler";
import { awardListSchema, listAwards } from "@/server/scholarship-programs";

export const GET = apiHandler({ permission: "scholarships.view" }, async ({ req }) => {
  const q = parseQuery(req, awardListSchema);
  return listAwards(q);
});
