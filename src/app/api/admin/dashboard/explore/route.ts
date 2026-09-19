import { apiHandler, parseQuery } from "@/lib/api/handler";
import { exploreHierarchy, exploreQuerySchema } from "@/server/dashboard";

export const GET = apiHandler({ permission: "dashboard.view" }, async ({ req }) => exploreHierarchy(parseQuery(req, exploreQuerySchema)));
