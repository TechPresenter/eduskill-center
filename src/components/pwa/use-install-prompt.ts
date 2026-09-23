"use client";

import { useSyncExternalStore } from "react";

/**
 * ONE listener for `beforeinstallprompt`, for the whole page.
 *
 * The browser fires that event exactly once per page load, and the deferred event's `prompt()` may
 * be called exactly once. Two components each calling `addEventListener` and keeping their own copy
 * would therefore fight: whichever mounted second might never see the event at all, and whichever
 * prompted second would throw. So the event is captured here, at module scope, and both the install
 * banner (`InstallPrompt`) and the topbar's "Get the app" button read the same store.
 *
 * The listener is attached when this module is first evaluated rather than from an effect, because
 * Chrome can fire `beforeinstallprompt` before React has hydrated.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallState {
  /** A real, usable `beforeinstallprompt` event is held: `promptInstall()` will show the OS sheet. */
  canPrompt: boolean;
  /** The site is already running as an installed app — every "install" affordance must hide. */
  standalone: boolean;
  /** iPhone / iPad Safari, which has no `beforeinstallprompt`: the user adds to the Home Screen by hand. */
  isIOS: boolean;
  /** The app was installed during this page's lifetime (`appinstalled` fired). */
  installed: boolean;
}

const SERVER_STATE: InstallState = { canPrompt: false, standalone: false, isIOS: false, installed: false };

let deferred: BeforeInstallPromptEvent | null = null;
let snapshot: InstallState = SERVER_STATE;
let started = false;
const listeners = new Set<() => void>();

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch {
    /* matchMedia can throw in exotic embedders */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports itself as a Mac, so the touch-point count is what separates it from a desktop.
  const iPadOS = /Macintosh/.test(ua) && typeof document !== "undefined" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

/** Rebuilds the cached snapshot object and notifies subscribers. */
function publish(next: Partial<InstallState>) {
  const merged = { ...snapshot, ...next };
  if (merged.canPrompt === snapshot.canPrompt && merged.standalone === snapshot.standalone && merged.isIOS === snapshot.isIOS && merged.installed === snapshot.installed) {
    return;
  }
  snapshot = merged;
  for (const l of listeners) l();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  publish({ standalone: detectStandalone(), isIOS: detectIOS() });
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    // Suppress Chrome's own mini-infobar; the site offers the install itself.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    publish({ canPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    publish({ canPrompt: false, installed: true, standalone: true });
  });
}

if (typeof window !== "undefined") start();

function subscribe(onChange: () => void): () => void {
  start();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Reads the shared install state. SSR and the hydration render both see `SERVER_STATE`. */
export function useInstallPrompt(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_STATE
  );
}

/**
 * Shows the browser's install sheet and resolves with what the user chose.
 * `"unavailable"` means there was no deferred event to use (already prompted, or unsupported).
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  // The event is single-use: drop it before prompting so a double click cannot call prompt() twice.
  deferred = null;
  publish({ canPrompt: false });
  try {
    await event.prompt();
  } catch {
    return "unavailable";
  }
  const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  if (choice.outcome === "accepted") publish({ installed: true });
  return choice.outcome;
}
