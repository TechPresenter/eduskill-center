import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  approveCentreApplication,
  submitCentreApplication,
  transitionCentreApplication,
} from "@/server/centre-applications";
import { createCenter, updateCenter } from "@/server/centers";
import { centreApplicationSchema } from "@/lib/validation/centre-applications";
import { centerInputSchema, centerUpdateSchema } from "@/lib/validation/centers";
import { daysFromNow, ensureAdmin, makeLocation, uid } from "./helpers";

/**
 * Block is typable on the Open-a-Centre application and the admin training-centre form: the server
 * finds the typed block in the chosen district (case-insensitively) or adds it as a real Block row,
 * so centre applications and centres always store a real blockId.
 */

type Loc = Awaited<ReturnType<typeof makeLocation>>;

/** A raw (pre-parse) Open-a-Centre application body; `block` is the location part of the form. */
function applicationBody(loc: Loc, block: { blockId?: string | null; blockName?: string | null }) {
  const n = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return {
    applicantName: `Applicant ${uid()}`,
    mobile: `93${n}`,
    whatsapp: "",
    email: `${uid("cb")}@test.local`,
    dob: "1990-03-02",
    gender: "MALE",
    photoUrl: "",
    qualification: "B.A.",
    occupation: "",
    teachingExperienceYears: 2,
    stateId: loc.state.id,
    districtId: loc.district.id,
    blockId: "",
    blockName: "",
    ...block,
    villageTown: "Kalyani",
    address: "Ward 4, near the primary school",
    pincode: "741235",
    proposedName: "Kalyani Normal Education Centre",
    spaceType: "OWN",
    roomCount: 1,
    areaSqft: "",
    seatingCapacity: 30,
    hasElectricity: true,
    hasToilet: true,
    hasDrinkingWater: true,
    hasFurniture: true,
    expectedStudents: 25,
    classes: ["CLASS_1", "CLASS_2"],
    motivation: "Our village has many first-generation learners who need a place to study after school hours.",
    acceptTerms: true,
  };
}

/** Parses like POST /api/public/centre-applications does, then submits. */
async function apply(loc: Loc, block: { blockId?: string | null; blockName?: string | null }) {
  const input = centreApplicationSchema.parse(applicationBody(loc, block));
  const { id } = await submitCentreApplication(input, {});
  return db.centreApplication.findUniqueOrThrow({ where: { id }, include: { block: true } });
}

/** A raw admin "create centre" body (what the centre form posts). */
function centerBody(loc: Loc, block: { blockId?: string | null; blockName?: string | null }) {
  return {
    name: `Center ${uid("")}`,
    stateId: loc.state.id,
    districtId: loc.district.id,
    blockId: "",
    blockName: "",
    ...block,
    address: "12 Station Road",
    landmark: null,
    villageTown: null,
    pincode: "700001",
    phone: "",
    whatsapp: "",
    email: "",
    capacity: 30,
    facilities: [],
    status: "ACTIVE",
    establishedOn: "",
    courseIds: [],
  };
}

const blocksNamed = (districtId: string, name: string) =>
  db.block.findMany({ where: { districtId, name: { equals: name, mode: "insensitive" } } });

describe("typable block – Open a Centre application", () => {
  it("adds a typed new block to the chosen district and reuses it for the next application", async () => {
    const loc = await makeLocation();
    const first = await apply(loc, { blockName: "Haringhata  Block" });

    // A real Block row in that district, with the spaces tidied, active and audited as System.
    expect(first.block.districtId).toBe(loc.district.id);
    expect(first.block.name).toBe("Haringhata Block");
    expect(first.block.isActive).toBe(true);
    const log = await db.auditLog.findFirst({ where: { recordType: "Block", recordId: first.blockId } });
    expect(log?.actorName).toBe("System");
    expect(log?.description).toContain("Open a Centre");

    // Another applicant types it differently: same block, no duplicate.
    const second = await apply(loc, { blockName: "  haringhata   BLOCK " });
    expect(second.blockId).toBe(first.blockId);
    expect(await blocksNamed(loc.district.id, "Haringhata Block")).toHaveLength(1);

    // The same name in another district is a different block.
    const other = await makeLocation();
    const third = await apply(other, { blockName: "Haringhata Block" });
    expect(third.blockId).not.toBe(first.blockId);
    expect(third.block.districtId).toBe(other.district.id);
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
    const input = centreApplicationSchema.parse(applicationBody(loc, { blockId: other.block.id }));
    await expect(submitCentreApplication(input, {})).rejects.toMatchObject({ status: 422, details: { blockId: expect.any(String) } });
    // A district from another state is refused too, on districtId.
    const crossState = centreApplicationSchema.parse({ ...applicationBody(loc, { blockName: "Somewhere" }), districtId: other.district.id });
    await expect(submitCentreApplication(crossState, {})).rejects.toMatchObject({ status: 422, details: { districtId: expect.any(String) } });
    expect(await blocksNamed(other.district.id, "Somewhere")).toHaveLength(0);
  });

  it("requires a block — picked or typed — with the error on blockId", async () => {
    const loc = await makeLocation();
    for (const block of [{}, { blockId: "", blockName: "" }, { blockId: null, blockName: null }, { blockName: "   " }]) {
      const parsed = centreApplicationSchema.safeParse(applicationBody(loc, block));
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.some((i) => i.path.join(".") === "blockId" || i.path.join(".") === "blockName")).toBe(true);
    }
    const missing = centreApplicationSchema.safeParse(applicationBody(loc, {}));
    expect(missing.error?.issues.find((i) => i.path.join(".") === "blockId")?.message).toBe("Select or type your block");

    // A typed name must be a plausible place name.
    expect(centreApplicationSchema.safeParse(applicationBody(loc, { blockName: "<b>x</b>" })).success).toBe(false);

    // The service refuses it as well, should a caller skip the schema.
    const input = centreApplicationSchema.parse(applicationBody(loc, { blockId: loc.block.id }));
    await expect(submitCentreApplication({ ...input, blockId: undefined, blockName: undefined }, {})).rejects.toMatchObject({
      status: 422,
      details: { blockId: "Select or type your block" },
    });
  });

  it("starts the centre on the block the applicant typed", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const app = await apply(loc, { blockName: "Chakdaha Rural" });
    for (const to of ["UNDER_REVIEW", "DOCUMENTS_VERIFIED", "CENTRE_VERIFICATION", "SELECTED", "AGREEMENT_PENDING", "AGREEMENT_SIGNED", "ORIENTATION"] as const) {
      await transitionCentreApplication(
        app.id,
        { to, verificationAt: to === "CENTRE_VERIFICATION" ? daysFromNow(3) : null, orientationAt: to === "ORIENTATION" ? daysFromNow(10) : null },
        { user: admin }
      );
    }
    const center = await approveCentreApplication(app.id, {}, { user: admin });
    expect(center.blockId).toBe(app.blockId);
    expect(center.districtId).toBe(loc.district.id);
  });
});

