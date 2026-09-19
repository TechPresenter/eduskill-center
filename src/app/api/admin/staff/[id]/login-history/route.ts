import { apiHandler, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/query";
import { getStaff, staffLoginHistory } from "@/server/staff";

export const GET = apiHandler<{ id: string }>({ permission: "users.view" }, async ({ req, params }) => {
  const staff = await getStaff(params.id);
  const q = parseQuery(req, paginationSchema);
  return staffLoginHistory(staff.userId, q);
});
