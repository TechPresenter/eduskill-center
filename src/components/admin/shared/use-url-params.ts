"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Merge-updates the current URL's query string (resets `page`). */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = React.useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  const set = React.useCallback(
    (values: Record<string, string | undefined | null>, opts: { replace?: boolean; keepPage?: boolean } = {}) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(values)) {
        if (v === undefined || v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      if (!opts.keepPage) sp.delete("page");
      const qs = sp.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (opts.replace) router.replace(href);
      else router.push(href);
    },
    [router, pathname, searchParams]
  );

  const reset = React.useCallback(() => router.push(pathname), [router, pathname]);

  return { get, set, reset, searchParams, pathname };
}
