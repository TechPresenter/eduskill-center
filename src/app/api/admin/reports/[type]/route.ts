import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { Errors } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { hasPermission } from "@/lib/rbac/permissions";
import { describeFilters, reportDef, reportFilterSchema, reportToCsv, reportToPdf, reportToXlsx, runReport } from "@/server/reports";

const querySchema = reportFilterSchema.extend({
  format: z.enum(["json", "csv", "xlsx", "pdf"]).default("json"),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

/**
 * GET /api/admin/reports/[type]?format=json|csv|xlsx|pdf&…filters
 * JSON needs reports.view; file downloads need reports.export.
 */
export const GET = apiHandler<{ type: string }>({ permission: ["reports.view", "reports.export"] }, async ({ req, params, user, ip, userAgent }) => {
  const def = reportDef(params.type);
  if (!def) throw Errors.notFound("Report");
  const q = parseQuery(req, querySchema);
  if (q.format === "json") {
    if (!hasPermission(user, "reports.view")) throw Errors.forbidden();
    return runReport(def.key, q, { limit: q.limit ?? 100 });
  }
  if (!hasPermission(user, "reports.export")) throw Errors.forbidden("You do not have permission to export reports");
  const [result, orgName, filtersLabel] = await Promise.all([runReport(def.key, q), getSetting<string>("branding.siteName"), describeFilters(q)]);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `eduskill-${def.key}-report-${stamp}`;
  await audit({ user: user!, action: "export", module: "reports", recordType: "Report", recordId: def.key, description: `${user!.name} exported ${def.label} as ${q.format.toUpperCase()} (${result.rows.length} rows)`, newValue: { format: q.format, rows: result.rows.length, filters: filtersLabel }, ip, userAgent });
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (q.format === "csv") {
    headers["Content-Type"] = "text/csv; charset=utf-8";
    headers["Content-Disposition"] = `attachment; filename="${base}.csv"`;
    return new Response(reportToCsv(result), { headers });
  }
  if (q.format === "xlsx") {
    const buf = await reportToXlsx(result, { orgName, filtersLabel });
    headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    headers["Content-Disposition"] = `attachment; filename="${base}.xlsx"`;
    headers["Content-Length"] = String(buf.length);
    return new Response(new Uint8Array(buf), { headers });
  }
  const pdf = await reportToPdf(result, { orgName, filtersLabel });
  headers["Content-Type"] = "application/pdf";
  headers["Content-Disposition"] = `attachment; filename="${base}.pdf"`;
  headers["Content-Length"] = String(pdf.byteLength);
  return new Response(new Uint8Array(pdf), { headers });
});
