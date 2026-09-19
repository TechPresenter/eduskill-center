"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/** Posts a PAGE_VIEW event on every client-side navigation when internal visitor tracking is enabled. */
export function PageViewTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const last = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!enabled || !pathname) return;
    if (last.current === pathname) return;
    last.current = pathname;
    const payload = JSON.stringify({ type: "PAGE_VIEW", path: pathname });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/public/analytics", blob)) return;
      }
      void fetch("/api/public/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
    } catch {
      /* tracking must never break the page */
    }
  }, [enabled, pathname]);

  return null;
}
