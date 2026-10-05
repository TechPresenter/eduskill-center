import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveTrainerApplication, resolveTrainerLocation, submitTrainerApplication, transitionTrainerApplication } from "@/server/trainers";
import { trainerApplicationSchema } from "@/lib/validation/trainers";
import { getTerms } from "@/server/terms";
import { ensureAdmin, makeLocation, uid } from "./helpers";

/** Fingerprints of the terms the form would show right now. */
let volunteerTermsVersion = "";
let inChargeTermsVersion = "";
beforeAll(async () => {
  volunteerTermsVersion = (await getTerms("volunteerTeacher")).version;
  inChargeTermsVersion = (await getTerms("inCharge")).version;
});

/**
 * Block is typable on the Become a Trainer application: a BLOCK-level volunteer picks the block or
 * types it, and the server finds the typed block in the chosen district (case-insensitively) or adds
 * it as a real Block row, so a block-level application always stores a real blockId. DISTRICT and
 * STATE level volunteers have no block at all.
 */

type Loc = Awaited<ReturnType<typeof makeLocation>>;
type Level = "BLOCK" | "DISTRICT" | "STATE";

/** A raw (pre-parse) wizard body; `block` is the block part of the location step. */
function applicationBody(loc: Loc, level: Level, block: { blockId?: string | null; blockName?: string | null } = {}) {
  const n = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return {
    acceptVolunteerTerms: true,
    volunteerTermsVersion,
    ...(level === "STATE" ? {} : { acceptInChargeTerms: true, inChargeTermsVersion }),
    name: `Trainer ${uid()}`,
    mobile: `95${n}`,
    whatsapp: "",
    email: `${uid("tb")}@test.local`,
    dob: "1991-07-14",
    gender: "FEMALE",
    level,
    stateId: loc.state.id,
    districtId: level === "STATE" ? "" : loc.district.id,
    blockId: "",
    blockName: "",
    ...block,
    address: "House 7, Teachers Colony",
    pincode: "741101",
    qualification: "B.Ed",
    skills: ["Spoken English"],
    experienceYears: 4,
    teachingExperienceYears: 3,
    preferredCourseIds: [],
    languages: ["Bengali", "Hindi"],
    availability: "",
    trainingMode: "OFFLINE",
    motivation: "I teach in my block already and want to help more young people get job-ready skills.",
    acceptTerms: true,
  };
}

/** Parses like POST /api/public/trainer-applications does, then submits. */
async function apply(loc: Loc, block: { blockId?: string | null; blockName?: string | null }, level: Level = "BLOCK") {
  const input = trainerApplicationSchema.parse(applicationBody(loc, level, block));
  const { id } = await submitTrainerApplication(input);
  return db.trainerApplication.findUniqueOrThrow({ where: { id }, include: { block: true } });
}

const blocksNamed = (districtId: string, name: string) =>
  db.block.findMany({ where: { districtId, name: { equals: name, mode: "insensitive" } } });

