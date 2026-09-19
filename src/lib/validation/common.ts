import { z } from "zod";

export const uuid = z.string().uuid("Invalid id");
export const optionalString = z.string().trim().max(2000).optional().nullable();
export const mobileSchema = z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");
export const pincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code");
export const emailSchema = z.email("Enter a valid email address");
export const optionalEmail = z.union([z.literal(""), emailSchema]).optional().nullable();
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").transform((v) => new Date(`${v}T00:00:00.000Z`));
export const optionalDateString = z.union([z.literal(""), dateString]).optional().nullable().transform((v) => (v ? v : null));
export const money = z.coerce.number().min(0, "Cannot be negative").max(10_000_000);
export const stringList = z.array(z.string().trim().min(1).max(100)).max(50);
export const boolish = z.union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on"), z.literal("1"), z.literal("0")]).transform((v) => v === true || v === "true" || v === "on" || v === "1");
export const slugSchema = z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only");
