import { apiHandler, parseQuery } from "@/lib/api/handler";
import { centerSearchSchema } from "@/lib/validation/centers";
import { searchCenters } from "@/server/centers";

/** GET /api/student/centers – active training centers for the apply wizard (same filters as the public search). */
export const GET = apiHandler({ roles: ["STUDENT"] }, async ({ req }) => {
  const q = parseQuery(req, centerSearchSchema);
  return searchCenters(q);
});
