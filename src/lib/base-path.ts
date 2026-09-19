/**
 * Sub-path deployment support — the single source of truth for the URL prefix the app is mounted at.
 *
 * The platform can be served either at a domain root (`https://example.org/`, the default and the
 * local-dev setup) or under a sub-path (`https://eduskillindia.org/center`). The prefix is a
 * BUILD-TIME constant driven by one environment variable:
 *
 *   BASE_PATH=""         → `BASE_PATH` here is `""` and every helper below is a no-op.
 *   BASE_PATH="/center"  → `BASE_PATH` here is `"/center"`.
 *
 * `next.config.ts` reads `BASE_PATH`, normalises it, feeds it to Next's own `basePath`/`assetPrefix`
 * and mirrors it into `NEXT_PUBLIC_BASE_PATH` so this module resolves to the identical string on the
 * server AND inside client bundles. Never read `process.env.BASE_PATH` anywhere else, and never
 * hard-code "/center".
 *
 * WHAT NEEDS `withBasePath()` AND WHAT DOES NOT
 * ---------------------------------------------
 * Next already applies the base path automatically to:
 *   - `<Link href>` and the `next/navigation` router (`push`/`replace`)
 *   - `<Image src>` / static imports and everything under `/_next/`
 *   - `headers()`, `redirects()` and `rewrites()` *sources* in next.config.ts
 *   - `NextResponse.redirect(req.nextUrl.clone())` in middleware (NextURL carries the base path)
 * Those must be left alone — prefixing them by hand produces `/center/center/...`.
 *
 * `withBasePath()` is for RAW STRINGS the framework never sees as routes:
 *   - URLs handed to `fetch()` (see src/lib/api-client.ts)
 *   - `src`/`href` attributes built from a string (uploaded files, `<img src>`, `<a download>`)
 *   - service-worker registration and the web app manifest
 *   - anything written into the database, a PDF/QR code or an email body
 */

/** `""` | `"center"` | `"/center/"` → `""` | `"/center"`. Mirrors `normalizeBasePath()` in next.config.ts. */
export function normalizeBasePath(value: string | undefined | null): string {
  const v = (value ?? "").trim();
  if (!v || v === "/") return "";
  return (v.startsWith("/") ? v : `/${v}`).replace(/\/+$/, "");
}

/**
 * The URL prefix this build is mounted at: `""` at the domain root, `"/center"` under a sub-path.
 * Read through a static `process.env.NEXT_PUBLIC_*` member expression so Next can inline it into
 * client bundles at build time.
 */
export const BASE_PATH: string = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? "");

/** True for `https://…`, `data:…`, `mailto:…`, `tel:…`, `blob:…` and protocol-relative `//host/…`. */
function isExternal(path: string): boolean {
  return path.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(path);
}

/**
 * Prefixes an app-absolute path (`/api/files/x` → `/center/api/files/x`).
 *
 * Returns the input untouched when there is no base path, when the value is already an absolute or
 * scheme URL, when it is relative (`?q=1`, `#top`, `foo/bar`), or when it is already prefixed — so
 * calling it twice is safe. Note `/centers` is NOT treated as already prefixed by `/center`.
 */
export function withBasePath(path: string): string {
  if (!BASE_PATH || !path) return path;
  if (isExternal(path) || !path.startsWith("/")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}

/**
 * Inverse of {@link withBasePath}: `/center/api/files/x` → `/api/files/x`, `/center` → `/`.
 * A path that is not prefixed (an older database row, or a value produced by a root deployment)
 * is returned unchanged, which is what makes both shapes resolve.
 */
export function stripBasePath(path: string): string {
  if (!BASE_PATH || !path) return path;
  if (path === BASE_PATH) return "/";
  if (path.startsWith(`${BASE_PATH}/`)) return path.slice(BASE_PATH.length);
  return path;
}
