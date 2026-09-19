import { apiHandler, parseQuery } from "@/lib/api/handler";
import { dashboardQuerySchema, getDashboard } from "@/server/dashboard";

export const GET = apiHandler({ permission: "dashboard.view" }, async ({ req }) => getDashboard(parseQuery(req, dashboardQuerySchema)));
