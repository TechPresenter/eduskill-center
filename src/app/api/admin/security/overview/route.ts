import { apiHandler } from "@/lib/api/handler";
import { securityOverview } from "@/server/security";

export const GET = apiHandler({ permission: "security.view" }, async ({ user }) => securityOverview(user!));
