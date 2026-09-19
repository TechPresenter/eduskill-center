import { apiHandler } from "@/lib/api/handler";
import { listTemplates } from "@/server/notifications-admin";

export const GET = apiHandler({ permission: ["notifications.view", "notifications.templates"] }, async () => listTemplates());
