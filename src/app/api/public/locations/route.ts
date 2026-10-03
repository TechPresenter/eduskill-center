import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, parseQuery } from "@/lib/api/handler";

const schema = z.object({
  stateId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  /** Free-text district search across every state (the "City / District" type-ahead). */
  q: z.string().trim().min(1).max(60).optional(),
  /** Only return locations that have at least one active training center. */
  withCenters: z.union([z.literal("true"), z.literal("false")]).optional(),
});

/**
 * GET /api/public/locations                → active states
 * GET /api/public/locations?stateId=…      → districts of a state
 * GET /api/public/locations?districtId=…   → blocks of a district
 * GET /api/public/locations?q=pun          → districts matching the text, in any state, each with
 *                                            its state name so "Aurangabad, Bihar" and
 *                                            "Aurangabad, Maharashtra" are tellable apart.
 * Add &withCenters=true to restrict to locations with active centers.
 */
export const GET = apiHandler({ auth: "none", csrf: false }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const centerFilter = q.withCenters === "true";
  if (q.q) {
    const rows = await db.district.findMany({
      where: {
        isActive: true,
        state: { isActive: true },
        ...(centerFilter ? { centers: { some: { deletedAt: null, status: "ACTIVE" } } } : {}),
        OR: [{ name: { contains: q.q, mode: "insensitive" } }, { state: { name: { contains: q.q, mode: "insensitive" } } }],
      },
      orderBy: [{ name: "asc" }],
      take: 20,
      select: { id: true, name: true, slug: true, code: true, stateId: true, state: { select: { name: true } } },
    });
    // Prefix matches on the district's own name first — typing "pun" should surface Pune before a
    // district that merely sits in a state whose name contains the text.
    const needle = q.q.toLowerCase();
    const score = (d: (typeof rows)[number]) => (d.name.toLowerCase().startsWith(needle) ? 0 : d.name.toLowerCase().includes(needle) ? 1 : 2);
    const districts = rows
      .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
      .map((d) => ({ id: d.id, name: d.name, slug: d.slug, code: d.code, stateId: d.stateId, stateName: d.state.name }));
    return { districts };
  }
  if (q.districtId) {
    const blocks = await db.block.findMany({
      where: { districtId: q.districtId, isActive: true, ...(centerFilter ? { centers: { some: { deletedAt: null, status: "ACTIVE" } } } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      // Bounded: blocks can be typed in by the public, so the list must never grow without limit.
      take: 500,
      select: { id: true, name: true, slug: true, districtId: true },
    });
    return { blocks };
  }
  if (q.stateId) {
    const districts = await db.district.findMany({
      where: { stateId: q.stateId, isActive: true, ...(centerFilter ? { centers: { some: { deletedAt: null, status: "ACTIVE" } } } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, code: true, stateId: true },
    });
    return { districts };
  }
  const states = await db.state.findMany({
    where: { isActive: true, ...(centerFilter ? { centers: { some: { deletedAt: null, status: "ACTIVE" } } } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, code: true },
  });
  return { states };
});
