import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveTrainerApplication, assignTrainer, lookupTrainerApplication, resolveTrainerLocation, submitTeacherApplication, submitTrainerApplication, transitionTrainerApplication } from "@/server/trainers";
import { teacherApplicationSchema, trainerApplicationSchema } from "@/lib/validation/trainers";
import { isPrivateKey, keyFromUrl, validateUpload } from "@/lib/storage";
import { ensureAdmin, ensureDocumentTypes, makeBatch, makeCenter, makeCourse, makeLocation, uid } from "./helpers";

function baseInput(loc: Awaited<ReturnType<typeof makeLocation>>, level: "BLOCK" | "DISTRICT" | "STATE") {
  const n = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return {
    name: `Trainer ${uid()}`,
    mobile: `92${n}`,
    whatsapp: "",
    email: `${uid("tr")}@test.local`,
    dob: "1990-05-05",
    gender: "MALE" as const,
    level,
    stateId: loc.state.id,
    districtId: level === "STATE" ? "" : loc.district.id,
    blockId: level === "BLOCK" ? loc.block.id : "",
    address: "12 Volunteer Lane",
    pincode: "700001",
    qualification: "MCA",
    skills: ["MS Office"],
    experienceYears: 5,
    teachingExperienceYears: 2,
    preferredCourseIds: [],
    languages: ["Hindi"],
    availability: "Weekends",
    trainingMode: "OFFLINE" as const,
    motivation: "I want to help students in my community become job-ready with practical skills.",
    acceptTerms: true,
  };
}