describe("typable block – training centre form", () => {
  it("creates a centre on a typed new block and reuses it for the next centre", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const a = await createCenter(centerInputSchema.parse(centerBody(loc, { blockName: "Ranaghat - II" })), { user: admin });
    const block = await db.block.findUniqueOrThrow({ where: { id: a.blockId } });
    expect(block).toMatchObject({ districtId: loc.district.id, name: "Ranaghat - II", isActive: true });

    const b = await createCenter(centerInputSchema.parse(centerBody(loc, { blockName: " RANAGHAT   - ii" })), { user: admin });
    expect(b.blockId).toBe(a.blockId);
    expect(await blocksNamed(loc.district.id, "Ranaghat - II")).toHaveLength(1);

    // Typing an existing block's name, or picking it, uses that block.
    const c = await createCenter(centerInputSchema.parse(centerBody(loc, { blockName: loc.block.name.toLowerCase() })), { user: admin });
    expect(c.blockId).toBe(loc.block.id);
    const d = await createCenter(centerInputSchema.parse(centerBody(loc, { blockId: loc.block.id })), { user: admin });
    expect(d.blockId).toBe(loc.block.id);
  });

  it("refuses a missing block and a block from another district with a 422 on blockId", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const other = await makeLocation();

    const missing = centerInputSchema.safeParse(centerBody(loc, {}));
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.find((i) => i.path.join(".") === "blockId")?.message).toBe("Select or type your block");
    const parsed = centerInputSchema.parse(centerBody(loc, { blockId: loc.block.id }));
    await expect(createCenter({ ...parsed, blockId: undefined }, { user: admin })).rejects.toMatchObject({ status: 422, details: { blockId: "Select or type your block" } });

    await expect(createCenter(centerInputSchema.parse(centerBody(loc, { blockId: other.block.id })), { user: admin })).rejects.toMatchObject({
      status: 422,
      details: { blockId: expect.any(String) },
    });
    // A district from another state is refused on districtId, before any block is added.
    await expect(
      createCenter(centerInputSchema.parse({ ...centerBody(loc, { blockName: "Nowhere Block" }), districtId: other.district.id }), { user: admin })
    ).rejects.toMatchObject({ status: 422, details: { districtId: expect.any(String) } });
    expect(await blocksNamed(other.district.id, "Nowhere Block")).toHaveLength(0);
  });

  it("updates a centre's block by name, keeps it when no block is sent, and refuses a stale block after a district change", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const center = await createCenter(centerInputSchema.parse(centerBody(loc, { blockId: loc.block.id })), { user: admin });

    // The update schema is partial (the courses tab sends only courseIds) and accepts a typed block.
    expect(centerUpdateSchema.safeParse({}).success).toBe(true);
    const moved = await updateCenter(center.id, centerUpdateSchema.parse({ blockId: "", blockName: "Santipur" }), { user: admin });
    const santipur = await db.block.findUniqueOrThrow({ where: { id: moved.blockId } });
    expect(santipur).toMatchObject({ districtId: loc.district.id, name: "Santipur" });

    // Nothing about the block in the update: the centre keeps it.
    const kept = await updateCenter(center.id, { courseIds: [] }, { user: admin });
    expect(kept.blockId).toBe(santipur.id);

    // Another district of the same state without a block: the old block is not in it.
    const district2 = await db.district.create({ data: { stateId: loc.state.id, name: `District ${uid("")}`, code: "Z9Q", slug: uid("d") } });
    await expect(updateCenter(center.id, { districtId: district2.id }, { user: admin })).rejects.toMatchObject({ status: 422, details: { blockId: expect.any(String) } });
    // With a typed block it moves, and the block is added to the new district.
    const relocated = await updateCenter(center.id, centerUpdateSchema.parse({ districtId: district2.id, blockName: "Santipur" }), { user: admin });
    expect(relocated.districtId).toBe(district2.id);
    expect(relocated.blockId).not.toBe(santipur.id);
    expect((await db.block.findUniqueOrThrow({ where: { id: relocated.blockId } })).districtId).toBe(district2.id);
  });
});
