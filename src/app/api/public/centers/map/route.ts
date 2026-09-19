import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { mapCenters } from "@/server/centers";

const schema = z.object({
  stateId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  blockId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
});

/** GET /api/public/centers/map → lightweight markers for every ACTIVE geocoded center (optionally filtered). */
export const GET = apiHandler({ auth: "none", csrf: false, rateLimit: { limit: 60, windowSec: 60, name: "public-centers-map" } }, async ({ req }) => {
  const q = parseQuery(req, schema);
  const centers = await mapCenters(q);
  return { centers };
});
