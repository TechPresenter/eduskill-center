"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsDesktop, useKeyboardOpen } from "@/lib/hooks";
import { useHideBottomNav } from "@/components/portal/header-context";

export interface StickyActionBarProps {
  children: React.ReactNode;
  /**
   * Ask the portal bottom nav to step aside while the bar is on screen (registers `hideBottomNav` in the
   * portal header context; a no-op outside PortalShell) and pins the bar to the very bottom. Default `true`.
   * With `false` the bar stacks above the bottom nav instead.
   */
  hideBottomNav?: boolean;
  /** At `lg`+: render the children inline like `FormActions` ("static", default) or not at all ("hidden"). */
  desktop?: "static" | "hidden";
  className?: string;
  /** Extra classes for the inner flex row (e.g. `flex-col`). */
  innerClassName?: string;
  /**
   * Render a spacer so page content can scroll above the fixed bar. Default `true`; it hides itself inside
   * a portal (`[data-portal]`), whose `<main>` already pads with `pb-safe-nav` from `--sticky-bar-h`.
   */
  spacer?: boolean;
}

const STICKY_BAR_VAR = "--sticky-bar-h";

/**
 * THE sticky bottom action bar (the deprecated `StickyCta` is now an alias of it). Fixed on phones and
 * tablets (below `lg`): opaque white, safe-area padded, hides while the on-screen keyboard is open and
 * publishes its height as `--sticky-bar-h` on `<html>` so `pb-safe-nav`, `Fab` and the Toaster clear it.
 * From `lg` up it renders inline like `FormActions`.
 *
 * Stacking: `z-sticky` (20) — above page content, below the drawer (40) and every overlay (50), so a
 * dialog opened from one of these buttons covers the bar instead of fighting it.
 *
 * No backdrop-blur: it costs a full-screen GPU pass on cheap Android phones, and `backdrop-filter`
 * turns this element into the containing block for any `position: fixed` child.
 *
 * Usable from server components: every prop is serialisable (children are rendered on the server and passed through).
 */
export function StickyActionBar({ children, hideBottomNav = true, desktop = "static", className, innerClassName, spacer = true }: StickyActionBarProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();
  const keyboardOpen = useKeyboardOpen();

  // --sticky-bar-h follows the real bar height only while the bar is fixed (below lg).
  React.useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el || isDesktop) return;
    const apply = () => root.style.setProperty(STICKY_BAR_VAR, `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(STICKY_BAR_VAR);
    };
  }, [isDesktop]);

  // The shell's BottomNav hides (and publishes --bottom-nav-h: 0px) while this registration is active.
  useHideBottomNav(hideBottomNav && !isDesktop);

  return (
    <>
      <div
        ref={ref}
        data-sticky-action-bar=""
        className={cn(
          "fixed inset-x-0 z-sticky border-t border-line bg-white px-4 pt-3 transition-transform duration-element ease-soft motion-reduce:transition-none",
          hideBottomNav ? "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "bottom-[var(--bottom-nav-h)] pb-[max(0.75rem,calc(env(safe-area-inset-bottom)_-_var(--bottom-nav-h)))]",
          keyboardOpen && "pointer-events-none translate-y-full",
          desktop === "hidden" ? "lg:hidden" : "lg:pointer-events-auto lg:static lg:translate-y-0 lg:border-0 lg:bg-transparent lg:p-0 lg:transition-none",
          className
        )}
      >
        <div className={cn("mx-auto flex w-full max-w-lg items-center gap-3 lg:mx-0 lg:max-w-none lg:justify-end lg:border-t lg:border-line lg:pt-5", innerClassName)}>{children}</div>
      </div>
      {spacer && <div aria-hidden className="lg:hidden [[data-portal]_&]:hidden" style={{ height: `var(${STICKY_BAR_VAR})` }} />}
    </>
  );
}
