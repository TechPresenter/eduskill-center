import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  CENTRE_STEPS,
  CENTRE_STEP_OF,
  approveCentreApplication,
  lookupCentreApplication,
  submitCentreApplication,
  transitionCentreApplication,
} from "@/server/centre-applications";
import { centreApplicationSchema } from "@/lib/validation/centre-applications";
import { daysFromNow, ensureAdmin, makeCourse, makeLocation, uid } from "./helpers";

function baseInput(loc: Awaited<ReturnType<typeof makeLocation>>) {
  const n = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return {
    applicantName: `Applicant ${uid()}`,
    mobile: `93${n}`,
    whatsapp: "",
    email: `${uid("ca")}@test.local`,
    dob: "1988-07-14",
    gender: "FEMALE" as const,
    photoUrl: "",
    qualification: "B.Ed",
    occupation: "Teacher",
    teachingExperienceYears: 6,
    stateId: loc.state.id,
    districtId: loc.district.id,
    blockId: loc.block.id,
    villageTown: "Rampur",
    address: "Near the panchayat bhawan, Rampur",
    pincode: "700001",
    proposedName: "Rampur Normal Education Centre",
    spaceType: "OWN" as const,
    roomCount: 2,
    areaSqft: 600,
    seatingCapacity: 40,
    hasElectricity: true,
    hasToilet: true,
    hasDrinkingWater: true,
    hasFurniture: false,
    expectedStudents: 35,
    classes: ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4"] as ("CLASS_1" | "CLASS_2" | "CLASS_3" | "CLASS_4")[],
    motivation: "Children in our village walk far for extra help with reading and mathematics. I want to run classes for them here.",
    acceptTerms: true,
  };
}

describe("open a centre – seven step process", () => {
  it("validates the public application form", async () => {
    const loc = await makeLocation();
    expect(centreApplicationSchema.safeParse(baseInput(loc)).success).toBe(true);
    // The declaration must be accepted, at least one class chosen, and the motivation substantive.
    expect(centreApplicationSchema.safeParse({ ...baseInput(loc), acceptTerms: false }).success).toBe(false);
    expect(centreApplicationSchema.safeParse({ ...baseInput(loc), classes: [] }).success).toBe(false);
    expect(centreApplicationSchema.safeParse({ ...baseInput(loc), motivation: "I want to." }).success).toBe(false);
    expect(centreApplicationSchema.safeParse({ ...baseInput(loc), roomCount: 0 }).success).toBe(false);
  });

  it("submits, tracks and rejects a second open application from the same mobile", async () => {
    const loc = await makeLocation();
    const input = centreApplicationSchema.parse(baseInput(loc));
    const app = await submitCentreApplication(input, { ip: "127.0.0.1" });
    expect(app.applicationNo).toMatch(/^CEN-\d{4}-\d{6}$/);

    // The public tracker finds it by application number + mobile, and only with the right mobile.
    const found = await lookupCentreApplication(app.applicationNo, input.mobile);
    expect(found.id).toBe(app.id);
    expect(CENTRE_STEP_OF[found.status]).toBe(1);
    await expect(lookupCentreApplication(app.applicationNo, "9300000000")).rejects.toMatchObject({ status: 404 });

    await expect(submitCentreApplication({ ...input, email: `${uid("ca")}@test.local` }, {})).rejects.toMatchObject({ status: 409 });
  });

  it("walks all seven steps and starts the training centre", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const course = await makeCourse();
    const app = await submitCentreApplication(centreApplicationSchema.parse(baseInput(loc)), {});

    // Approval is refused until the orientation step is reached.
    await expect(approveCentreApplication(app.id, {}, { user: admin })).rejects.toMatchObject({ status: 400 });
    // And a step cannot be skipped.
    await expect(transitionCentreApplication(app.id, { to: "SELECTED" }, { user: admin })).rejects.toMatchObject({ status: 400 });

    const order = ["UNDER_REVIEW", "DOCUMENTS_VERIFIED", "CENTRE_VERIFICATION", "SELECTED", "AGREEMENT_PENDING", "AGREEMENT_SIGNED", "ORIENTATION"] as const;
    // A verification visit date and an orientation date are required at their steps.
    await transitionCentreApplication(app.id, { to: "UNDER_REVIEW" }, { user: admin });
    await transitionCentreApplication(app.id, { to: "DOCUMENTS_VERIFIED" }, { user: admin });
    await expect(transitionCentreApplication(app.id, { to: "CENTRE_VERIFICATION" }, { user: admin })).rejects.toMatchObject({ status: 422 });

    for (const to of order.slice(2)) {
      await transitionCentreApplication(
        app.id,
        {
          to,
          note: `moved to ${to}`,
          verificationAt: to === "CENTRE_VERIFICATION" ? daysFromNow(7) : null,
          orientationAt: to === "ORIENTATION" ? daysFromNow(21) : null,
          orientationMode: to === "ORIENTATION" ? "At the district office" : null,
          agreementReference: to === "AGREEMENT_SIGNED" ? "AGR/2026/0001" : null,
        },
        { user: admin },
      );
      const row = await db.centreApplication.findUniqueOrThrow({ where: { id: app.id }, select: { status: true } });
      expect(row.status).toBe(to);
    }

    const created = await approveCentreApplication(app.id, { capacity: 40, courseIds: [course.id] }, { user: admin });
    expect(CENTRE_STEP_OF.APPROVED).toBe(CENTRE_STEPS.length);

    const applicationRow = await db.centreApplication.findUniqueOrThrow({ where: { id: app.id }, select: { status: true, centerId: true } });
    expect(applicationRow.status).toBe("APPROVED");
    expect(applicationRow.centerId).toBe(created.id);

    const center = await db.center.findUniqueOrThrow({
      where: { id: created.id },
      include: { courses: { select: { courseId: true } } },
    });
    expect(center.code).toMatch(/^ESK-[A-Z0-9]+-[A-Z0-9]+-\d{4}$/);
    expect(center.blockId).toBe(loc.block.id);
    expect(center.courses.map((c) => c.courseId)).toContain(course.id);

    // Every step is on the record, and the centre is created only once.
    const history = await db.centreApplicationStatusHistory.count({ where: { applicationId: app.id } });
    expect(history).toBeGreaterThanOrEqual(order.length + 1);
    await expect(approveCentreApplication(app.id, {}, { user: admin })).rejects.toMatchObject({ status: 409 });
  });

  it("can send an application back for documents and reopen a rejected one", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const app = await submitCentreApplication(centreApplicationSchema.parse(baseInput(loc)), {});

    const statusOf = async () =>
      (await db.centreApplication.findUniqueOrThrow({ where: { id: app.id }, select: { status: true } })).status;

    await transitionCentreApplication(app.id, { to: "UNDER_REVIEW" }, { user: admin });
    await transitionCentreApplication(app.id, { to: "DOCUMENTS_REQUIRED", note: "Aadhaar is unreadable" }, { user: admin });
    expect(CENTRE_STEP_OF[await statusOf()]).toBe(2);
    await transitionCentreApplication(app.id, { to: "REJECTED", note: "No suitable space" }, { user: admin });
    expect(CENTRE_STEP_OF[await statusOf()]).toBe(0);
    await transitionCentreApplication(app.id, { to: "UNDER_REVIEW", note: "Applicant found a new room" }, { user: admin });
    expect(await statusOf()).toBe("UNDER_REVIEW");
  });
});
