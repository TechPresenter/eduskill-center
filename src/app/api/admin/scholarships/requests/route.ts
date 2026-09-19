import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listPendingScholarshipRequests, pendingRequestSchema } from "@/server/scholarship-programs";

/** Applications that requested a scholarship and have no decision yet. */
export const GET = apiHandler({ permission: "scholarships.view" }, async ({ req }) => {
  const q = parseQuery(req, pendingRequestSchema);
  return listPendingScholarshipRequests(q);
});
