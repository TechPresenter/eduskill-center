import { db, type DbClient, type Prisma } from "@/lib/db";

export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

export interface AuditInput {
  user?: AuditActor | null;
  /** Verb, e.g. "create", "update", "approve", "login" */
  action: string;
  /** Module key, e.g. "applications" */
  module: string;
  recordType?: string;
  recordId?: string | null;
  /** Human readable sentence, e.g. "Staff approved admission ADM-000123" */
  description: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(
      JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
    ) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

/** Writes an audit log entry. Never throws – auditing must not break business operations. */
export async function audit(input: AuditInput, client: DbClient = db): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        userId: input.user?.id ?? null,
        actorName: input.user?.name ?? "System",
        actorRole: input.user?.role ?? "SYSTEM",
        action: input.action,
        module: input.module,
        recordType: input.recordType ?? null,
        recordId: input.recordId ?? null,
        description: input.description,
        oldValue: toJson(input.oldValue),
        newValue: toJson(input.newValue),
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}
