import { apiHandler } from "@/lib/api/handler";
import { getAuditLog } from "@/app/admin/audit-logs/queries";

export const GET = apiHandler<{ id: string }>({ permission: "audit_logs.view" }, async ({ params }) => getAuditLog(params.id));
