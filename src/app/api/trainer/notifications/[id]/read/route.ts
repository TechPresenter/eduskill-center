import { apiHandler } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { isUuid } from "@/lib/utils";
import { markNotificationRead } from "@/server/notifications-user";

/** POST /api/trainer/notifications/[id]/read */
export const POST = apiHandler<{ id: string }>({ roles: ["TRAINER"] }, async ({ user, params }) => {
  if (!isUuid(params.id)) throw Errors.notFound("Notification");
  await markNotificationRead(user!.id, params.id);
  return { read: true };
});
