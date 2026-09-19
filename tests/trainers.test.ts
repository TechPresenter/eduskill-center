import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveTrainerApplication, assignTrainer, lookupTrainerApplication, resolveTrainerLocation, submitTrainerApplication, transitionTrainerApplication } from "@/server/trainers";
import { trainerApplicationSchema } from "@/lib/validation/trainers";
import { ensureAdmin, makeBatch, makeCenter, makeCourse, makeLocation, uid } from "./helpers";

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
