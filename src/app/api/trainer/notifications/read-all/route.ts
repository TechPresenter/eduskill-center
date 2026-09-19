import { apiHandler } from "@/lib/api/handler";
import { markAllNotificationsRead } from "@/server/notifications-user";

/** POST /api/trainer/notifications/read-all */
export const POST = apiHandler({ roles: ["TRAINER"] }, async ({ user }) => {
  const count = await markAllNotificationsRead(user!.id);
  return { count };
});
