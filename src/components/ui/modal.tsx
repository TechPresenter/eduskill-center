"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { OverlaySurface } from "@/components/ui/bottom-sheet";

/*
 * Modal, Drawer and ConfirmDialog are presets over the one overlay core in
 * bottom-sheet.tsx: same portal, backdrop, focus trap, ref-counted scroll lock,
 * Escape path, radius, elevation, z-index and motion as BottomSheet /
 * ResponsiveSheet / ActionSheet. Props and defaults are unchanged.
 */

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

/** Desktop widths. Literal strings so Tailwind's scanner sees every generated class. */
const MODAL_WIDTHS: Record<ModalSize, string> = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

/**
 * Dialog. Slides up from the bottom on phones (grab handle, drag-to-close, `max-h-[92dvh]`, safe-area
 * padding) and pops in centered from `sm` up. Traps focus, closes on Escape / backdrop, locks body scroll
 * (ref-counted) and stays mounted for its exit animation (skipped under prefers-reduced-motion).
 */
export function Modal({ size = "md", ...rest }: ModalProps) {
  return <OverlaySurface {...rest} phone="sheet" desktop="dialog" widthClassName={MODAL_WIDTHS[size]} />;
}

export interface DrawerProps extends OverlayProps {
  /** Edge the panel slides in from. Default "right". */
  side?: "left" | "right";
}

/**
 * Full-height side panel (max-w-md, override with `className`). Safe-area padded, focus-trapped, Escape
 * and backdrop close it, stays mounted for its exit animation. On phones prefer `ResponsiveSheet`,
 * which renders a bottom sheet instead.
 */
export function Drawer({ side = "right", ...rest }: DrawerProps) {
  return <OverlaySurface {...rest} phone="side" desktop="side" side={side} widthClassName="max-w-md" alwaysHeader />;
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

/** Small confirmation dialog with 44px Cancel + Confirm buttons, stacked on phones. */
export function ConfirmDialog({ open, onClose, onConfirm, title = "Are you sure?", description, confirmLabel = "Confirm", danger, loading, cancelLabel = "Cancel" }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} size="md" loading={loading} onClick={() => void onConfirm()}>
            {loading ? "Please wait…" : confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <div className="text-body text-muted">{description}</div> : null}
    </Modal>
  );
}
