"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useMediaQuery, usePrefersReducedMotion, useScrollLock } from "@/lib/hooks";
import { IconButton } from "@/components/ui/button";
import { IconTile } from "@/components/ui/list";
import { StickyActionBar, type StickyActionBarProps } from "@/components/ui/sticky-action-bar";

/* ═══════════════════════════════════════════════════════════════════════════
 * THE overlay core.
 * ---------------------------------------------------------------------------
 * Every dismissible layer in the product — Modal, Drawer, BottomSheet,
 * ResponsiveSheet, ActionSheet and the Dropdown's phone sheet — renders through
 * `OverlaySurface` below. One portal, one backdrop, one focus trap, one
 * ref-counted scroll lock, one Escape path, one exit-presence budget, one
 * radius, one elevation and one motion pair. Before this there were two
 * systems that looked almost the same and behaved differently (rounded-t-2xl
 * vs rounded-t-3xl, blurred vs plain backdrop, z-[90] vs z-[90] vs z-50).
 *
 * The public components are thin presets over it. Their props and defaults are
 * unchanged — this is an internal unification, not an API change.
 *
 * Tokens used (src/app/globals.css): shadow-e3, rounded-t-2xl / rounded-2xl,
 * z-overlay, --duration-overlay / --duration-element, --ease-out-soft.
 *
 * ⚠ No backdrop-blur anywhere in here. Besides costing a full-screen GPU pass
 * on the cheap Android phones most of our students use, `backdrop-filter`
 * creates a containing block for `position: fixed` descendants — the bug that
 * clamped the mobile menu to its header and made the admin Fab disappear.
 * ═══════════════════════════════════════════════════════════════════════════ */

const noopSubscribe = () => () => {};

/** `true` once hydrated. Portals return `null` until then so server and client markup match. */
export function useMounted(): boolean {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Exit-animation budget for every overlay (ms). Matches `--duration-overlay`
 * (350ms) in globals.css, which is what `animate-slide-down` actually runs for —
 * the old 250ms budget unmounted the panel a third of the way through its exit.
 */
export const OVERLAY_EXIT_MS = 350;

/** Overlays switch from the phone bottom sheet to the desktop dialog / drawer at Tailwind's `sm` (640px). */
export const SHEET_BREAKPOINT_QUERY = "(min-width: 640px)";

/**
 * Keeps an overlay mounted for `durationMs` after `open` turns false so its exit animation can play.
 * `rendered` says whether to mount the portal, `closing` whether to apply the exit classes.
 * Under prefers-reduced-motion the overlay unmounts on the next tick instead of animating.
 */
export function useOverlayPresence(open: boolean, durationMs = OVERLAY_EXIT_MS): { rendered: boolean; closing: boolean } {
  const reduce = usePrefersReducedMotion();
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [closing, setClosing] = React.useState(false);
  // Derived-state pattern: react to the prop flip during render (no setState inside an effect).
  if (open !== prevOpen) {
    setPrevOpen(open);
    setClosing(!open);
  }
  React.useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => setClosing(false), reduce ? 0 : durationMs);
    return () => window.clearTimeout(t);
  }, [closing, reduce, durationMs]);
  const isClosing = closing && !open;
  return { rendered: open || isClosing, closing: isClosing };
}

/* ───────────── Shared vocabulary ───────────── */

/** Desktop (≥ sm) width of the dialog / drawer. */
export type BottomSheetSize = "sm" | "md" | "lg" | "xl";
/** Phone height of the sheet. */
export type BottomSheetHeight = "auto" | "half" | "full";

/** How the panel presents itself below `sm`. */
type PhoneForm = "sheet" | "side";
/** How the panel presents itself from `sm` up. */
type DesktopForm = "dialog" | "side";

/** Desktop widths. Literal strings so Tailwind's scanner sees every generated class. */
const WIDTHS: Record<BottomSheetSize, string> = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

const HEIGHTS: Record<BottomSheetHeight, string> = {
  auto: "max-h-[92dvh]",
  half: "h-[50dvh] max-h-[92dvh] sm:h-auto",
  // No sm:pt-0 here — the desktop branch of `shape()` owns the top padding, so a full-height sheet
  // that becomes a side drawer at sm+ keeps its safe-area inset instead of fighting two equal classes.
  full: "h-dvh max-h-none rounded-none pt-safe sm:h-auto sm:max-h-full sm:rounded-2xl",
};

