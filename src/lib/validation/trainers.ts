import { z } from "zod";
import { boolish, dateString, emailSchema, mobileSchema, optionalEmail, optionalPhone, optionalString, pincodeSchema, stringList, uuid } from "@/lib/validation/common";

export const trainerLevelSchema = z.enum(["BLOCK", "DISTRICT", "STATE"]);

export const trainerApplicationSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(120),
    mobile: mobileSchema,
    whatsapp: optionalPhone,
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

// ───────────────────────── Short "Apply as a Teacher" form ─────────────────────────
//
// Feeds the SAME TrainerApplication pipeline as the 8-step wizard above — same model, same
// TrainerApplicationStatus workflow, same Admin → Trainer Applications queue — but asks only what
// an initial teacher screening needs. Everything it does not ask for stays NULL (see the migration
// 20260929120000_trainer_application_optional_fields); nothing is invented to fill a column.

/** Class groups on the short form, mapped to real course-category slugs by the service. */
export const TEACHING_CLASS_BANDS = ["CLASS_1_4", "CLASS_5_10", "CLASS_11_12", "COMPETITIVE_EXAMS"] as const;
export type TeachingClassBand = (typeof TEACHING_CLASS_BANDS)[number];

/** The course category each class group maps to. Slugs are the seeded categories (prisma/seed-data). */
export const TEACHING_CLASS_CATEGORY_SLUG: Record<TeachingClassBand, string> = {
  CLASS_1_4: "normal-education-class-1-4",
  CLASS_5_10: "school-education-class-5-10",
  CLASS_11_12: "senior-secondary-class-11-12",
  COMPETITIVE_EXAMS: "competitive-exam-training",
};

export const TEACHING_CLASS_LABEL: Record<TeachingClassBand, string> = {
  CLASS_1_4: "Class 1–4",
  CLASS_5_10: "Class 5–10",
  CLASS_11_12: "Class 11–12",
  COMPETITIVE_EXAMS: "Competitive Exams",
};

export const TEACHING_EXPERIENCE_BANDS = ["FRESHER", "YEARS_1_2", "YEARS_3_5", "YEARS_5_PLUS"] as const;
export type TeachingExperienceBand = (typeof TEACHING_EXPERIENCE_BANDS)[number];

/**
 * Band → the number of years stored in `teachingExperienceYears`. Each value is the band's LOWER
 * bound, which is the only thing the band actually tells us.
 */
export const TEACHING_EXPERIENCE_YEARS: Record<TeachingExperienceBand, number> = {
  FRESHER: 0,
  YEARS_1_2: 1,
  YEARS_3_5: 3,
  YEARS_5_PLUS: 5,
};

export const TEACHING_EXPERIENCE_LABEL: Record<TeachingExperienceBand, string> = {
  FRESHER: "Fresher",
  YEARS_1_2: "1–2 Years",
  YEARS_3_5: "3–5 Years",
  YEARS_5_PLUS: "5+ Years",
};

export const TEACHING_MODES = ["ONLINE", "OFFLINE", "BOTH"] as const;
export type TeachingMode = (typeof TEACHING_MODES)[number];

/** Teaching mode → the `CourseMode` stored on the application. "Both" is the existing HYBRID. */
export const TEACHING_MODE_COURSE_MODE: Record<TeachingMode, "ONLINE" | "OFFLINE" | "HYBRID"> = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  BOTH: "HYBRID",
};

export const TEACHING_MODE_LABEL: Record<TeachingMode, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  BOTH: "Both",
};

export const teacherApplicationSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  mobile: mobileSchema,
  /** Optional on purpose — the brief does not mark Email Address as required. */
  email: optionalEmail,
  /**
   * A REAL District row, chosen from the type-ahead. The applicant types a city or district name;
   * the client resolves it against the district table and submits the id. A free-typed value that
   * never resolved arrives as "" and fails here, which is exactly the intent: an unresolvable
   * location is a validation error shown to the applicant, never a guess.
   */
  districtId: z.string().trim().uuid("Pick your city or district from the list"),
  qualification: z.string().trim().min(2, "Enter your highest qualification").max(200),
  subjects: stringList.min(1, "Add at least one subject you can teach"),
  classes: z.array(z.enum(TEACHING_CLASS_BANDS)).min(1, "Select at least one class group").max(TEACHING_CLASS_BANDS.length),
  /**
   * Required even though the brief shows no asterisk: `teaching_experience_years` and
   * `training_mode` are NOT NULL columns whose defaults (0 and OFFLINE) would otherwise be stored
   * as if the applicant had claimed "Fresher" and "Offline". Both are a single tap.
   */
  experienceBand: z.enum(TEACHING_EXPERIENCE_BANDS, { message: "Select your teaching experience" }),
  teachingMode: z.enum(TEACHING_MODES, { message: "Select your preferred teaching mode" }),
  /**
   * An unchecked checkbox sends NOTHING, so the field reaches the route as `""`. `boolish` does not
   * accept `""`, so without this the union fails and the applicant is told "Invalid input" instead
   * of what to do about it. Map the absent/empty case to a plain "not agreed" first; anything that
   * is not an affirmative value still fails the refine, with the message that belongs to it.
   */
  consent: z.preprocess((v) => (v === "" || v == null ? "false" : v), boolish).refine((v) => v, "You must agree before submitting"),
});

export type TeacherApplicationInput = z.infer<typeof teacherApplicationSchema>;

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
