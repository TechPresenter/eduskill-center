import { z } from "zod";
import { apiHandler, parseQuery } from "@/lib/api/handler";
import { SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LENGTH, SEARCH_MAX_LIMIT, searchSite } from "@/server/search";

const schema = z.object({
  // Short queries are accepted and answered with empty groups, so typing the first letter is not a 422.
  q: z.string().max(SEARCH_MAX_LENGTH * 2).default(""),
  limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).default(SEARCH_DEFAULT_LIMIT),
});

/**
 * Public catalogue search for the header palette and /search: courses, training centres, programs
 * and published FAQs. Called on keystrokes after a client debounce, so the limit is generous per IP.
 */
export const GET = apiHandler({ auth: "none", csrf: false, rateLimit: { limit: 120, windowSec: 60, name: "public-search" } }, async ({ req }) => {
  const q = parseQuery(req, schema);
  return searchSite(q.q, { limit: q.limit });
});
