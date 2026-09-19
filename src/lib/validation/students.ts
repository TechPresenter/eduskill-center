import { z } from "zod";
import { dateString, mobileSchema, optionalEmail, optionalString, pincodeSchema, uuid } from "@/lib/validation/common";

export const studentProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  guardianName: z.string().trim().min(2, "Enter guardian name").max(120),
  guardianRelation: z.string().trim().min(2).max(40),
  dob: dateString,
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  mobile: mobileSchema,
  whatsapp: z.union([z.literal(""), mobileSchema]).optional().nullable(),
  email: optionalEmail,
  photoUrl: optionalString,
  stateId: uuid,
  districtId: uuid,
  blockId: uuid,
  villageTown: z.string().trim().min(2, "Enter village / town").max(120),
  address: z.string().trim().min(5, "Enter your address").max(500),
  pincode: pincodeSchema,
  qualification: z.string().trim().min(2, "Select or enter your qualification").max(120),
  institution: optionalString,
  passingYear: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1).optional().nullable(),
  familyIncome: optionalString,
  occupation: optionalString,
  areaType: z.enum(["RURAL", "URBAN"]).optional().nullable(),
  trainingRequirement: optionalString,
  scholarshipRequired: z.coerce.boolean().optional(),
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;

export const QUALIFICATIONS = ["Below Class 8", "Class 8", "Class 10", "Class 12", "ITI / Diploma", "Graduate", "Post Graduate", "Other"] as const;
export const INCOME_BANDS = ["Below ₹1.5 lakh", "Below ₹2.5 lakh", "₹2.5 – 5 lakh", "₹5 – 8 lakh", "Above ₹8 lakh"] as const;
export const GUARDIAN_RELATIONS = ["Father", "Mother", "Guardian", "Husband", "Wife", "Other"] as const;

export const applyStartSchema = z.object({
  centerId: uuid,
  courseId: uuid,
  batchId: z.union([z.literal(""), uuid]).optional().nullable(),
  scholarshipRequested: z.coerce.boolean().optional(),
  scholarshipReason: optionalString,
});

/**
 * Partial version of {@link applyStartSchema} used by `PATCH /api/student/applications/[id]`
 * while the apply wizard edits an existing DRAFT (any subset of the fields may be sent).
 */
export const applyPatchSchema = applyStartSchema.partial();

export type ApplyPatchInput = z.infer<typeof applyPatchSchema>;
