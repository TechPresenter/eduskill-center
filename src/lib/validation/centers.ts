import { z } from "zod";
import { mobileSchema, optionalEmail, optionalString, pincodeSchema, stringList, uuid } from "@/lib/validation/common";

export const centerInputSchema = z.object({
  name: z.string().trim().min(3, "Enter the center name").max(160),
  stateId: uuid,
  districtId: uuid,
  blockId: uuid,
  address: z.string().trim().min(5, "Enter the address").max(500),
  landmark: optionalString,
  villageTown: optionalString,
  pincode: pincodeSchema,
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  phone: z.union([z.literal(""), mobileSchema]).optional().nullable(),
  whatsapp: z.union([z.literal(""), mobileSchema]).optional().nullable(),
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
