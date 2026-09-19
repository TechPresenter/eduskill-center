import { apiHandler } from "@/lib/api/handler";
import { markNotificationRead } from "@/server/notifications-user";

/** Marks one of the signed-in user's notifications as read. */
export const POST = apiHandler<{ id: string }>({ roles: ["SUPER_ADMIN", "STAFF"] }, async ({ params, user }) => {
  await markNotificationRead(user!.id, params.id);
  return { ok: true };
});