/** Dragging the handle/header further than this (px) closes the sheet. */
const DRAG_CLOSE_PX = 90;

/** One backdrop for every overlay: flat navy scrim, no blur, fades on the micro step. */
const BACKDROP = "absolute inset-0 bg-navy/55";

/** Shared chrome. Header, body and footer read the same in a dialog, a drawer and a sheet. */
const HEADER_CLASSES = "flex items-start gap-3 border-b border-line px-5 py-3 sm:py-4";
const BODY_CLASSES = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4";
const FOOTER_CLASSES = "flex shrink-0 flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:justify-end";

export interface OverlaySurfaceProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  hideClose?: boolean;
  /** When `false`, backdrop tap, Escape and drag-down do not close the overlay. Default `true`. */
  dismissible?: boolean;
  initialFocus?: "first" | "container";
  "aria-label"?: string;
  /** Presentation below `sm`. */
  phone: PhoneForm;
  /** Presentation from `sm` up. */
  desktop: DesktopForm;
  /** Edge a side panel attaches to. Default "right". */
  side?: "left" | "right";
  /** Width classes (already `sm:`-scoped for sheets, unscoped for an always-side Drawer). */
  widthClassName?: string;
  /** Phone height of a sheet. Ignored by side panels. */
  height?: BottomSheetHeight;
  /** Grab handle + drag-to-close on the phone sheet. Default `true` when `phone === "sheet"`. */
  handle?: boolean;
  /** Replace the trailing X with a leading back arrow (full-height sheets). */
  backHeader?: boolean;
  /** Render the header even when there is no title, description or close button. */
  alwaysHeader?: boolean;
}

/**
 * The single overlay implementation. Not exported from the design system's public surface — use
 * `Modal`, `Drawer`, `BottomSheet`, `ResponsiveSheet` or `ActionSheet`, which are presets over it.
 *
 * Centring is done with flexbox, never a transform: a finished `fill-mode: both` animation leaves an
 * identity matrix behind, and a transformed ancestor silently becomes the containing block for any
 * `position: fixed` child rendered inside the panel.
 */
