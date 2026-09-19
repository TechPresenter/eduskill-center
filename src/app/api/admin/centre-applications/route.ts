import { apiHandler, parseQuery } from "@/lib/api/handler";
import { centreApplicationCounts, centreApplicationListSchema, listCentreApplications } from "@/server/centre-applications";

/** Paginated list of Shiksha Mission centre applications (same filters as the admin list page). */
export const GET = apiHandler({ permission: "centre_applications.view" }, async ({ req }) => {
  const q = parseQuery(req, centreApplicationListSchema);
  const [data, counts] = await Promise.all([listCentreApplications(q), centreApplicationCounts()]);
  return { ...data, counts };
});
