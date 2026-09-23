"use client";

import * as React from "react";
import { Smartphone } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { toast } from "@/components/ui/toast";
import { promptInstall, useInstallPrompt } from "@/components/pwa/use-install-prompt";
import { cn } from "@/lib/utils";

/**
 * "Get the app" — and it has to be honest, because there is no native EduSkill app in either store.
 *
 * The control resolves, in order:
 *   1. a real store listing, when the Foundation has published one and filled in
 *      `app.playStoreUrl` / `app.appStoreUrl` in Admin → Settings → Mobile App;
 *   2. otherwise the browser's own install prompt — this site is a PWA with a manifest and a service
 *      worker, so "installing" it puts a real app icon on the home screen;
 *   3. otherwise, on iPhone/iPad Safari (which has no install prompt), a short sheet explaining the
 *      Share → Add to Home Screen steps;
 *   4. otherwise NOTHING. A desktop browser with no install support gets no button at all, rather
 *      than a button that does nothing when clicked. The same goes for an already-installed app.
 */

/** The iOS share glyph (square with an arrow leaving the top). Drawn inline — lucide has no iOS mark. */
function ShareIOSIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M12 3v12" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

/** The plus-in-a-square that iOS shows beside "Add to Home Screen". */
function AddToHomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export interface DownloadAppButtonProps {
  /** `app.playStoreUrl` — empty until a real Play listing exists. */
  playStoreUrl?: string;
  /** `app.appStoreUrl` — empty until a real App Store listing exists. */
  appStoreUrl?: string;
  appName: string;
  className?: string;
}

/**
 * The gradient pill. Brand-family only: orange → deeper orange, moving its background position on
 * hover rather than running a filter (a `filter` would make this element a containing block, and the
 * topbar sits directly above a sticky header with fixed descendants).
 *
 * The visible pill is 32px tall so it fits a 40px bar; the transparent ::after pads the touch target
 * back out to 44 × 44.
 */
const PILL = cn(
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-semibold whitespace-nowrap text-white",
  // The gradient stays inside the brand orange and only ever gets DARKER, never lighter: white on
  // #E8520A measures 3.72:1 (the level the site's own primary button has always run at) and white on
  // #D94705 measures 4.35:1, so sliding the background right on hover improves the label rather than
  // washing it out. A lighter stop would have dropped it to ~3:1.
  "bg-linear-to-r from-orange via-[#DC4A07] to-orange-hover bg-[length:200%_100%] bg-left",
  "ring-focus-inverse tap-highlight-none select-none",
  "transition-[background-position,transform] duration-element ease-soft hover:bg-right motion-reduce:transition-none",
  "motion-safe:hover:-translate-y-px active:scale-[0.98]",
  "after:absolute after:-inset-x-2 after:-inset-y-1.5 after:rounded-full after:content-['']"
);

export function DownloadAppButton({ playStoreUrl = "", appStoreUrl = "", appName, className }: DownloadAppButtonProps) {
  const { canPrompt, standalone, isIOS } = useInstallPrompt();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const storeUrl = (isIOS ? appStoreUrl : playStoreUrl).trim();
  const label = (
    <>
      <Smartphone className="h-3.5 w-3.5" aria-hidden />
      <span>Get the app</span>
    </>
  );

  // Already running as an installed app — there is nothing left to offer.
  if (standalone) return null;

  if (storeUrl && /^https?:\/\//i.test(storeUrl)) {
    return (
      <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={cn(PILL, className)} aria-label={`Get the ${appName} app (opens in a new tab)`}>
        {label}
      </a>
    );
  }

  if (canPrompt) {
    const install = async () => {
      setBusy(true);
      const outcome = await promptInstall();
      setBusy(false);
      if (outcome === "accepted") toast.success(`Installing the ${appName} app — look for it on your home screen.`);
      else if (outcome === "unavailable") toast.error("Your browser could not open the install prompt just now.");
    };
    return (
      <button type="button" onClick={install} disabled={busy} className={cn(PILL, "disabled:opacity-70", className)} aria-label={`Install the ${appName} app on this device`}>
        {label}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button type="button" onClick={() => setSheetOpen(true)} className={cn(PILL, className)} aria-haspopup="dialog" aria-expanded={sheetOpen} aria-label={`How to add ${appName} to your Home Screen`}>
          {label}
        </button>
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={`Add ${appName} to your Home Screen`} description="Two taps in Safari and the site opens like an app — full screen, with its own icon.">
          <ol className="grid gap-3">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-navy" aria-hidden>
                <ShareIOSIcon className="h-5 w-5" />
              </span>
              <p className="text-body text-ink">
                Tap <strong className="font-semibold">Share</strong> in the Safari toolbar.
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-navy" aria-hidden>
                <AddToHomeIcon className="h-5 w-5" />
              </span>
              <p className="text-body text-ink">
                Choose <strong className="font-semibold">Add to Home Screen</strong>, then tap Add.
              </p>
            </li>
          </ol>
          <p className="mt-4 text-body-sm text-muted">This installs the website itself. There is no separate download, and it uses almost no storage.</p>
        </BottomSheet>
      </>
    );
  }

  // No store listing, no install prompt, not iOS: show nothing rather than a dead control.
  return null;
}
