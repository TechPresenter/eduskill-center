"use client";

import { useEffect } from "react";

/** Asks the service worker to drop every cached page/API response (called on logout). */
export function purgeOfflineCaches() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "PURGE" });
}

/** Registers the offline-shell service worker. Production only; never in development. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Activate updated workers promptly so users get new assets after a deploy.
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            nw?.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) nw.postMessage({ type: "SKIP_WAITING" });
            });
          });
        })
        .catch(() => undefined);
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });
  }, []);
  return null;
}

export { RegisterSW as ServiceWorkerRegister };
