import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listAdminSessions, sessionsQuery } from "@/server/security";

export const GET = apiHandler({ permission: "security.view" }, async ({ req, user }) => listAdminSessions(user!, parseQuery(req, sessionsQuery)));
