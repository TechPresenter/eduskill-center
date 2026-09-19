/** Helpers shared by admin list pages (server-safe, no React). */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Flattens Next's searchParams (arrays → first value, blanks dropped). */
export function flattenSearchParams(sp: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== "") out[k] = val;
  }
  return out;
}

/** Builds `base?…` from the current params plus overrides (undefined removes a key). */
export function withParams(base: string, current: Record<string, string>, overrides: Record<string, string | number | boolean | undefined | null> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) sp.set(k, v);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/** Parses a list query with a Zod schema, falling back to defaults when the URL holds invalid values. */
export function parseListQuery<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } ; parse: (v: unknown) => T }, sp: Record<string, string>): T {
  const res = schema.safeParse(sp);
  if (res.success) return res.data;
  // Drop offending keys one by one is overkill – keep pagination + search only.
  const minimal: Record<string, string> = {};
  for (const k of ["page", "limit", "q", "sort", "order"]) if (sp[k]) minimal[k] = sp[k]!;
  const retry = schema.safeParse(minimal);
  return retry.success ? retry.data : schema.parse({});
}
