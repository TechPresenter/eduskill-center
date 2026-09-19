import { apiHandler, parseQuery } from "@/lib/api/handler";
import { auditListSchema, listAuditLogs } from "@/app/admin/audit-logs/queries";

export const GET = apiHandler({ permission: "audit_logs.view" }, async ({ req }) => listAuditLogs(parseQuery(req, auditListSchema)));
