import * as React from "react";

/** A store that never changes: the snapshot alone tells the two renders apart. */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` on the server and during the hydration render, `true` from the first client render after
 * hydration onwards.
 *
 * Use it for the small set of values that CANNOT be computed on the server — `window.location`,
 * `navigator.share`, anything measured against `Date.now()` — where rendering the server's answer
 * would be a hydration mismatch, and where the honest first paint is "nothing yet".
 *
 * Why this and not `useState(false)` + `useEffect(() => setMounted(true), [])`: that pattern is a
 * synchronous setState inside an effect, i.e. a second render pass scheduled from a commit, which
 * is exactly what `react-hooks/set-state-in-effect` flags. `useSyncExternalStore` expresses the
 * same idea as a snapshot — React already knows the server render and the client render are
 * different, so it swaps the value itself.
 *
 * Client components only; in a server component it is always `false` and never changes.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
