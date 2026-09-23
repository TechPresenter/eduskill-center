"use client";

import { useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { promptInstall, useInstallPrompt } from "@/components/pwa/use-install-prompt";

const DISMISS_KEY = "esk.install.dismissedAt";
const DISMISS_DAYS = 14;

/**
 * The snooze, as a tiny external store. localStorage is unreadable on the server and can throw
 * outright in a private window or with site data blocked, so it is read through
 * `useSyncExternalStore`: the server and the hydration render both see "dismissed" (nothing shows),
 * and the real answer arrives in one update rather than a render-then-correct.
 */
let dismissedCache: boolean | null = null;
const dismissListeners = new Set<() => void>();

function getDismissed(): boolean {
  if (dismissedCache === null) {
    let at = 0;
    try {
      at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    } catch {
      at = 0;
    }
    dismissedCache = !!at && Date.now() - at < DISMISS_DAYS * 86400000;
  }
  return dismissedCache;
}

function setDismissed(remember: boolean) {
  dismissedCache = true;
  if (remember) {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* dismissed for this page view only */
    }
  }
  for (const l of dismissListeners) l();
}

function subscribeDismissed(onChange: () => void): () => void {
  dismissListeners.add(onChange);
  return () => {
    dismissListeners.delete(onChange);
  };
}

/**
 * Android "Add to Home screen" banner. Appears only when the browser has offered an install prompt,
 * the app is not already installed, and the user has not dismissed it in the last two weeks.
 * Sits above the bottom navigation on phones.
 *
 * The `beforeinstallprompt` event itself is captured once per page by `use-install-prompt`, which
 * this banner and the topbar's "Get the app" button share — the event fires once and `prompt()` may
 * only be called once, so there can be exactly one listener and one owner of the deferred event.
 */
export function InstallPrompt({ appName = "EduSkill" }: { appName?: string }) {
  const { canPrompt, standalone } = useInstallPrompt();
  const dismissed = useSyncExternalStore(subscribeDismissed, getDismissed, () => true);

  if (dismissed || standalone || !canPrompt) return null;

  const install = async () => {
    const outcome = await promptInstall();
    // Accepted: the banner has done its job, so it goes away for this page view. Declined: snooze it
    // for two weeks rather than asking again on the next page.
    setDismissed(outcome !== "accepted");
  };

  return (
    <div className="fixed inset-x-3 z-drawer rounded-card border border-line bg-white p-3 shadow-e3 animate-slide-up motion-reduce:animate-none lg:left-auto lg:right-6 lg:w-96" style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))" }} role="dialog" aria-label="Install app">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBasePath("/icons/icon-192.png")} alt="" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-navy">Install the {appName} app</p>
          <p className="text-xs text-muted">Faster access, full-screen and works from your home screen.</p>
        </div>
        <button type="button" onClick={install} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-orange px-3.5 text-sm font-semibold text-white active:scale-[0.98]">
          <Download className="h-4 w-4" /> Install
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="touch-target -mr-1 inline-flex items-center justify-center rounded-xl text-muted" aria-label="Not now">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