export function OverlaySurface({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
  hideClose,
  dismissible = true,
  initialFocus = "container",
  "aria-label": ariaLabel,
  phone,
  desktop,
  side = "right",
  widthClassName,
  height = "auto",
  handle,
  backHeader,
  alwaysHeader,
}: OverlaySurfaceProps) {
  const mounted = useMounted();
  const { rendered, closing } = useOverlayPresence(open);
  const isPhone = !useMediaQuery(SHEET_BREAKPOINT_QUERY, true);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const startY = React.useRef<number | null>(null);
  const [dragY, setDragY] = React.useState(0);

  const close = React.useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  useScrollLock(rendered);
  useFocusTrap(panelRef, open, { onEscape: dismissible ? onClose : undefined, initialFocus });

  if (!rendered || !mounted) return null;

  const right = side !== "left";
  const isSheet = phone === "sheet";
  const showBack = backHeader ?? (isSheet && height === "full");
  const hasHeader = alwaysHeader || Boolean(title || description) || !hideClose;
  const showHandle = isSheet && (handle ?? true) && !showBack && dismissible;
  const canDrag = isSheet && isPhone && dismissible;

  /* Alignment lives on the fixed container, so the panel itself never needs a centring transform. */
  const align = cn(
    "fixed inset-0 z-overlay flex",
    isSheet ? "items-end justify-center" : right ? "items-stretch justify-end" : "items-stretch justify-start",
    desktop === "dialog" ? "sm:items-center sm:justify-center sm:p-4" : right ? "sm:items-stretch sm:justify-end sm:p-0" : "sm:items-stretch sm:justify-start sm:p-0"
  );

  const shape = cn(
    isSheet ? "rounded-t-2xl pb-safe" : "h-full pt-safe pb-safe",
    isSheet && HEIGHTS[height],
    desktop === "dialog" ? "sm:max-h-full sm:rounded-2xl sm:pt-0 sm:pb-0" : "sm:h-full sm:max-h-full sm:rounded-none sm:pt-safe sm:pb-safe"
  );

  /* One motion pair: rise from the edge it belongs to, leave the same way. */
  const enter = cn(
    isSheet ? "animate-slide-up" : right ? "animate-slide-in-right" : "animate-fade-in",
    // There is no slide-in-left keyframe, so a left-hand panel fades in — at every width. The old
    // BottomSheet applied sm:animate-slide-in-right to both sides, which slid a left drawer in from the right.
    desktop === "dialog" ? "sm:animate-pop" : right ? "sm:animate-slide-in-right" : "sm:animate-fade-in"
  );
  const exitBase = isSheet
    ? "animate-slide-down"
    : cn("animate-none transition-transform ease-soft duration-overlay", right ? "translate-x-full" : "-translate-x-full");
  const exitDesktop =
    desktop === "dialog"
      ? "sm:animate-none sm:scale-95 sm:opacity-0 sm:transition sm:ease-soft sm:duration-overlay"
      : cn("sm:animate-none sm:transition-transform sm:ease-soft sm:duration-overlay", right ? "sm:translate-x-full" : "sm:-translate-x-full");

  // Drag-to-close (phone sheets only): the handle and header follow the finger, release past the threshold closes.
  const onTouchStart = (e: React.TouchEvent) => {
    if (!canDrag) return;
    startY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
    setDragY(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    const shouldClose = dragY > DRAG_CLOSE_PX;
    startY.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  };

  return createPortal(
    <div className={cn(align, closing && "pointer-events-none")} data-state={closing ? "closing" : "open"} data-overlay="">
      <div className={cn(BACKDROP, closing ? "opacity-0 transition-opacity duration-element motion-reduce:transition-none" : "animate-fade-in motion-reduce:animate-none")} onClick={close} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex w-full flex-col bg-white shadow-e3 outline-none motion-reduce:animate-none motion-reduce:transition-none",
          shape,
          closing ? cn(exitBase, exitDesktop) : enter,
          widthClassName,
          className
        )}
        style={
          canDrag
            ? {
                translate: dragY ? `0 ${dragY}px` : undefined,
                transitionProperty: "translate",
                transitionDuration: dragY ? "0ms" : "var(--duration-element)",
                transitionTimingFunction: "var(--ease-out-soft)",
              }
            : undefined
        }
      >
        {(showHandle || hasHeader) && (
          <div className="shrink-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
            {showHandle && (
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
                <span className="h-1.5 w-12 rounded-full bg-line" />
              </div>
            )}
            {hasHeader && (
              <div className={cn(HEADER_CLASSES, showBack && "items-center")}>
                {showBack && !hideClose && <IconButton aria-label="Back" icon={<ArrowLeft className="h-5 w-5" />} size="sm" onClick={onClose} className="-my-1 -ml-2" />}
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 id={titleId} className="text-h3 text-navy">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descId} className="mt-1 text-body-sm text-muted">
                      {description}
                    </p>
                  )}
                </div>
                {!showBack && !hideClose && <IconButton aria-label="Close" icon={<X className="h-5 w-5" />} size="sm" onClick={onClose} className="-my-1 -mr-2" />}
              </div>
            )}
          </div>
        )}
        <div className={cn(BODY_CLASSES, bodyClassName)}>{children}</div>
        {footer && <div className={FOOTER_CLASSES}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ───────────── BottomSheet ───────────── */

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky footer (buttons stack on phones, right-aligned row on sm+). Sits above the safe area. */
  footer?: React.ReactNode;
  /** Desktop presentation (≥ sm): centered dialog or side drawer. Default "modal". */
  desktop?: "modal" | "drawer";
  /** Side of the desktop drawer (only with `desktop="drawer"`). Default "right". */
  side?: "left" | "right";
  /** Desktop width: sm 28rem, md 32rem, lg 42rem, xl 56rem. Default "md". */
  size?: BottomSheetSize;
  /**
   * Phone height: "auto" grows with content up to 92dvh (default), "half" is a fixed 50dvh,
   * "full" covers the screen (no rounded corners, back-arrow header). Desktop is unaffected.
   */
  height?: BottomSheetHeight;
  /** Show an ArrowLeft "Back" button on the left instead of the X on the right. Default: `height === "full"`. */
  backHeader?: boolean;
  /** When `false`, backdrop tap, Escape and drag-down do not close the sheet (offer a button instead). Default `true`. */
  dismissible?: boolean;
  /** Extra classes on the panel (e.g. `sm:max-w-3xl` to widen the desktop drawer). */
  className?: string;
  /** Extra classes on the scrollable body (defaults to `px-5 py-4`). */
  bodyClassName?: string;
  /** Hide the close / back button (e.g. when the footer already has Cancel). */
  hideClose?: boolean;
  /** Accessible name when there is no `title` (e.g. "Actions"). */
  "aria-label"?: string;
  /**
   * Where keyboard focus lands on open: the dialog itself ("container", default – screen readers announce the
   * title and Tab reaches the first control) or the first focusable element ("first").
   */
  initialFocus?: "first" | "container";
}

