import * as React from "react";

/** Desktop breakpoint shared by the portal shell (`lg:`): sidebar, desktop header, tables. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
/** Primary input is a finger (phones/tablets); use it to branch on touch-target sizes. */
export const COARSE_POINTER_QUERY = "(pointer: coarse)";

const canMatch = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/**
 * Subscribes to a CSS media query and re-renders when it changes.
 *
 * Server-safe: `ssrDefault` is returned on the server and during hydration, then the real
 * match is applied without a hydration mismatch (useSyncExternalStore).
 *
 * @param query      A media query list string, e.g. `"(min-width: 1024px)"`.
 * @param ssrDefault Value to assume where `matchMedia` is unavailable (server / tests). Default `false`.
 */
export function useMediaQuery(query: string, ssrDefault = false): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!canMatch()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  const getSnapshot = React.useCallback(() => (canMatch() ? window.matchMedia(query).matches : ssrDefault), [query, ssrDefault]);
  const getServerSnapshot = React.useCallback(() => ssrDefault, [ssrDefault]);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** `true` at the `lg` breakpoint and above (defaults to `true` on the server so desktop markup SSRs). */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY, true);
}

/** `true` when the primary pointing device is coarse (touch). Defaults to `false` on the server. */
export function useIsCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY, false);
}
