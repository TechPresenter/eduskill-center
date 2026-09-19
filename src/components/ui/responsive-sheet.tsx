"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BottomSheet, type BottomSheetHeight, type BottomSheetSize } from "@/components/ui/bottom-sheet";
import type { DrawerProps } from "@/components/ui/modal";

export interface ResponsiveSheetProps extends DrawerProps {
  /** Desktop width (sm 28rem, md 32rem, lg 42rem, xl 56rem). Default "md"; a `max-w-*` in `className` still wins. */
  size?: BottomSheetSize;
  /** Phone height. Default "auto". */
  height?: BottomSheetHeight;
  /** Desktop presentation. Default "drawer" (drop-in for `Drawer`). */
  desktop?: "drawer" | "modal";
  hideClose?: boolean;
  dismissible?: boolean;
  bodyClassName?: string;
}

/**
 * Drawer callers pass widths as plain `max-w-*` classes. On the sheet those must only apply from `sm` up
 * (phones are always full-width), so the common tokens are rewritten to their `sm:` variant.
 * Literal strings keep Tailwind's scanner aware of every generated class.
 */
const DRAWER_WIDTHS: Record<string, string> = {
  "max-w-sm": "sm:max-w-sm",
  "max-w-md": "sm:max-w-md",
  "max-w-lg": "sm:max-w-lg",
  "max-w-xl": "sm:max-w-xl",
  "max-w-2xl": "sm:max-w-2xl",
  "max-w-3xl": "sm:max-w-3xl",
  "max-w-4xl": "sm:max-w-4xl",
  "max-w-5xl": "sm:max-w-5xl",
};

/**
 * Drop-in replacement for `Drawer` in the portals: a bottom sheet on phones, the familiar right-hand
 * drawer (or a centered dialog with `desktop="modal"`) from `sm` up. Same props as `Drawer`
 * (`open, onClose, title, description, children, footer, className, side`).
 */
export function ResponsiveSheet({ className, size = "md", desktop = "drawer", side = "right", ...rest }: ResponsiveSheetProps) {
  const mapped = (className ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => DRAWER_WIDTHS[token] ?? token);
  return <BottomSheet {...rest} desktop={desktop} side={side} size={size} className={cn(mapped)} />;
}
