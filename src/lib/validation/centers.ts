import { z } from "zod";
import { optionalBlockName, optionalEmail, optionalPhone, optionalString, pincodeSchema, stringList, uuid } from "@/lib/validation/common";

/**
 * A block picked from the district's list. `""` and `null` mean "not picked" — the block may have
 * been typed instead (`blockName`). `.optional()` stays outermost so the key is optional.
 */
const optionalBlockId = z
  .union([z.literal(""), uuid])
  .nullable()
  .transform((v) => v || undefined)
  .optional();

/**
 * Every field of a training centre. The block is picked (`blockId`) or typed (`blockName`); the
 * service finds the typed block in the district or adds it (resolveBlockId), so the centre always
 * stores a real blockId. Use `centerInputSchema` to create and `centerUpdateSchema` to update.
 */
export const centerFieldsSchema = z.object({
  name: z.string().trim().min(3, "Enter the center name").max(160),
  stateId: uuid,
  districtId: uuid,
  blockId: optionalBlockId,
  blockName: optionalBlockName.optional(),
  address: z.string().trim().min(5, "Enter the address").max(500),
  landmark: optionalString,
  villageTown: optionalString,
  pincode: pincodeSchema,
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: optionalEmail,
  openingHours: z.record(z.string(), z.string()).optional().nullable(),
  capacity: z.coerce.number().int().min(0).max(100000).default(0),
  facilities: stringList.default([]),
  description: optionalString,
  coverImage: optionalString,
  contactPerson: optionalString,
  isVerified: z.coerce.boolean().optional(),
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE"]).optional(),
  establishedOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().nullable(),
  courseIds: z.array(uuid).max(200).optional(),
});

/** Creating a centre: a block — picked or typed — is required (shown under the Block field). */
export const centerInputSchema = centerFieldsSchema.superRefine((d, ctx) => {
  if (!d.blockId && !d.blockName) ctx.addIssue({ code: "custom", path: ["blockId"], message: "Select or type your block" });
});

/**
 * Updating a centre: every field optional. Without a block the centre keeps its own, which must still
 * be in the (possibly changed) district — updateCenter checks that. Built from the unrefined object,
 * because Zod refuses `.partial()` on a refined one.
 */
export const centerUpdateSchema = centerFieldsSchema.partial();

export type CenterInput = z.infer<typeof centerInputSchema>;

export const centerSearchSchema = z.object({
  stateId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  blockId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  state: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  q: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(6).optional(),
  verified: z.union([z.literal("true"), z.literal("false")]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type CenterSearchQuery = z.infer<typeof centerSearchSchema>;
