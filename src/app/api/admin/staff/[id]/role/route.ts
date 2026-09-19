import { apiHandler, parseBody } from "@/lib/api/handler";
import { setStaffRole, staffRoleSchema } from "@/server/staff";

export const PATCH = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], permission: "users.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, staffRoleSchema);
  return setStaffRole(params.id, body.roleId || null, { user: user!, ip, userAgent });
});
