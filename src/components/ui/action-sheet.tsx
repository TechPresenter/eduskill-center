"use client";

import * as React from "react";
import { BottomSheet, SheetActions, type BottomSheetSize } from "@/components/ui/bottom-sheet";

export interface ActionSheetItem {
  label: string;
  icon?: React.ReactNode;
  /** Navigate instead of calling `onSelect`. */
  href?: string;
  /** Called on tap; the sheet closes afterwards. */
  onSelect?: () => void;
  /** Alias of `onSelect` (matches `SheetActions` / `RecordActionItem`). */
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Secondary line under the label. */
  description?: string;
  /** Skip the item entirely (permission-filtered menus). */
  hidden?: boolean;
}

export interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  items: ActionSheetItem[];
  /** Label of the trailing Cancel row. Default "Cancel". */
  cancelLabel?: React.ReactNode;
  /** Desktop dialog width. Default "sm". */
  size?: BottomSheetSize;
  className?: string;
}

/**
 * Quick-actions sheet: `BottomSheet` + `SheetActions` (≥ 56px rows) + a Cancel row.
 * Phones get the bottom sheet, sm+ a small centered dialog. Selecting an item closes the sheet.
 */
export function ActionSheet({ open, onClose, title, description, items, cancelLabel = "Cancel", size = "sm", className }: ActionSheetProps) {
  const visible = items.filter((it) => !it.hidden);
  return (
    <BottomSheet open={open} onClose={onClose} title={title} description={description} aria-label="Actions" size={size} desktop="modal" hideClose className={className} bodyClassName="px-3 pb-1 sm:px-3">
      <SheetActions
        items={visible.map((it) => ({
          label: it.label,
          icon: it.icon,
          href: it.href,
          danger: it.danger,
          disabled: it.disabled,
          description: it.description,
          onClick: () => {
            (it.onSelect ?? it.onClick)?.();
            onClose();
          },
        }))}
      />
      <button
        type="button"
        onClick={onClose}
        className="mt-2 flex min-h-14 w-full items-center justify-center rounded-2xl bg-surface text-[15px] font-semibold text-navy tap-highlight-none transition-colors active:bg-lavender sm:min-h-12 sm:rounded-xl sm:hover:bg-lavender"
      >
        {cancelLabel}
      </button>
    </BottomSheet>
  );
}
