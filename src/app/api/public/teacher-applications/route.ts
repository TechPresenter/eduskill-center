import { apiHandler } from "@/lib/api/handler";
import { ApiError, Errors } from "@/lib/api/errors";
import { validateUpload } from "@/lib/storage";
import { teacherApplicationSchema } from "@/lib/validation/trainers";
import { submitTeacherApplication } from "@/server/trainers";

/**
 * POST /api/public/teacher-applications   multipart/form-data
 *
 * The short "Apply as a Teacher" screening form (/become-a-trainer/teach). It lands in the SAME
 * TrainerApplication pipeline as the 8-step wizard, so the Foundation reviews one queue.
 *
 * Multipart rather than JSON because the resume is part of the submission, not a follow-up upload:
 * the applicant clicks Submit once and either the whole thing lands or nothing does. `parseBody`
 * cannot be used as-is because it collapses repeated keys, and `classes` and `subjects` are
 * multi-valued, so the raw object is assembled with `getAll` before Zod sees it.
 */
export const POST = apiHandler({ auth: "none", rateLimit: { limit: 5, windowSec: 60 * 60, name: "teacher-apply" } }, async ({ req, ip, userAgent }) => {
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    throw Errors.badRequest("Invalid request body");
  }

  const text = (key: string) => {
    const v = fd.get(key);
    return typeof v === "string" ? v : "";
  };
  const list = (key: string) => fd.getAll(key).filter((v): v is string => typeof v === "string" && v.trim() !== "");

  const input = teacherApplicationSchema.parse({
    name: text("name"),
    mobile: text("mobile"),
    email: text("email"),
    districtId: text("districtId"),
    qualification: text("qualification"),
    subjects: list("subjects"),
    classes: list("classes"),
    experienceBand: text("experienceBand"),
    teachingMode: text("teachingMode"),
    consent: text("consent"),
  });

  // Validate the resume BEFORE anything is written, and report it on the `resume` field so the
  // form can show the message under the drop zone instead of as a banner.
  const file = fd.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    throw Errors.validation("Please correct the highlighted fields.", { resume: "Attach your resume or CV (PDF, DOC or DOCX, up to 5 MB)" });
  }
  let resume;
  try {
    resume = await validateUpload(file, { preset: "resume" });
  } catch (err) {
    throw Errors.validation("Please correct the highlighted fields.", { resume: err instanceof ApiError ? err.message : "That file could not be accepted" });
  }

  return submitTeacherApplication(input, resume, { ip, userAgent });
});
