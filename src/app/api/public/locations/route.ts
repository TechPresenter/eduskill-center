import { z } from "zod";
import { db } from "@/lib/db";
import { apiHandler, parseQuery } from "@/lib/api/handler";

const schema = z.object({
  stateId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  /** Only return locations that have at least one active training center. */
  withCenters: z.union([z.literal("true"), z.literal("false")]).optional(),
});

/**
 * GET /api/public/locations                → active states
 * GET /api/public/locations?stateId=…      → districts of a state
 * GET /api/public/locations?districtId=…   → blocks of a district
 * Add &withCenters=true to restrict to locations with active centers.
 */
export const GET = apiHandler({ auth: "none", csrf: false }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const centerFilter = q.withCenters === "true";
  if (q.districtId) {
    const blocks = await db.block.findMany({
      where: { districtId: q.districtId, isActive: true, ...(centerFilter ? { centers: { some: { deletedAt: null, status: "ACTIVE" } } } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
