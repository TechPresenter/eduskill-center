import { apiHandler } from "@/lib/api/handler";
import { markAllNotificationsRead } from "@/server/notifications-user";

/** POST /api/student/notifications/read-all */
export const POST = apiHandler({ roles: ["STUDENT"] }, async ({ user }) => {
  const count = await markAllNotificationsRead(user!.id);
  return { marked: count };
});
