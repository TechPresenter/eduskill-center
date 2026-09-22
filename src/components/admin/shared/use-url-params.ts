"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface SetUrlOptions {
  /** Replace the history entry instead of pushing one (used while typing, so Back is not a keystroke). */
  replace?: boolean;
  /** Keep the current `page`. By default any filter change returns to page 1. */
  keepPage?: boolean;
}

/**
 * Merge-updates the current URL's query string. Every navigation runs inside a transition, so callers
 * get a real `pending` flag to show while the server re-renders the list — on a slow connection that
 * feedback is the difference between "it is working" and "it is broken".
 *
 * `undefined`, `null` and `""` all remove a key.
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const get = React.useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  const go = React.useCallback(
    (href: string, replace?: boolean) => {
      startTransition(() => {
        if (replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [router]
  );

  const set = React.useCallback(
    (values: Record<string, string | undefined | null>, opts: SetUrlOptions = {}) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(values)) {
        if (v === undefined || v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      if (!opts.keepPage) sp.delete("page");
      const qs = sp.toString();
      go(qs ? `${pathname}?${qs}` : pathname, opts.replace);
    },
    [pathname, searchParams, go]
  );

  /** Clears every query param except the ones named in `preserve` (e.g. the active tab). */
  const reset = React.useCallback(
    (preserve: string[] = []) => {
      const sp = new URLSearchParams();
      for (const k of preserve) {
        const v = searchParams.get(k);
        if (v) sp.set(k, v);
      }
      const qs = sp.toString();
      go(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, searchParams, go]
  );

  return { get, set, reset, pending, searchParams, pathname };
}
