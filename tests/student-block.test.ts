import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { adminUpdateStudent, updateStudentProfile } from "@/server/students";
import { adminStudentUpdateSchema, studentProfileSchema } from "@/lib/validation/students";
import { ensureAdmin, makeLocation, makeStudent, uid } from "./helpers";

/**
 * Block is typable on the student profile (the /student/profile form and the apply wizard's address
 * step) and on the admin "Edit student" drawer: the server finds the typed block in the chosen
 * district (case-insensitively) or adds it as a real Block row, so a student always stores a real
 * blockId — and a student whose district has no Block rows yet can still complete their profile.
 */

type Loc = Awaited<ReturnType<typeof makeLocation>>;
type Made = Awaited<ReturnType<typeof makeStudent>>;
type Block = { blockId?: string | null; blockName?: string | null };

/** A raw (pre-parse) PUT /api/student/profile body, as profilePayload builds it. */
function profileBody(loc: Loc, s: Made, block: Block) {
  return {
    name: s.student.name,
    guardianName: "Guardian Name",
    guardianRelation: "Father",
    dob: "2003-01-01",
    gender: "FEMALE",
    mobile: s.student.mobile,
    whatsapp: null,
    email: s.user.email,
    photoUrl: null,
    stateId: loc.state.id,
    districtId: loc.district.id,
    blockId: "",
    blockName: "",
    ...block,
    villageTown: "Kalyani",
    address: "Ward 4, near the primary school",
    pincode: "741235",
    qualification: "Class 12",
    institution: null,
    passingYear: null,
    familyIncome: null,
    occupation: null,
    areaType: null,
    trainingRequirement: null,
    scholarshipRequired: false,
  };
}

const actorOf = (s: Made) => ({ id: s.user.id, name: s.user.name, role: s.user.role });

/** Parses like PUT /api/student/profile does, then saves. */
async function saveProfile(loc: Loc, s: Made, block: Block) {
  const input = studentProfileSchema.parse(profileBody(loc, s, block));
  await updateStudentProfile(s.student.id, input, actorOf(s));
  return db.student.findUniqueOrThrow({ where: { id: s.student.id }, include: { block: true } });
}

/** A student whose district has no Block rows and who has not filled in an address yet. */
async function freshStudent(loc: Loc) {
  const made = await makeStudent(loc, { profileCompleted: false, withDocuments: false });
  await db.student.update({ where: { id: made.student.id }, data: { blockId: null, villageTown: null, address: null, pincode: null } });
  return made;
}

const blocksNamed = (districtId: string, name: string) =>
  db.block.findMany({ where: { districtId, name: { equals: name, mode: "insensitive" } } });

