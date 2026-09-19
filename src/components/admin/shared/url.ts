/** Server-safe helpers for building admin list URLs from search params. */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Flattens Next.js searchParams to single string values (for Zod list schemas). */
export function flattenParams(sp: SearchParamsRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const f = firstParam(v);
    if (f !== undefined && f !== "") out[k] = f;
  }
  return out;
}

/** Builds `base?…` keeping current params and applying overrides (undefined removes a key). */
export function hrefWith(base: string, current: Record<string, string | undefined>, overrides: Record<string, string | number | undefined | null> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v !== undefined && v !== "") sp.set(k, v);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/** Pagination href builder for a list page. */
export function pageHref(base: string, current: Record<string, string | undefined>) {
  return (page: number) => hrefWith(base, current, { page: page > 1 ? page : undefined });
}

/**
 * Parses list-page search params with a Zod schema. Invalid filter values fall back to
 * pagination + search only, and finally to the schema defaults, so a bad URL never 500s.
 */
export function parseListQuery<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false }; parse: (v: unknown) => T }, sp: Record<string, string>): T {
  const res = schema.safeParse(sp);
  if (res.success) return res.data;
  const minimal: Record<string, string> = {};
  for (const k of ["page", "limit", "q", "sort", "order"]) if (sp[k]) minimal[k] = sp[k]!;
  const retry = schema.safeParse(minimal);
  return retry.success ? retry.data : schema.parse({});
}

/** Removes pagination keys so export/API links carry only the active filters. */
export function filtersOnly(current: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) if (k !== "page" && k !== "limit") out[k] = v;
  return out;
}
