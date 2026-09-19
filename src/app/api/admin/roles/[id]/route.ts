import { apiHandler, parseBody } from "@/lib/api/handler";
import { deleteRole, getRole, roleInputSchema, updateRole } from "@/server/roles";

export const GET = apiHandler<{ id: string }>({ permission: "roles.view" }, async ({ params }) => getRole(params.id));

export const PUT = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], permission: "roles.update" }, async ({ req, params, user, ip, userAgent }) => {
  const body = await parseBody(req, roleInputSchema);
  return updateRole(params.id, body, { user: user!, ip, userAgent });
});

export const DELETE = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN"], permission: "roles.delete" }, async ({ params, user, ip, userAgent }) => {
  await deleteRole(params.id, { user: user!, ip, userAgent });
  return { deleted: true };
});