/**
 * Mobile-first overlay: slides up as an Android-style bottom sheet on phones (grab handle, drag-to-close,
 * safe-area padding) and becomes a centered dialog or a side drawer from `sm` up.
 *
 * Traps focus, closes on Escape, locks body scroll (ref-counted, shared with Modal/Drawer), restores focus
 * to the opener, keeps mounted for the exit animation and honours prefers-reduced-motion.
 */
export function BottomSheet({ desktop = "modal", size = "md", side = "right", ...rest }: BottomSheetProps) {
  return <OverlaySurface {...rest} phone="sheet" desktop={desktop === "drawer" ? "side" : "dialog"} side={side} widthClassName={WIDTHS[size]} />;
}

/* ───────────── SheetActions ───────────── */

export interface SheetActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Renders the row as a link (internal or external). `onClick` still fires. */
  href?: string;
  danger?: boolean;
  description?: string;
  disabled?: boolean;
}

/**
 * List of tappable rows inside a sheet (Android "action sheet"): ≥ 56px rows on phones, 48px on sm+.
 *
 * Note the colour sits on the `<li>`, not the row: `cn()` runs tailwind-merge, which reads any
 * unknown `text-*` class as a text colour and would drop `text-body` when a colour follows it.
 */
export function SheetActions({ items, className }: { items: SheetActionItem[]; className?: string }) {
  return (
    <ul className={cn("-mx-2 divide-y divide-line/60", className)}>
      {items.map((it) => {
        const cls = cn(
          "flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-body font-medium tap-highlight-none transition-colors duration-micro sm:min-h-12",
          it.danger ? "active:bg-danger-light sm:hover:bg-danger-light" : "active:bg-lavender sm:hover:bg-surface",
          it.disabled && "pointer-events-none opacity-50"
        );
        const inner = (
          <>
            {it.icon && <IconTile tone={it.danger ? "danger" : "navy"}>{it.icon}</IconTile>}
            <span className="min-w-0 flex-1">
              <span className="block">{it.label}</span>
              {it.description && <span className="mt-0.5 block font-normal text-muted text-body-sm">{it.description}</span>}
            </span>
          </>
        );
        return (
          <li key={it.label} className={it.danger ? "text-danger" : "text-ink"}>
            {it.href ? (
              <Link href={it.href} className={cls} onClick={it.onClick} aria-disabled={it.disabled || undefined} tabIndex={it.disabled ? -1 : undefined}>
                {inner}
              </Link>
            ) : (
              <button type="button" className={cls} onClick={it.onClick} disabled={it.disabled}>
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────── StickyCta (deprecated) ───────────── */

/**
 * @deprecated Use `StickyActionBar` directly. This is now a thin alias of it, so the two sticky
 * bottom bars that used to exist (different z-index, different keyboard handling, no
 * `--sticky-bar-h` measurement) behave identically at every call site.
 */
export function StickyCta({ children, className, ...rest }: StickyActionBarProps) {
  return (
    <StickyActionBar {...rest} className={className}>
      {children}
    </StickyActionBar>
  );
}
