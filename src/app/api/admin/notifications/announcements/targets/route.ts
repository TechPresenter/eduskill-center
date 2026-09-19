import { apiHandler } from "@/lib/api/handler";
import { announcementTargets } from "@/server/notifications-admin";

/** Centers and open batches for announcement targeting. */
export const GET = apiHandler({ permission: "notifications.view" }, async () => announcementTargets());
