import { apiHandler } from "@/lib/api/handler";
import { listAdministrators } from "@/server/security";

export const GET = apiHandler({ permission: "security.view" }, async ({ user }) => listAdministrators(user!));
