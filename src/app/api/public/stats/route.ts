import { apiHandler } from "@/lib/api/handler";
import { coverageStats } from "@/server/centers";
import { getImpactStats } from "@/server/public";

/** GET /api/public/stats → resolved impact statistics and real coverage numbers. */
export const GET = apiHandler({ auth: "none", csrf: false, rateLimit: { limit: 60, windowSec: 60, name: "public-stats" } }, async () => {
  const [impact, coverage] = await Promise.all([getImpactStats(), coverageStats()]);
  return { impact, coverage };
});
