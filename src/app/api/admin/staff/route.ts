import { apiHandler, parseBody, parseQuery } from "@/lib/api/handler";
import { createStaff, listStaff, staffCreateSchema, staffListSchema } from "@/server/staff";

export const GET = apiHandler({ permission: "users.view" }, async ({ req }) => listStaff(parseQuery(req, staffListSchema)));

/** Only the Super Admin can create staff accounts. */
export const POST = apiHandler({ roles: ["SUPER_ADMIN"], permission: "users.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, staffCreateSchema);
  return createStaff(body, { user: user!, ip, userAgent });
});