describe("typable block – student profile", () => {
  it("adds a typed new block to the chosen district, completes the profile, and reuses the block", async () => {
    const loc = await makeLocation();
    const a = await freshStudent(loc);
    const first = await saveProfile(loc, a, { blockName: "Haringhata  Block" });

    // A real Block row in that district, with the spaces tidied, active and audited under the
    // student who typed it.
    expect(first.profileCompleted).toBe(true);
    expect(first.block?.districtId).toBe(loc.district.id);
    expect(first.block?.name).toBe("Haringhata Block");
    expect(first.block?.isActive).toBe(true);
    const log = await db.auditLog.findFirst({ where: { recordType: "Block", recordId: first.blockId! } });
    expect(log?.actorName).toBe(a.user.name);
    expect(log?.userId).toBe(a.user.id);
    expect(log?.description).toContain("student profile");

    // Another student types it differently: same block, no duplicate.
    const b = await freshStudent(loc);
    const second = await saveProfile(loc, b, { blockName: "  haringhata   BLOCK " });
    expect(second.blockId).toBe(first.blockId);
    expect(await blocksNamed(loc.district.id, "Haringhata Block")).toHaveLength(1);

    // The same name in another district is a different block.
    const other = await makeLocation();
    const c = await freshStudent(other);
    const third = await saveProfile(other, c, { blockName: "Haringhata Block" });
    expect(third.blockId).not.toBe(first.blockId);
    expect(third.block?.districtId).toBe(other.district.id);
  });

  it("reuses an existing block when its name is typed, and a picked block by id", async () => {
    const loc = await makeLocation();
    const s = await freshStudent(loc);
    const typed = await saveProfile(loc, s, { blockName: loc.block.name.toUpperCase() });
    expect(typed.blockId).toBe(loc.block.id);

    // Picked from the list: the form sends the id and no name.
    const picked = await saveProfile(loc, s, { blockId: loc.block.id });
    expect(picked.blockId).toBe(loc.block.id);
    expect(await db.block.count({ where: { districtId: loc.district.id } })).toBe(1);
  });

  it("refuses a block from another district with a 422 on blockId, and a district from another state on districtId", async () => {
    const loc = await makeLocation();
    const other = await makeLocation();
    const s = await freshStudent(loc);
    const input = studentProfileSchema.parse(profileBody(loc, s, { blockId: other.block.id }));
    await expect(updateStudentProfile(s.student.id, input, actorOf(s))).rejects.toMatchObject({ status: 422, details: { blockId: expect.any(String) } });

    const crossState = studentProfileSchema.parse({ ...profileBody(loc, s, { blockName: "Somewhere" }), districtId: other.district.id });
    await expect(updateStudentProfile(s.student.id, crossState, actorOf(s))).rejects.toMatchObject({ status: 422, details: { districtId: expect.any(String) } });
    expect(await blocksNamed(other.district.id, "Somewhere")).toHaveLength(0);

    const after = await db.student.findUniqueOrThrow({ where: { id: s.student.id } });
    expect(after.blockId).toBeNull();
    expect(after.profileCompleted).toBe(false);
  });

  it("requires a block — picked or typed — with the error on blockId", async () => {
    const loc = await makeLocation();
    const s = await freshStudent(loc);
    for (const block of [{}, { blockId: "", blockName: "" }, { blockId: null, blockName: null }, { blockName: "   " }]) {
      const parsed = studentProfileSchema.safeParse(profileBody(loc, s, block));
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.some((i) => i.path.join(".") === "blockId" || i.path.join(".") === "blockName")).toBe(true);
    }
    const missing = studentProfileSchema.safeParse(profileBody(loc, s, {}));
    expect(missing.error?.issues.find((i) => i.path.join(".") === "blockId")?.message).toBe("Select or type your block");

    // A typed name must be a plausible place name.
    expect(studentProfileSchema.safeParse(profileBody(loc, s, { blockName: "<b>x</b>" })).success).toBe(false);

    // The service refuses it as well, should a caller skip the schema.
    const input = studentProfileSchema.parse(profileBody(loc, s, { blockId: loc.block.id }));
    await expect(updateStudentProfile(s.student.id, { ...input, blockId: undefined, blockName: undefined }, actorOf(s))).rejects.toMatchObject({
      status: 422,
      details: { blockId: "Select or type your block" },
    });
  });
});

