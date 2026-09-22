"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useKeyboardOpen } from "@/lib/hooks";

export interface FabProps {
  /** Required: the button is icon-only unless `extended`. */
  "aria-label": string;
  icon: React.ReactNode;
  /** Text shown next to the icon when `extended`. */
  label?: React.ReactNode;
  /** Pill with icon + label. Default: `true` when `label` is given. */
  extended?: boolean;
  /** Renders a Next `Link` instead of a button. */
  href?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  disabled?: boolean;
  tone?: "orange" | "navy";
  className?: string;
  /** Hide from `lg` up (desktop pages expose the action in their header). Default `true`. */
  hideOnDesktop?: boolean;
}

const TONES = { orange: "bg-orange text-white hover:bg-orange-hover", navy: "bg-navy text-white hover:bg-navy-dark" };

/**
 * Floating action button pinned to the bottom-right corner, above the bottom nav / sticky action bar
 * and the gesture area (`--bottom-nav-h`, `--sticky-bar-h`, safe-area inset). Hidden while the
 * on-screen keyboard is open and, by default, on desktop.
 */
export function Fab({ "aria-label": ariaLabel, icon, label, extended = label !== undefined, href, onClick, disabled, tone = "orange", className, hideOnDesktop = true }: FabProps) {
  const keyboardOpen = useKeyboardOpen();
  const classes = cn(
    // z-sticky, shadow-e3 and duration-micro are the tokens: the FAB is the one button in the product
    // that is genuinely floating, so it is also the only one carrying an elevation.
    "fixed z-sticky flex h-14 min-w-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-e3 tap-highlight-none ring-focus-inverse focus-visible:ring-0 focus-visible:ring-offset-0 transition-[transform,opacity,translate] duration-micro active:scale-95 motion-reduce:transition-none",
    "right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(var(--bottom-nav-h)_+_var(--sticky-bar-h)_+_env(safe-area-inset-bottom)_+_1rem)]",
    TONES[tone],
    extended ? "px-5" : "w-14",
    keyboardOpen && "pointer-events-none translate-y-6 opacity-0",
    disabled && "pointer-events-none opacity-50",
    hideOnDesktop && "lg:hidden",
    className
  );
  const content = (
    <>
      <span className="flex h-6 w-6 items-center justify-center" aria-hidden>
        {icon}
      </span>
      {extended && label && <span>{label}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} onClick={onClick} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={ariaLabel} disabled={disabled} onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
