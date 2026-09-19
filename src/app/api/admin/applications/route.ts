import { apiHandler, parseQuery } from "@/lib/api/handler";
import { applicationListSchema, listApplications } from "@/server/applications";

/** Paginated applications with status / center / course / batch / location / payment / scholarship filters. */
export const GET = apiHandler({ permission: "applications.view" }, async ({ req }) => {
  const q = parseQuery(req, applicationListSchema);
  return listApplications(q);
});
