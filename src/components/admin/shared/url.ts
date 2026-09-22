/**
 * THE admin URL helpers. Server-safe (no React, no next/navigation), so server pages, client
 * components and route handlers all read list state the same way.
 *
 * The audit found this logic living in two modules — `shared/url.ts` and `pickers/search-params.ts` —
 * with quietly different rules (one dropped empty params, the other kept them; one dropped `page=1`,
 * the other wrote it). This is now the single implementation; `pickers/search-params.ts` re-exports
 * from here under its old names so the pages that import it keep working.
 *
 *   flattenParams / flattenSearchParams   Next's searchParams → Record<string, string>
 *   hrefWith / withParams                 build `base?…` from current params + overrides
 *   pageHref                              the `hrefFor` function `<Pagination>` wants
 *   parseListQuery                        Zod-parse a list query without ever 500-ing on a bad URL
 *   filtersOnly                           strip paging so exports carry only the active filters
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Value written into a query string. `undefined` / `null` / `""` all mean "remove this key". */
export type ParamValue = string | number | boolean | undefined | null;

export function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Flattens Next.js searchParams to single string values (for Zod list schemas). Blanks are dropped. */
export function flattenParams(sp: SearchParamsRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const f = firstParam(v);
    if (f !== undefined && f !== "") out[k] = f;
  }
  return out;
}

/**
 * Builds `base?…` keeping the current params and applying overrides.
 * An override of `undefined`, `null` or `""` removes the key; `false` is written as "false"
 * (a deliberate value), so pass `undefined` to clear a boolean filter.
 */
export function hrefWith(base: string, current: Record<string, string | undefined>, overrides: Record<string, ParamValue> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v !== undefined && v !== "") sp.set(k, v);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * Pagination href builder for a list page — this is what `<Pagination hrefFor>` takes.
 * Page 1 is written as no `page` key at all, so the first page of a list always has one canonical URL
 * (both former Pagers disagreed about this; this is the rule now).
 */
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
  // Dropping offending keys one by one is overkill — keep pagination + search and let the rest reset.
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

/* ── Aliases kept so the `pickers/search-params` call sites read unchanged ── */

/** @deprecated Same function as {@link flattenParams}; kept for the older call sites. */
export const flattenSearchParams = flattenParams;
/** @deprecated Same function as {@link hrefWith}; kept for the older call sites. */
export const withParams = hrefWith;
