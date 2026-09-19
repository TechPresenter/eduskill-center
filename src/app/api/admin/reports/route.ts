import { apiHandler } from "@/lib/api/handler";
import { REPORT_TYPES } from "@/server/reports";

export const GET = apiHandler({ permission: "reports.view" }, async () => REPORT_TYPES);
