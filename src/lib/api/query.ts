import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().max(60).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().trim().max(200).optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export const optionalUuid = z.string().uuid().optional();
export const optionalBool = z
  .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0"), z.boolean()])
  .transform((v) => v === true || v === "true" || v === "1")
  .optional();
export const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((v) => new Date(`${v}T00:00:00.000Z`))
  .optional();

export function getPaging(q: { page: number; limit: number }) {
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}

export function buildOrderBy<T extends string>(
  sort: string | undefined,
  order: "asc" | "desc",
  allowed: readonly T[],
  fallback: T
): Record<string, "asc" | "desc"> {
  const field = sort && (allowed as readonly string[]).includes(sort) ? sort : fallback;
  return { [field]: order };
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function pageMeta(total: number, page: number, limit: number): PageMeta {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function paged<T>(items: T[], total: number, q: { page: number; limit: number }) {
  return { items, meta: pageMeta(total, q.page, q.limit) };
}

export type Paged<T> = { items: T[]; meta: PageMeta };

/** Date range helper for report filters (`from`, `to`, or preset `range`). */
export const dateRangeSchema = z.object({
  range: z.enum(["today", "7d", "30d", "90d", "ytd", "custom", "all"]).optional(),
  from: optionalDate,
  to: optionalDate,
});

export function resolveDateRange(input: z.infer<typeof dateRangeSchema>): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysAgo = (n: number) => new Date(startOfDay.getTime() - n * 86400000);
  switch (input.range) {
    case "today":
      return { from: startOfDay };
    case "7d":
      return { from: daysAgo(7) };
    case "30d":
      return { from: daysAgo(30) };
    case "90d":
      return { from: daysAgo(90) };
    case "ytd":
      return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) };
    case "all":
      return {};
    case "custom":
    default: {
      const to = input.to ? new Date(input.to.getTime() + 86400000) : undefined;
      return { from: input.from, to };
    }
  }
}
