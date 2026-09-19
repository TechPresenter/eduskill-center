import { z } from "zod";
import { dateString, emailSchema, mobileSchema, optionalString, pincodeSchema, stringList, uuid } from "@/lib/validation/common";

export const trainerLevelSchema = z.enum(["BLOCK", "DISTRICT", "STATE"]);

export const trainerApplicationSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    mobile: mobileSchema,
    whatsapp: z.union([z.literal(""), mobileSchema]).optional().nullable(),
    email: emailSchema,
    dob: dateString,
    gender: z.enum(["MALE", "FEMALE", "OTHER"]),
    level: trainerLevelSchema,
    stateId: uuid,
    districtId: z.union([z.literal(""), uuid]).optional().nullable(),
    blockId: z.union([z.literal(""), uuid]).optional().nullable(),
    address: z.string().trim().min(5, "Enter your address").max(500),
    pincode: pincodeSchema,
    qualification: z.string().trim().min(2, "Enter your highest qualification").max(200),
    skills: stringList.min(1, "Add at least one skill"),
    experienceYears: z.coerce.number().int().min(0).max(60),
    teachingExperienceYears: z.coerce.number().int().min(0).max(60),
    preferredCourseIds: z.array(uuid).max(20).default([]),
    languages: stringList.min(1, "Add at least one language"),
    availability: z.string().trim().max(300).optional().nullable(),
    trainingMode: z.enum(["OFFLINE", "ONLINE", "HYBRID"]).default("OFFLINE"),
    motivation: z.string().trim().min(30, "Please write at least a few sentences (30+ characters)").max(3000),
    photoUrl: optionalString,
    acceptTerms: z.coerce.boolean().refine((v) => v, "You must accept the declaration"),
  })
  .superRefine((d, ctx) => {
    if ((d.level === "BLOCK" || d.level === "DISTRICT") && !d.districtId) {
      ctx.addIssue({ code: "custom", path: ["districtId"], message: "District is required for this volunteer level" });
    }
    if (d.level === "BLOCK" && !d.blockId) {
      ctx.addIssue({ code: "custom", path: ["blockId"], message: "Block is required for block-level volunteers" });
    }
  });

export type TrainerApplicationInput = z.infer<typeof trainerApplicationSchema>;

export const trainerStatusLookupSchema = z.object({
  applicationNo: z.string().trim().min(5).max(40),
  mobile: mobileSchema,
});

export const trainerTransitionSchema = z.object({
  to: z.enum(["UNDER_REVIEW", "DOCUMENTS_REQUIRED", "SHORTLISTED", "INTERVIEW", "VERIFIED", "REJECTED"]),
  note: z.string().trim().max(2000).optional().nullable(),
  interviewAt: z.string().datetime({ offset: true }).optional().nullable(),
  interviewMode: z.string().trim().max(100).optional().nullable(),
});

export const trainerAssignmentSchema = z.object({
  trainerId: uuid,
  centerId: uuid,
  courseId: z.union([z.literal(""), uuid]).optional().nullable(),
  batchId: z.union([z.literal(""), uuid]).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
