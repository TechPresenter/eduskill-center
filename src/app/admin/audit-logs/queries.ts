import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { Errors } from "@/lib/api/errors";
import { paginationSchema, getPaging, paged, optionalUuid, dateRangeSchema, resolveDateRange } from "@/lib/api/query";

export const auditListSchema = paginationSchema.extend(dateRangeSchema.shape).extend({
  module: z.string().trim().max(60).optional(),
  action: z.string().trim().max(60).optional(),
  userId: optionalUuid,
  recordType: z.string().trim().max(60).optional(),
  recordId: z.string().trim().max(120).optional(),
});
export type AuditListQuery = z.infer<typeof auditListSchema>;

export async function listAuditLogs(q: AuditListQuery) {
  const where: Prisma.AuditLogWhereInput = {};
  if (q.module) where.module = q.module;
  if (q.action) where.action = q.action;
  if (q.userId) where.userId = q.userId;
  if (q.recordType) where.recordType = q.recordType;
  if (q.recordId) where.recordId = q.recordId;
  const range = resolveDateRange(q);
  if (range.from || range.to) where.createdAt = { gte: range.from, lt: range.to };
  if (q.q) where.OR = [{ description: { contains: q.q, mode: "insensitive" } }, { actorName: { contains: q.q, mode: "insensitive" } }, { recordId: { contains: q.q, mode: "insensitive" } }, { ip: { contains: q.q } }];
  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: q.order === "asc" ? "asc" : "desc" }, ...getPaging(q), include: { user: { select: { id: true, name: true, role: true, email: true } } } }),
    db.auditLog.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getAuditLog(id: string) {
  const log = await db.auditLog.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, role: true, email: true } } } });
  if (!log) throw Errors.notFound("Audit log entry");
  return log;
}

/** Distinct values for the filter selects. */
export async function auditFilterOptions() {
  const [modules, actions, recordTypes, users] = await Promise.all([
    db.auditLog.findMany({ distinct: ["module"], select: { module: true }, orderBy: { module: "asc" } }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ distinct: ["recordType"], select: { recordType: true }, where: { recordType: { not: null } }, orderBy: { recordType: "asc" } }),
    db.user.findMany({ where: { role: { in: ["SUPER_ADMIN", "STAFF"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  return { modules: modules.map((m) => m.module), actions: actions.map((a) => a.action), recordTypes: recordTypes.map((r) => r.recordType!).filter(Boolean), users };
}