describe("volunteer trainer workflow", () => {
  it("validates location requirements per volunteer level", async () => {
    const loc = await makeLocation();
    expect(trainerApplicationSchema.safeParse({ ...baseInput(loc, "BLOCK"), blockId: "" }).success).toBe(false);
    expect(trainerApplicationSchema.safeParse({ ...baseInput(loc, "DISTRICT"), districtId: "" }).success).toBe(false);
    expect(trainerApplicationSchema.safeParse(baseInput(loc, "STATE")).success).toBe(true);
    const resolved = await resolveTrainerLocation("STATE", { stateId: loc.state.id, districtId: loc.district.id, blockId: loc.block.id });
    expect(resolved).toEqual({ stateId: loc.state.id, districtId: null, blockId: null });
    await expect(resolveTrainerLocation("BLOCK", { stateId: loc.state.id, districtId: loc.district.id, blockId: null })).rejects.toMatchObject({ status: 422 });
    const other = await makeLocation();
    await expect(resolveTrainerLocation("DISTRICT", { stateId: loc.state.id, districtId: other.district.id })).rejects.toMatchObject({ status: 422 });
  });

  it("accepts all three levels, tracks status, approves into a trainer account and assigns to a batch", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    for (const level of ["BLOCK", "DISTRICT", "STATE"] as const) {
      const input = trainerApplicationSchema.parse(baseInput(loc, level));
      const res = await submitTrainerApplication(input);
      expect(res.applicationNo).toMatch(/^TAP-\d{4}-\d{6}$/);
      const row = await db.trainerApplication.findUniqueOrThrow({ where: { id: res.id } });
      expect(row.level).toBe(level);
      expect(row.districtId).toBe(level === "STATE" ? null : loc.district.id);
      expect(row.blockId).toBe(level === "BLOCK" ? loc.block.id : null);
      // duplicate submission blocked
      await expect(submitTrainerApplication(input)).rejects.toMatchObject({ status: 409 });
    }

    const input = trainerApplicationSchema.parse(baseInput(loc, "BLOCK"));
    const { id, applicationNo } = await submitTrainerApplication(input);
    const status = await lookupTrainerApplication(applicationNo, input.mobile);
    expect(status.status).toBe("SUBMITTED");

    await expect(approveTrainerApplication(id, { user: admin })).rejects.toMatchObject({ status: 400 });
    await transitionTrainerApplication(id, { to: "UNDER_REVIEW" }, { user: admin });
    await transitionTrainerApplication(id, { to: "SHORTLISTED" }, { user: admin });
    await transitionTrainerApplication(id, { to: "INTERVIEW", interviewAt: new Date(Date.now() + 86400000), interviewMode: "Video" }, { user: admin });
    await transitionTrainerApplication(id, { to: "VERIFIED", note: "Good interview" }, { user: admin });
    const trainer = await approveTrainerApplication(id, { user: admin });
    expect(trainer.trainerId).toMatch(/^ESK-TR-\d{4}-\d{5}$/);
    const user = await db.user.findUniqueOrThrow({ where: { id: trainer.userId } });
    expect(user.role).toBe("TRAINER");
    expect(user.email).toBe(input.email.toLowerCase());
    const history = await db.trainerApplicationStatusHistory.findMany({ where: { applicationId: id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.toStatus)).toEqual(["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "VERIFIED", "APPROVED"]);

    const course = await makeCourse();
    const center = await makeCenter(admin, loc, [course.id]);
    const batch = await makeBatch(admin, center.id, course.id, 10, "UPCOMING");
    const assignment = await assignTrainer({ trainerId: trainer.id, centerId: center.id, batchId: batch.id }, { user: admin });
    expect(assignment.courseId).toBe(course.id);
    const updatedBatch = await db.batch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(updatedBatch.trainerId).toBe(trainer.id);
    // assigning to a batch of a different center is rejected
    const other = await makeCenter(admin, loc, [course.id]);
    await expect(assignTrainer({ trainerId: trainer.id, centerId: other.id, batchId: batch.id }, { user: admin })).rejects.toMatchObject({ status: 400 });
  });
});

// ───────────────── Short "Apply as a Teacher" form ─────────────────

/** A genuinely valid, minimal PDF — `validateUpload` checks the magic bytes, not just the name. */
const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

function teacherInput(districtId: string, over: Partial<Record<string, unknown>> = {}) {
  const n = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return {
    name: `Teacher ${uid()}`,
    mobile: `93${n}`,
    email: `${uid("te")}@test.local`,
    districtId,
    qualification: "M.Sc. Mathematics",
    subjects: ["Mathematics", "Physics"],
    classes: ["CLASS_5_10", "CLASS_11_12"],
    experienceBand: "YEARS_3_5",
    teachingMode: "BOTH",
    consent: "true",
    ...over,
  };
}

async function resume(name = "resume.pdf") {
  return validateUpload(new File([PDF_BYTES], name, { type: "application/pdf" }), { preset: "resume" });
}

describe("short teacher application", () => {
  beforeAll(async () => {
    await ensureDocumentTypes();
  });

  it("lands in the TrainerApplication pipeline with the unasked fields NULL and a private resume", async () => {
    const loc = await makeLocation();
    // The class groups map onto whatever courses exist in the matching seeded categories.
    const category = await db.courseCategory.create({ data: { name: "School Education (Class 5–10)", slug: "school-education-class-5-10" } });
    const course = await makeCourse();
    await db.course.update({ where: { id: course.id }, data: { categoryId: category.id } });

    const input = teacherApplicationSchema.parse(teacherInput(loc.district.id));
    const res = await submitTeacherApplication(input, await resume("priya.pdf"));
    expect(res.applicationNo).toMatch(/^TAP-\d{4}-\d{6}$/);
    expect(res.district).toBe(`${loc.district.name}, ${loc.state.name}`);

    const app = await db.trainerApplication.findUniqueOrThrow({ where: { id: res.id }, include: { documents: true, statusHistory: true } });
    // Same workflow, same queue as the 8-step wizard.
    expect(app.status).toBe("SUBMITTED");
    // Level and state are DERIVED from the chosen district, never guessed.
    expect(app.level).toBe("DISTRICT");
    expect(app.stateId).toBe(loc.state.id);
    expect(app.districtId).toBe(loc.district.id);
    expect(app.blockId).toBeNull();
    // Nothing invented for the fields the form does not ask about.
    expect(app.dob).toBeNull();
    expect(app.gender).toBeNull();
    expect(app.address).toBeNull();
    expect(app.pincode).toBeNull();
    expect(app.motivation).toBeNull();
    expect(app.languages).toEqual([]);
    // The bands are mapped to their LOWER bound and the choice itself is kept in the timeline.
    expect(app.teachingExperienceYears).toBe(3);
    expect(app.trainingMode).toBe("HYBRID");
    expect(app.skills).toEqual(["Mathematics", "Physics"]);
    expect(app.preferredCourseIds).toEqual([course.id]);
    expect(app.statusHistory[0]!.note).toContain("3–5 Years");
    expect(app.statusHistory[0]!.note).toContain("Class 5–10, Class 11–12");

    // The resume is a real TrainerDocument stored privately.
    expect(app.documents).toHaveLength(1);
    const doc = app.documents[0]!;
    expect(doc.type).toBe("resume");
    expect(doc.name).toBe("priya.pdf");
    const key = keyFromUrl(doc.url);
    expect(key).toBeTruthy();
    expect(isPrivateKey(key!)).toBe(true);
    expect(key!.startsWith(`private/trainers/${app.id}/`)).toBe(true);
  });

  it("accepts an applicant with no email, and still blocks a duplicate mobile", async () => {
    const loc = await makeLocation();
    const first = teacherApplicationSchema.parse(teacherInput(loc.district.id, { email: "" }));
    const a = await submitTeacherApplication(first, await resume());
    expect((await db.trainerApplication.findUniqueOrThrow({ where: { id: a.id } })).email).toBeNull();

    // A second emailless applicant must NOT collide with the first: `{ email: null }` in an OR
    // clause means "email IS NULL" and would otherwise match every emailless row.
    const second = teacherApplicationSchema.parse(teacherInput(loc.district.id, { email: "" }));
    const b = await submitTeacherApplication(second, await resume());
    expect(b.id).not.toBe(a.id);

    // The same mobile again is still a conflict.
    await expect(submitTeacherApplication(first, await resume())).rejects.toMatchObject({ status: 409 });
  });

  it("rejects an unresolvable city, an oversize resume and a file whose bytes belie its name", async () => {
    const loc = await makeLocation();
    await expect(submitTeacherApplication(teacherApplicationSchema.parse(teacherInput("00000000-0000-4000-8000-000000000000")), await resume())).rejects.toMatchObject({
      status: 422,
      details: { districtId: expect.stringContaining("could not find") },
    });
    // Free-typed text that never resolved arrives as "" and never reaches the service.
    expect(teacherApplicationSchema.safeParse(teacherInput("")).success).toBe(false);
    expect(teacherApplicationSchema.safeParse(teacherInput(loc.district.id, { consent: "false" })).success).toBe(false);
    expect(teacherApplicationSchema.safeParse(teacherInput(loc.district.id, { classes: [] })).success).toBe(false);
    expect(teacherApplicationSchema.safeParse(teacherInput(loc.district.id, { subjects: [] })).success).toBe(false);

    const oversize = new File([new Uint8Array(6 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
    await expect(validateUpload(oversize, { preset: "resume" })).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Maximum size is 5 MB") });

    const renamedExe = new File([new TextEncoder().encode("MZ\u0090\u0000\u0003")], "malware.pdf", { type: "application/pdf" });
    await expect(validateUpload(renamedExe, { preset: "resume" })).rejects.toMatchObject({ status: 400, message: "File content does not match its extension" });

    const wrongType = new File([PDF_BYTES], "resume.exe", { type: "application/pdf" });
    await expect(validateUpload(wrongType, { preset: "resume" })).rejects.toMatchObject({ status: 400 });
  });

  it("approves a short-form application into a trainer account even without an email", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const input = teacherApplicationSchema.parse(teacherInput(loc.district.id, { email: "" }));
    const { id } = await submitTeacherApplication(input, await resume());
    await transitionTrainerApplication(id, { to: "UNDER_REVIEW" }, { user: admin });
    await transitionTrainerApplication(id, { to: "VERIFIED" }, { user: admin });
    const trainer = await approveTrainerApplication(id, { user: admin });
    expect(trainer.trainerId).toMatch(/^ESK-TR-\d{4}-\d{5}$/);
    const user = await db.user.findUniqueOrThrow({ where: { id: trainer.userId } });
    expect(user.role).toBe("TRAINER");
    expect(user.email).toBeNull();
    expect(user.mobile).toBe(input.mobile);
    // The resume follows the applicant onto the trainer record.
    expect(await db.trainerDocument.count({ where: { trainerId: trainer.id, type: "resume" } })).toBe(1);
  });
});
