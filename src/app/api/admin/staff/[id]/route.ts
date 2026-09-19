import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteStaff, getStaff, staffUpdateSchema, updateStaff } from "@/server/staff";

export const GET = apiHandler<{ id: string }>({ permission: "users.view" }, async ({ params }) => getStaff(params.id));

export const PUT = apiHandler<{ id: string }>({ permission: "users.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, staffUpdateSchema);
  return updateStaff(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], permission: "users.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteStaff(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
