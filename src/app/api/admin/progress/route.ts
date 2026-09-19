import { apiHandler, parseQuery } from "@/lib/api/handler";
import { admissionListSchema, listAdmissions } from "@/server/admissions";

/** Admissions with their progress metrics (same filters as admissions plus eligible / completed). */
export const GET = apiHandler({ permission: "progress.view" }, async ({ req }) => {
  const q = parseQuery(req, admissionListSchema);
  return listAdmissions(q);
});
