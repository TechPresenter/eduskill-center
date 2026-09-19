import { apiHandler } from "@/lib/api/handler";
import { listImpactStats } from "@/app/admin/settings/lib";

export const GET = apiHandler({ permission: "settings.view" }, async () => listImpactStats());
