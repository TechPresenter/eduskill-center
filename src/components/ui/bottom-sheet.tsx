"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useMediaQuery, usePrefersReducedMotion, useScrollLock } from "@/lib/hooks";
import { IconButton } from "@/components/ui/button";

/* ───────────── Shared overlay helpers (also used by modal.tsx, dropdown.tsx) ───────────── */

const noopSubscribe = () => () => {};

/** `true` once hydrated. Portals return `null` until then so server and client markup match. */
export function useMounted(): boolean {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Exit-animation budget for every overlay (ms). Matches `--animate-slide-down` in globals.css. */
export const OVERLAY_EXIT_MS = 250;

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

/* ───────────── BottomSheet ───────────── */

/** Desktop (≥ sm) width of the dialog / drawer. */
export type BottomSheetSize = "sm" | "md" | "lg" | "xl";
/** Phone height of the sheet. */
export type BottomSheetHeight = "auto" | "half" | "full";

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
  /** Extra classes on the scrollable body (defaults to `px-5 py-2 sm:py-4`). */
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

const WIDTHS: Record<BottomSheetSize, string> = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

const HEIGHTS: Record<BottomSheetHeight, string> = {
  auto: "max-h-[92dvh]",
  half: "h-[50dvh] max-h-[92dvh] sm:h-auto",
  full: "h-dvh max-h-none rounded-none pt-safe sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:pt-0",
};

/** Dragging the handle/header further than this (px) closes the sheet. */
const DRAG_CLOSE_PX = 90;

/**
 * Mobile-first overlay: slides up as an Android-style bottom sheet on phones (grab handle, drag-to-close,
 * safe-area padding) and becomes a centered dialog or a side drawer from `sm` up.
 *
 * Traps focus, closes on Escape, locks body scroll (ref-counted, shared with Modal/Drawer), restores focus
 * to the opener, keeps mounted for the 250ms exit animation and honours prefers-reduced-motion.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  desktop = "modal",
  side = "right",
  size = "md",
  height = "auto",
  backHeader,
  dismissible = true,
  className,
  bodyClassName,
  hideClose,
  "aria-label": ariaLabel,
  initialFocus = "container",
}: BottomSheetProps) {
  const mounted = useMounted();
  const { rendered, closing } = useOverlayPresence(open);
  const isSheet = !useMediaQuery(SHEET_BREAKPOINT_QUERY, true);
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

  const showBack = backHeader ?? height === "full";
  const hasHeader = Boolean(title || description) || !hideClose;

  const desktopPanel =
    desktop === "drawer"
      ? cn("sm:inset-y-0 sm:h-full sm:max-h-full sm:w-full sm:rounded-none sm:pt-safe", side === "left" ? "sm:right-auto sm:left-0" : "sm:right-0 sm:left-auto", WIDTHS[size])
      : cn("sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl", WIDTHS[size]);

  const enter = desktop === "drawer" ? "animate-slide-up sm:animate-slide-in-right" : "animate-slide-up sm:animate-pop";
  const exit =
    desktop === "drawer"
      ? cn("animate-slide-down sm:animate-none sm:transition-transform sm:duration-200 sm:ease-in", side === "left" ? "sm:-translate-x-full" : "sm:translate-x-full")
      : "animate-slide-down sm:animate-none sm:transition sm:duration-200 sm:ease-in sm:scale-95 sm:opacity-0";

  // Drag-to-close (phones only): the handle and header follow the finger, release past the threshold closes.
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isSheet || !dismissible) return;
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
    <div className={cn("fixed inset-0 z-[90]", closing && "pointer-events-none")} data-state={closing ? "closing" : "open"}>
      <div
        className={cn("absolute inset-0 bg-navy/50 backdrop-blur-[1px]", closing ? "opacity-0 transition-opacity duration-200 motion-reduce:transition-none" : "animate-fade-in motion-reduce:animate-none")}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl bg-white shadow-float outline-none pb-safe transition-[translate] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none sm:pb-0",
          HEIGHTS[height],
          closing ? exit : enter,
          desktopPanel,
          className
        )}
        style={dragY ? { translate: `0 ${dragY}px`, transition: "none" } : undefined}
      >
        <div className="shrink-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
          {!showBack && (
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
              <span className="h-1.5 w-12 rounded-full bg-line" />
            </div>
          )}
          {hasHeader && (
            <div className={cn("flex items-start gap-3 px-4 pt-2 pb-3 sm:border-b sm:border-line sm:px-5 sm:py-4", showBack && "items-center border-b border-line py-2 sm:py-3")}>
              {showBack && !hideClose && <IconButton aria-label="Back" icon={<ArrowLeft className="h-5 w-5" />} size="sm" onClick={onClose} className="-ml-1" />}
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 id={titleId} className="text-lg font-bold text-navy">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-0.5 text-sm text-muted">
                    {description}
                  </p>
                )}
              </div>
              {!showBack && !hideClose && <IconButton aria-label="Close" icon={<X className="h-5 w-5" />} size="sm" onClick={onClose} className="-mr-1" />}
            </div>
          )}
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 sm:py-4", bodyClassName)}>{children}</div>
        {footer && <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-3 sm:flex-row sm:justify-end sm:py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
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

/** List of tappable rows inside a sheet (Android "action sheet"): ≥ 56px rows on phones, 48px on sm+. */
export function SheetActions({ items, className }: { items: SheetActionItem[]; className?: string }) {
  return (
    <ul className={cn("-mx-2 divide-y divide-line/60", className)}>
      {items.map((it) => {
        const cls = cn(
          "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium tap-highlight-none transition-colors active:bg-surface sm:min-h-12 sm:hover:bg-surface",
          it.danger ? "text-danger" : "text-ink",
          it.disabled && "pointer-events-none opacity-50"
        );
        const inner = (
          <>
            {it.icon && <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", it.danger ? "bg-danger-light text-danger" : "bg-lavender text-navy")}>{it.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block">{it.label}</span>
              {it.description && <span className="block text-xs font-normal text-muted">{it.description}</span>}
            </span>
          </>
        );
        return (
          <li key={it.label}>
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

/* ───────────── StickyCta ───────────── */

/**
 * Sticky bottom call-to-action bar for phones (renders inline on ≥ lg). Kept for existing callers;
 * new code should prefer `StickyActionBar`, which also measures itself into `--sticky-bar-h`
 * and hides the bottom nav / itself while the keyboard is open.
 */
export function StickyCta({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[45] border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg gap-3 lg:mx-0 lg:max-w-none">{children}</div>
    </div>
  );
}
