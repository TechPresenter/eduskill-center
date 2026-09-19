import { apiHandler } from "@/lib/api/handler";
import { deleteAnnouncement, publishAnnouncement } from "@/server/notifications-admin";

/** Publishes a saved draft announcement (pushes IN_APP notifications). */
export const POST = apiHandler<{ id: string }>({ permission: "notifications.send" }, async ({ params, user, ip, userAgent }) => publishAnnouncement(params.id, { user: user!, ip, userAgent }));

export const DELETE = apiHandler<{ id: string }>({ permission: "notifications.send" }, async ({ params, user, ip, userAgent }) => {
  await deleteAnnouncement(params.id, { user: user!, ip, userAgent });
  return { ok: true };
});
