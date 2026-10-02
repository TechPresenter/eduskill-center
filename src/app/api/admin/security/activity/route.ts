import { apiHandler, parseQuery } from "@/lib/api/handler";
import { activityQuery, listLoginActivity } from "@/server/security";

export const GET = apiHandler({ permission: "security.view" }, async ({ req, user }) => listLoginActivity(user!, parseQuery(req, activityQuery)));
