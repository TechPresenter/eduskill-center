import { apiHandler, parseBody } from "@/lib/api/handler";
import { setStaffPermissions, staffPermissionsSchema } from "@/server/staff";

/** Replace-all direct permission grants. Super Admin only; "*" can never be granted. */
export const PUT = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], permission: "users.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, staffPermissionsSchema);
  return { permissions: await setStaffPermissions(params.id, body.permissions, { user: user!, ip, userAgent }) };
});
