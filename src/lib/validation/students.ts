import { z } from "zod";
import { dateString, mobileSchema, optionalBlockName, optionalEmail, optionalPhone, optionalString, pincodeSchema, uuid } from "@/lib/validation/common";

/**
 * A block picked from the district's list. `""` and `null` mean "not picked" — the student may have
 * typed the block instead (`blockName`). `.optional()` stays outermost so the key is optional.
 */
const optionalBlockId = z
  .union([z.literal(""), uuid])
  .nullable()
  .transform((v) => v || undefined)
  .optional();

/**
 * Every field of a student profile, unrefined. The block is picked (`blockId`) or typed
 * (`blockName`); the service finds the typed block in the district or adds it (resolveBlockId), so
 * the profile always stores a real blockId. Use `studentProfileSchema` for the student's own save and
 * `studentProfileFieldsSchema.partial()` for staff edits — Zod refuses `.partial()` on a refined schema.
 */
export const studentProfileFieldsSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  guardianName: z.string().trim().min(2, "Enter guardian name").max(120),
  guardianRelation: z.string().trim().min(2).max(40),
  dob: dateString,
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  mobile: mobileSchema,
  whatsapp: optionalPhone,
  email: optionalEmail,
  photoUrl: optionalString,
  stateId: uuid,
  districtId: uuid,
  blockId: optionalBlockId,
  blockName: optionalBlockName.optional(),
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

/** The student's own profile save: a block — picked or typed — is required (shown under the Block field). */
export const studentProfileSchema = studentProfileFieldsSchema.superRefine((d, ctx) => {
  if (!d.blockId && !d.blockName) ctx.addIssue({ code: "custom", path: ["blockId"], message: "Select or type your block" });
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;

/**
 * Staff edit (`PATCH /api/admin/students/[id]`): any subset of the profile fields plus the account
 * status. Built from the unrefined fields object, because Zod refuses `.partial()` on a refined one.
 * Without a block the student keeps theirs — adminUpdateStudent checks it is still in the (possibly
 * changed) district.
 */
export const adminStudentUpdateSchema = studentProfileFieldsSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

export type AdminStudentUpdateInput = z.infer<typeof adminStudentUpdateSchema>;

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
