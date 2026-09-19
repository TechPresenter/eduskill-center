import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { generateCenterCode, generateStudentId, nextSequence, renderCodeFormat } from "@/lib/ids";
import { ensureAdmin, makeCenter, makeCourse, makeLocation, uid } from "./helpers";

describe("ID generation", () => {
  it("renders code formats with padding", () => {
    expect(renderCodeFormat("{PREFIX}-{STATE}-{DISTRICT}-{SEQ:4}", { PREFIX: "ESK", STATE: "WB", DISTRICT: "KOL", SEQ: 7 })).toBe("ESK-WB-KOL-0007");
    expect(renderCodeFormat("{PREFIX}{SEQ:2}", { PREFIX: "X", SEQ: 123 })).toBe("X123");
  });

  it("produces strictly unique sequence values under concurrency", async () => {
    const key = `test:${uid()}`;
    const values = await Promise.all(Array.from({ length: 40 }, () => nextSequence(key)));
    expect(new Set(values).size).toBe(40);
    expect(Math.max(...values)).toBe(40);
  });

  it("generates permanent, unique center codes per state/district", async () => {
    const admin = await ensureAdmin();
    const loc = await makeLocation();
    const course = await makeCourse();
    const a = await makeCenter(admin, loc, [course.id]);
    const b = await makeCenter(admin, loc, [course.id]);
    const prefix = `ESK-${loc.state.code.toUpperCase()}-${loc.district.code.toUpperCase()}-`;
    expect(a.code.startsWith(prefix)).toBe(true);
    expect(a.code).not.toBe(b.code);
    expect(Number(b.code.slice(prefix.length))).toBe(Number(a.code.slice(prefix.length)) + 1);
    const c = await generateCenterCode(loc.state.code, loc.district.code);
    expect(c.sequence).toBe(Number(b.code.slice(prefix.length)) + 1);
    // unique constraint prevents duplicates even if someone tried to reuse a code
    await expect(db.center.create({ data: { code: a.code, codeSequence: 1, name: "dup", slug: uid("dup"), stateId: loc.state.id, districtId: loc.district.id, blockId: loc.block.id, address: "x", pincode: "700001" } })).rejects.toThrow();
  });

  it("generates year-scoped student IDs", async () => {
    const id = await generateStudentId();
    expect(id).toMatch(/^ESK-ST-\d{4}-\d{5}$/);
  });
});
