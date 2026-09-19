import { apiHandler, parseBody } from "@/lib/api/handler";
import { resetStaffPassword, staffResetPasswordSchema } from "@/server/staff";

/** Sets a new temporary password (returned once) and revokes every session of the staff member. */
export const POST = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], permission: "users.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, staffResetPasswordSchema);
  return resetStaffPassword(params.id, body.password || null, { user: user!, ip, userAgent });
});
