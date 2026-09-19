import { apiHandler, parseQuery } from "@/lib/api/handler";
import { listSentLog, sentLogSchema } from "@/server/notifications-admin";

export const GET = apiHandler({ permission: "notifications.view" }, async ({ req }) => listSentLog(parseQuery(req, sentLogSchema)));
