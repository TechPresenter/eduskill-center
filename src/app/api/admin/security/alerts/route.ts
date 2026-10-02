import { apiHandler, parseQuery } from "@/lib/api/handler";
import { alertsQuery, listSecurityAlerts } from "@/server/security";

export const GET = apiHandler({ permission: "security.view" }, async ({ req, user }) => listSecurityAlerts(user!, parseQuery(req, alertsQuery)));
