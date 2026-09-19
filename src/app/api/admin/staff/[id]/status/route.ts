import { apiHandler, parseBody } from "@/lib/api/handler";
import { setStaffStatus, staffStatusSchema } from "@/server/staff";

export const PATCH = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], permission: "users.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, staffStatusSchema);
  return setStaffStatus(params.id, body.status, { user: user!, ip, userAgent });
});
