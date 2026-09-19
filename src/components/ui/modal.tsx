"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useScrollLock } from "@/lib/hooks";
import { Button, IconButton } from "@/components/ui/button";
import { useMounted, useOverlayPresence } from "@/components/ui/bottom-sheet";

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons row: stacked on phones, right-aligned on sm+. */
  footer?: React.ReactNode;
  /** Extra classes on the panel (Drawer callers pass `max-w-*` to widen it). */
  className?: string;
  /**
   * Where keyboard focus lands on open: the dialog itself ("container", default) or the first
   * focusable element ("first"). Focus returns to the opener on close.
   */
  initialFocus?: "first" | "container";
}

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps extends OverlayProps {
  /** sm 28rem, md 32rem (default), lg 42rem, xl 56rem. */
  size?: ModalSize;
  /** Hide the header close button (the footer must then offer a way out). */
  hideClose?: boolean;
}

const MODAL_WIDTHS: Record<ModalSize, string> = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

/**
 * Dialog. Slides up from the bottom on phones (`max-h-[92dvh]`, safe-area padding) and pops in centered
 * from `sm` up. Traps focus, closes on Escape / backdrop, locks body scroll (ref-counted) and keeps mounted
 * for a 250ms exit animation (skipped under prefers-reduced-motion).
 */
export function Modal({ open, onClose, title, description, children, footer, className, size = "md", hideClose, initialFocus = "container" }: ModalProps) {
  const mounted = useMounted();
  const { rendered, closing } = useOverlayPresence(open);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  useScrollLock(rendered);
  useFocusTrap(panelRef, open, { onEscape: onClose, initialFocus });

  if (!rendered || !mounted) return null;
  const hasHeader = Boolean(title || description) || !hideClose;

  return createPortal(
    <div className={cn("fixed inset-0 z-[90] flex items-end justify-center sm:items-center", closing && "pointer-events-none")} data-state={closing ? "closing" : "open"}>
      <div
        className={cn("absolute inset-0 bg-navy/50 backdrop-blur-[2px]", closing ? "opacity-0 transition-opacity duration-200 motion-reduce:transition-none" : "animate-fade-in motion-reduce:animate-none")}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-float outline-none pb-safe motion-reduce:animate-none motion-reduce:transition-none sm:m-4 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:pb-0",
          closing ? "animate-slide-down sm:animate-none sm:transition sm:duration-200 sm:ease-in sm:scale-95 sm:opacity-0" : "animate-slide-up sm:animate-pop",
          MODAL_WIDTHS[size],
          className
        )}
      >
        {hasHeader && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
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
            {!hideClose && <IconButton aria-label="Close" icon={<X className="h-5 w-5" />} size="sm" onClick={onClose} className="-my-2 -mr-2" />}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export interface DrawerProps extends OverlayProps {
  /** Edge the panel slides in from. Default "right". */
  side?: "left" | "right";
}

/**
 * Full-height side panel (max-w-md, override with `className`). Safe-area padded, focus-trapped, Escape
 * and backdrop close it, exit animation kept mounted for 200ms. On phones prefer `ResponsiveSheet`,
 * which renders a bottom sheet instead.
 */
export function Drawer({ open, onClose, title, description, children, footer, className, side = "right", initialFocus = "container" }: DrawerProps) {
  const mounted = useMounted();
  const { rendered, closing } = useOverlayPresence(open);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  useScrollLock(rendered);
  useFocusTrap(panelRef, open, { onEscape: onClose, initialFocus });

  if (!rendered || !mounted) return null;
  const right = side === "right";

  return createPortal(
    <div className={cn("fixed inset-0 z-[90]", closing && "pointer-events-none")} data-state={closing ? "closing" : "open"}>
      <div className={cn("absolute inset-0 bg-navy/50", closing ? "opacity-0 transition-opacity duration-200 motion-reduce:transition-none" : "animate-fade-in motion-reduce:animate-none")} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 flex w-full max-w-md flex-col bg-white shadow-float outline-none pt-safe pb-safe motion-reduce:animate-none motion-reduce:transition-none",
          right ? "right-0" : "left-0",
          closing ? cn("animate-none transition-transform duration-200 ease-in", right ? "translate-x-full" : "-translate-x-full") : right ? "animate-slide-in-right" : "animate-fade-in",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
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
          <IconButton aria-label="Close" icon={<X className="h-5 w-5" />} size="sm" onClick={onClose} className="-my-2 -mr-2" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  /** Disables Confirm and shows a spinner while the action runs. */
  loading?: boolean;
  cancelLabel?: string;
}

/** Small confirmation dialog with 44px (phones) / 44px (desktop md) Cancel + Confirm buttons. */
export function ConfirmDialog({ open, onClose, onConfirm, title = "Are you sure?", description, confirmLabel = "Confirm", danger, loading, cancelLabel = "Cancel" }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {description && <div className="text-sm text-muted">{description}</div>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="md" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={danger ? "danger" : "primary"} size="md" loading={loading} onClick={() => void onConfirm()}>
          {loading ? "Please wait…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
