import { apiHandler, parseBody } from "@/lib/api/handler";
import { createRole, listRoles, roleInputSchema } from "@/server/roles";

export const GET = apiHandler({ permission: "roles.view" }, async () => listRoles());

export const POST = apiHandler({ roles: ["SUPER_ADMIN"], permission: "roles.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, roleInputSchema);
  return createRole(body, { user: user!, ip, userAgent });
});
