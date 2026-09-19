import { z } from "zod";
import { dateString, emailSchema, mobileSchema, optionalString, pincodeSchema, uuid } from "@/lib/validation/common";

/** Classes a Normal Education Centre may run under the EduSkill Shiksha Mission. */
export const CENTRE_CLASSES = [
  { value: "CLASS_1", label: "Class 1" },
  { value: "CLASS_2", label: "Class 2" },
  { value: "CLASS_3", label: "Class 3" },
  { value: "CLASS_4", label: "Class 4" },
] as const;

export const CENTRE_CLASS_VALUES = CENTRE_CLASSES.map((c) => c.value);

export const SPACE_TYPES = [
  { value: "OWN", label: "Own property" },
  { value: "RENTED", label: "Rented space" },
  { value: "COMMUNITY", label: "Community / panchayat building" },
  { value: "OTHER", label: "Other" },
] as const;

/** Public application to open a Normal Education Centre (Class 1–4). */
export const centreApplicationSchema = z.object({
  // Step 1 – applicant
  applicantName: z.string().trim().min(2, "Enter your full name").max(120),
  mobile: mobileSchema,
  whatsapp: z.union([z.literal(""), mobileSchema]).optional().nullable(),
  email: emailSchema,
  dob: z.union([z.literal(""), dateString]).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  photoUrl: optionalString,
  qualification: z.string().trim().min(2, "Enter your highest qualification").max(200),
  occupation: optionalString,
  teachingExperienceYears: z.coerce.number().int().min(0).max(60).default(0),

  // Step 2 – location
  stateId: uuid,
  districtId: uuid,
  blockId: uuid,
  villageTown: z.string().trim().min(2, "Enter the village or town").max(120),
  address: z.string().trim().min(5, "Enter the full address").max(500),
  pincode: pincodeSchema,

  // Step 3 – proposed centre
  proposedName: z.string().trim().min(3, "Enter a name for the centre").max(160),
  spaceType: z.enum(["OWN", "RENTED", "COMMUNITY", "OTHER"]).default("OWN"),
  roomCount: z.coerce.number().int().min(1, "At least one room is required").max(50),
  areaSqft: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  seatingCapacity: z.coerce.number().int().min(1, "Enter how many children can sit").max(500),
  hasElectricity: z.coerce.boolean().default(false),
  hasToilet: z.coerce.boolean().default(false),
  hasDrinkingWater: z.coerce.boolean().default(false),
  hasFurniture: z.coerce.boolean().default(false),
  expectedStudents: z.coerce.number().int().min(1, "Enter the expected number of children").max(500),
  classes: z.array(z.enum(["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4"])).min(1, "Select at least one class"),

  // Step 4 – motivation & declaration
  motivation: z.string().trim().min(30, "Please write at least a few sentences (30+ characters)").max(3000),
  acceptTerms: z.coerce.boolean().refine((v) => v, "You must accept the declaration"),
});

export type CentreApplicationInput = z.infer<typeof centreApplicationSchema>;

export const centreApplicationLookupSchema = z.object({
  applicationNo: z.string().trim().min(5).max(40),
  mobile: mobileSchema,
});

/** Staff-driven moves through the seven-step process (APPROVED has its own action). */
export const centreTransitionSchema = z.object({
  to: z.enum([
    "UNDER_REVIEW",
    "DOCUMENTS_REQUIRED",
    "DOCUMENTS_VERIFIED",
    "CENTRE_VERIFICATION",
    "SELECTED",
    "AGREEMENT_PENDING",
    "AGREEMENT_SIGNED",
    "ORIENTATION",
    "REJECTED",
  ]),
  note: z.string().trim().max(2000).optional().nullable(),
  verificationAt: z.string().datetime({ offset: true }).optional().nullable(),
  orientationAt: z.string().datetime({ offset: true }).optional().nullable(),
  orientationMode: z.string().trim().max(100).optional().nullable(),
  agreementReference: z.string().trim().max(120).optional().nullable(),
});

/** Final step: create the training centre from the approved application. */
export const centreApproveSchema = z.object({
  note: z.string().trim().max(2000).optional().nullable(),
  /** Overrides for the centre record; defaults come from the application. */
  centerName: z.string().trim().min(3).max(160).optional(),
  capacity: z.coerce.number().int().min(0).max(100000).optional(),
  phone: z.union([z.literal(""), mobileSchema]).optional().nullable(),
  courseIds: z.array(uuid).max(50).optional(),
});
