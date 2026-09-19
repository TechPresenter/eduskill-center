"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { withBasePath } from "@/lib/base-path";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "esk.install.dismissedAt";
const DISMISS_DAYS = 14;

/**
 * Android "Add to Home screen" banner. Appears only when the browser fires beforeinstallprompt,
 * the app is not already installed, and the user has not dismissed it in the last two weeks.
 * Sits above the bottom navigation on phones.
 */
export function InstallPrompt({ appName = "EduSkill" }: { appName?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    } catch {
      dismissedAt = 0;
    }
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !deferred) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome === "accepted") setVisible(false);
    else dismiss();
  };

  return (
    <div className="fixed inset-x-3 z-[60] rounded-2xl border border-line bg-white p-3 shadow-float animate-slide-up lg:left-auto lg:right-6 lg:w-96" style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))" }} role="dialog" aria-label="Install app">
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
        <button type="button" onClick={dismiss} className="touch-target -mr-1 inline-flex items-center justify-center rounded-xl text-muted" aria-label="Not now">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
