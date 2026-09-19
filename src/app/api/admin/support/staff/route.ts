import { db } from "@/lib/db";
import { apiHandler } from "@/lib/api/handler";

/** Active staff + super admins for ticket assignment. */
export const GET = apiHandler({ permission: "support.view" }, async () => {
  const users = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "STAFF"] }, status: "ACTIVE", deletedAt: null, OR: [{ role: "SUPER_ADMIN" }, { staff: { deletedAt: null } }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, staff: { select: { designation: true, role: { select: { name: true } } } } },
  });
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role === "SUPER_ADMIN" ? "Super Admin" : (u.staff?.role?.name ?? u.staff?.designation ?? "Staff") }));
});
