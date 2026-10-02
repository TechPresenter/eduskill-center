import { Errors } from "@/lib/api/errors";
import type { ApiOptions } from "@/lib/api/handler";
import { isUuid } from "@/lib/utils";

/** Route ids are UUIDs; anything else is a clean 404 rather than a database error. */
export function routeId(value: string | string[] | undefined, what: string): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !isUuid(v)) throw Errors.notFound(what);
  return v;
}

/**
 * Every Security Center change is limited per administrator, so a hijacked session cannot sign out,
 * unlock or reset the whole team in a loop.
 */
export const MANAGE_RATE_LIMIT: NonNullable<ApiOptions["rateLimit"]> = { limit: 30, windowSec: 300, keyBy: "user", name: "security-manage" };