describe("typable block – admin student edit", () => {
  it("sets a typed block, keeps the block when none is sent, and refuses a stale block after a district change", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const { student } = await makeStudent(loc, { withDocuments: false });

    // The edit schema is partial (built from the unrefined fields) and accepts a typed block.
    expect(adminStudentUpdateSchema.safeParse({}).success).toBe(true);
    const typed = await adminUpdateStudent(student.id, adminStudentUpdateSchema.parse({ stateId: loc.state.id, districtId: loc.district.id, blockId: "", blockName: "Santipur" }), { user: admin });
    const santipur = await db.block.findUniqueOrThrow({ where: { id: typed.blockId! } });
    expect(santipur).toMatchObject({ districtId: loc.district.id, name: "Santipur", isActive: true });

    // Nothing about the block (or the same state + district): the student keeps it.
    const kept = await adminUpdateStudent(student.id, adminStudentUpdateSchema.parse({ name: "Renamed Student", stateId: loc.state.id, districtId: loc.district.id }), { user: admin });
    expect(kept.blockId).toBe(santipur.id);
    expect(kept.name).toBe("Renamed Student");

    // Picked by id; a block from another district is refused on blockId.
    const picked = await adminUpdateStudent(student.id, adminStudentUpdateSchema.parse({ blockId: loc.block.id }), { user: admin });
    expect(picked.blockId).toBe(loc.block.id);
    const other = await makeLocation();
    await expect(adminUpdateStudent(student.id, adminStudentUpdateSchema.parse({ blockId: other.block.id }), { user: admin })).rejects.toMatchObject({
      status: 422,
      details: { blockId: expect.any(String) },
    });

    // Another district of the same state without a block: the old block is not in it.
    const district2 = await db.district.create({ data: { stateId: loc.state.id, name: `District ${uid("")}`, code: "Z8Q", slug: uid("d") } });
    await expect(adminUpdateStudent(student.id, adminStudentUpdateSchema.parse({ districtId: district2.id }), { user: admin })).rejects.toMatchObject({
      status: 422,
      details: { blockId: expect.any(String) },
    });
    // A district of another state is refused on districtId, before any block is added.
    await expect(
      adminUpdateStudent(student.id, adminStudentUpdateSchema.parse({ districtId: other.district.id, blockName: "Nowhere Block" }), { user: admin })
    ).rejects.toMatchObject({ status: 422, details: { districtId: expect.any(String) } });
    expect(await blocksNamed(other.district.id, "Nowhere Block")).toHaveLength(0);

    // With a typed block the student moves, and the block is added to the new district.
    const moved = await adminUpdateStudent(student.id, adminStudentUpdateSchema.parse({ districtId: district2.id, blockName: "santipur" }), { user: admin });
    expect(moved.districtId).toBe(district2.id);
    expect(moved.blockId).not.toBe(santipur.id);
    expect((await db.block.findUniqueOrThrow({ where: { id: moved.blockId! } })).districtId).toBe(district2.id);
  });

  it("saves a student who has no address yet, leaving blank required fields alone and clearing blank optional ones", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const s = await freshStudent(loc);
    await db.student.update({ where: { id: s.student.id }, data: { institution: "Old School", occupation: "Farmer" } });

    // A blank required field cannot be sent as "" (the schema needs it filled when present), which is
    // why the drawer leaves blank ones out of the PATCH.
    expect(adminStudentUpdateSchema.safeParse({ address: "" }).success).toBe(false);

    // What the drawer sends for this student: no address fields, nulls for the cleared optional ones.
    const body = adminStudentUpdateSchema.parse({
      name: "No Address Student",
      guardianName: "Guardian Name",
      mobile: s.student.mobile,
      whatsapp: "9876501234",
      email: null,
      stateId: loc.state.id,
      districtId: loc.district.id,
      qualification: "Class 10",
      institution: null,
      passingYear: null,
      occupation: null,
      trainingRequirement: null,
      scholarshipRequired: true,
      status: "ACTIVE",
    });
    const updated = await adminUpdateStudent(s.student.id, body, { user: admin });
    expect(updated).toMatchObject({
      name: "No Address Student",
      qualification: "Class 10",
      address: null,
      villageTown: null,
      pincode: null,
      blockId: null,
      institution: null,
      occupation: null,
      email: null,
      whatsapp: "+919876501234",
      scholarshipRequired: true,
    });
  });
});

