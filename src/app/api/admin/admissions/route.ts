import { apiHandler, parseQuery } from "@/lib/api/handler";
import { admissionListSchema, listAdmissions } from "@/server/admissions";

export const GET = apiHandler({ permission: "admissions.view" }, async ({ req }) => {
  const q = parseQuery(req, admissionListSchema);
  return listAdmissions(q);
});