describe("typable block – Become a Trainer application", () => {
  it("adds a typed new block to the chosen district and reuses it for the next applicant", async () => {
    const loc = await makeLocation();
    const first = await apply(loc, { blockName: "Haringhata  Block" });

    // A real Block row in that district, with the spaces tidied, active and audited as System.
    expect(first.blockId).toBeTruthy();
    expect(first.block!.districtId).toBe(loc.district.id);
    expect(first.block!.name).toBe("Haringhata Block");
    expect(first.block!.isActive).toBe(true);
    const log = await db.auditLog.findFirst({ where: { recordType: "Block", recordId: first.blockId! } });
    expect(log?.actorName).toBe("System");
    expect(log?.description).toContain("Become a Trainer");

    // Another applicant types it differently: same block, no duplicate.
    const second = await apply(loc, { blockName: "  haringhata   BLOCK " });
    expect(second.blockId).toBe(first.blockId);
    expect(await blocksNamed(loc.district.id, "Haringhata Block")).toHaveLength(1);

    // The same name in another district is a different block.
    const other = await makeLocation();
    const third = await apply(other, { blockName: "Haringhata Block" });
    expect(third.blockId).not.toBe(first.blockId);
    expect(third.block!.districtId).toBe(other.district.id);
  });

  it("reuses an existing block when its name is typed, and a picked block by id", async () => {
    const loc = await makeLocation();
    const typed = await apply(loc, { blockName: loc.block.name.toUpperCase() });
    expect(typed.blockId).toBe(loc.block.id);

    // Picked from the list: the form sends the id and no name.
    const picked = await apply(loc, { blockId: loc.block.id });
    expect(picked.blockId).toBe(loc.block.id);
    expect(await db.block.count({ where: { districtId: loc.district.id } })).toBe(1);
  });

  it("refuses a block from another district with a 422 on blockId", async () => {
    const loc = await makeLocation();
    const other = await makeLocation();
    const input = trainerApplicationSchema.parse(applicationBody(loc, "BLOCK", { blockId: other.block.id }));
    await expect(submitTrainerApplication(input)).rejects.toMatchObject({ status: 422, details: { blockId: expect.any(String) } });
    // A district from another state is refused on districtId, before any block is added.
    const crossState = trainerApplicationSchema.parse({ ...applicationBody(loc, "BLOCK", { blockName: "Somewhere" }), districtId: other.district.id });
    await expect(submitTrainerApplication(crossState)).rejects.toMatchObject({ status: 422, details: { districtId: expect.any(String) } });
    expect(await blocksNamed(other.district.id, "Somewhere")).toHaveLength(0);
    expect(await db.trainerApplication.count({ where: { email: { in: [input.email, crossState.email] } } })).toBe(0);
  });

  it("requires a block — picked or typed — for block-level volunteers, with the error on blockId", async () => {
    const loc = await makeLocation();
    for (const block of [{}, { blockId: "", blockName: "" }, { blockId: null, blockName: null }, { blockName: "   " }]) {
      const parsed = trainerApplicationSchema.safeParse(applicationBody(loc, "BLOCK", block));
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.some((i) => i.path.join(".") === "blockId" || i.path.join(".") === "blockName")).toBe(true);
    }
    const missing = trainerApplicationSchema.safeParse(applicationBody(loc, "BLOCK"));
    expect(missing.error?.issues.find((i) => i.path.join(".") === "blockId")?.message).toBe("Select or type your block");

    // A typed name must be a plausible place name.
    expect(trainerApplicationSchema.safeParse(applicationBody(loc, "BLOCK", { blockName: "<b>x</b>" })).success).toBe(false);

    // The service refuses it as well, should a caller skip the schema.
    const input = trainerApplicationSchema.parse(applicationBody(loc, "BLOCK", { blockId: loc.block.id }));
    await expect(submitTrainerApplication({ ...input, blockId: undefined, blockName: undefined })).rejects.toMatchObject({
      status: 422,
      details: { blockId: "Select or type your block" },
    });
    await expect(resolveTrainerLocation("BLOCK", { stateId: loc.state.id, districtId: loc.district.id, blockId: "", blockName: "" })).rejects.toMatchObject({
      status: 422,
      details: { blockId: "Select or type your block" },
    });
  });

  it("drops the block for district and state volunteers and adds none", async () => {
    const loc = await makeLocation();
    // No block needed for these levels.
    expect(trainerApplicationSchema.safeParse(applicationBody(loc, "DISTRICT")).success).toBe(true);
    expect(trainerApplicationSchema.safeParse(applicationBody(loc, "STATE")).success).toBe(true);

    const district = await apply(loc, { blockName: "Unused Block" }, "DISTRICT");
    expect(district.districtId).toBe(loc.district.id);
    expect(district.blockId).toBeNull();
    const state = await apply(loc, { blockId: loc.block.id }, "STATE");
    expect(state.districtId).toBeNull();
    expect(state.blockId).toBeNull();
    expect(await blocksNamed(loc.district.id, "Unused Block")).toHaveLength(0);
  });

  it("adds no block when the application is refused as a duplicate", async () => {
    const loc = await makeLocation();
    const body = applicationBody(loc, "BLOCK", { blockName: "First Block" });
    await submitTrainerApplication(trainerApplicationSchema.parse(body));
    // The same applicant again, with a new block name: 409, and that block is not added.
    await expect(submitTrainerApplication(trainerApplicationSchema.parse({ ...body, blockName: "Second Block" }))).rejects.toMatchObject({ status: 409 });
    expect(await blocksNamed(loc.district.id, "Second Block")).toHaveLength(0);
  });

  it("approves a block-level volunteer onto the block they typed", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const app = await apply(loc, { blockName: "Chakdaha Rural" });
    await transitionTrainerApplication(app.id, { to: "UNDER_REVIEW" }, { user: admin });
    await transitionTrainerApplication(app.id, { to: "VERIFIED" }, { user: admin });
    const trainer = await approveTrainerApplication(app.id, { user: admin });
    expect(trainer.level).toBe("BLOCK");
    expect(trainer.blockId).toBe(app.blockId);
    expect(trainer.districtId).toBe(loc.district.id);
    expect(trainer.stateId).toBe(loc.state.id);
  });
});
