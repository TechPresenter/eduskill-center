/**
 * Moved. The admin URL helpers now live in one place: `@/components/admin/shared/url`.
 * This module re-exports them under the names the existing pages import, so nothing had to
 * change at the call sites. Prefer importing from `@/components/admin/shared` in new code.
 */
export type { SearchParamsRecord as RawSearchParams, ParamValue } from "@/components/admin/shared/url";
export { flattenSearchParams, withParams, parseListQuery, firstParam, filtersOnly, pageHref, hrefWith, flattenParams } from "@/components/admin/shared/url";