describe("typed blocks — retired blocks, the daily quota and spelling", () => {
  it("never hands a deactivated block to a new student, but lets a student already on it save", async () => {
    const loc = await makeLocation();
    const a = await freshStudent(loc);
    const first = await saveProfile(loc, a, { blockName: "Ramnagr" });
    await db.block.update({ where: { id: first.blockId! }, data: { isActive: false } });

    const b = await freshStudent(loc);
    for (const block of [{ blockName: "ramnagr" }, { blockId: first.blockId! }]) {
      await expect(saveProfile(loc, b, block)).rejects.toMatchObject({ status: 422, details: { blockId: expect.stringMatching(/no longer in use/i) } });
    }
    expect(await blocksNamed(loc.district.id, "Ramnagr")).toHaveLength(1);

    // The form sends the saved block's id (and its name for display); typing the same name works too.
    expect((await saveProfile(loc, a, { blockId: first.blockId!, blockName: "Ramnagr" })).blockId).toBe(first.blockId);
    expect((await saveProfile(loc, a, { blockName: "Ramnagr" })).blockId).toBe(first.blockId);
  });

  it("takes no new students into a deactivated district, but lets one already there save", async () => {
    const loc = await makeLocation();
    const there = await freshStudent(loc);
    const elsewhere = await freshStudent(await makeLocation());
    await db.district.update({ where: { id: loc.district.id }, data: { isActive: false } });
    await expect(saveProfile(loc, elsewhere, { blockId: loc.block.id })).rejects.toMatchObject({ status: 422, details: { districtId: expect.any(String) } });
    expect((await saveProfile(loc, there, { blockId: loc.block.id })).districtId).toBe(loc.district.id);
  });

  it("caps how many new blocks one student can add in a day", async () => {
    const loc = await makeLocation();
    const s = await freshStudent(loc);
    for (const name of ["Quota Block A", "Quota Block B", "Quota Block C"]) {
      expect((await saveProfile(loc, s, { blockName: name })).block?.name).toBe(name);
    }
    await expect(saveProfile(loc, s, { blockName: "Quota Block D" })).rejects.toMatchObject({ status: 422, details: { blockId: expect.stringMatching(/too many new blocks/i) } });
    expect(await blocksNamed(loc.district.id, "Quota Block D")).toHaveLength(0);
    // Existing blocks are unaffected by the quota.
    expect((await saveProfile(loc, s, { blockName: "Quota Block A" })).block?.name).toBe("Quota Block A");
  });

  it("treats the precomposed and the combining nukta as one spelling, including older rows", async () => {
    const loc = await makeLocation();
    const precomposed = "ज़मानिया"; // ज़मानिया with U+095B
    const combining = "ज़मानिया"; // ज + nukta + मानिया
    expect(precomposed).not.toBe(combining);

    const a = await freshStudent(loc);
    const first = await saveProfile(loc, a, { blockName: precomposed });
    const b = await freshStudent(loc);
    expect((await saveProfile(loc, b, { blockName: combining })).blockId).toBe(first.blockId);

    // A row saved before names were normalised, in the precomposed spelling, is found as well.
    const other = await makeLocation();
    const legacy = await db.block.create({ data: { districtId: other.district.id, name: "फ़तेहपुर", slug: uid("legacy") } });
    const c = await freshStudent(other);
    expect((await saveProfile(other, c, { blockName: "फ़तेहपुर" })).blockId).toBe(legacy.id);
  });

  it("refuses punctuation-only names and stacked combining marks, but not real Devanagari", () => {
    const loc = { state: { id: "x" }, district: { id: "x" } } as unknown as Loc;
    const s = { student: { name: "S", mobile: "+919000000000" }, user: { email: null } } as unknown as Made;
    const parse = (blockName: string) => studentProfileSchema.safeParse(profileBody(loc, s, { blockName })).error?.issues.find((i) => i.path.join(".") === "blockName")?.message;
    expect(parse("..")).toBeDefined();
    expect(parse("--")).toBeDefined();
    expect(parse("Ź̂̃̄̅algo")).toBeDefined();
    // Consonant + nukta + vowel sign + anusvara is three marks in a row: allowed.
    expect(parse("ज़ींद")).toBeUndefined();
    expect(parse("Ranaghat - II")).toBeUndefined();
  });
});
