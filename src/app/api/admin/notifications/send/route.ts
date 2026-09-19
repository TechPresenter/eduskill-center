import { apiHandler, parseBody } from "@/lib/api/handler";
import { enabledChannels, sendDirectMessage, sendMessageSchema } from "@/server/notifications-admin";

/** Channels currently enabled for outbound messages. */
export const GET = apiHandler({ permission: "notifications.send" }, async () => enabledChannels());

export const POST = apiHandler({ permission: "notifications.send" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, sendMessageSchema);
  return sendDirectMessage(body, { user: user!, ip, userAgent });
});
