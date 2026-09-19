"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RecordActionItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  /** Inserts a separator before this item. */
  separator?: boolean;
}

/**
 * 32px on a mouse-driven desktop, 44px on phones and on any coarse pointer, so table rows keep their
 * density while staying tappable (WCAG 2.5.8).
 */
const TRIGGER_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors tap-highlight-none hover:bg-surface hover:text-navy active:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 max-sm:h-11 max-sm:w-11 pointer-coarse:h-11 pointer-coarse:w-11";

export interface RecordActionsProps {
  items?: RecordActionItem[];
  /** Extra rows (e.g. `<ConfirmAction asMenuItem>`); rendered after `items`. */
  children?: React.ReactNode;
  /** Accessible name of the trigger and title of the mobile sheet. Default "Actions". */
  label?: string;
  className?: string;
  /**
   * Render a labelled outline button instead of the "…" icon (for record cards, where a 44px
   * "Manage" button reads better than an overflow glyph).
   */
  triggerLabel?: string;
}

/**
 * "…" menu for table rows and record cards. Accepts link/click items or arbitrary children
 * (e.g. `ConfirmAction asMenuItem`). Below `sm` the shared Dropdown renders the same rows inside a
 * bottom ActionSheet with 56px rows, so nothing is clipped by the table's scroll container.
 */
export function RecordActions({ items = [], children, label = "Actions", className, triggerLabel }: RecordActionsProps) {
  const visible = items.filter((i) => !i.hidden);
  return (
    <Dropdown
      className={className}
      mobile="sheet"
      mobileTitle={label}
      mobileLabel={label}
      trigger={
        triggerLabel ? (
          <button type="button" className={buttonClasses({ variant: "outline", size: "sm" })} aria-label={label}>
            {triggerLabel}
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button type="button" className={TRIGGER_CLASS} aria-label={label}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        )
      }
    >
      {visible.map((it, i) => (
        <React.Fragment key={`${it.label}-${i}`}>
          {it.separator && <DropdownSeparator />}
          {it.href ? (
            <DropdownItem href={it.href} icon={it.icon} danger={it.danger} disabled={it.disabled} className={cn(it.disabled && "pointer-events-none opacity-50")}>
              {it.label}
            </DropdownItem>
          ) : (
            <DropdownItem onClick={it.onClick} danger={it.danger} icon={it.icon} disabled={it.disabled}>
              {it.label}
            </DropdownItem>
          )}
        </React.Fragment>
      ))}
      {children}
    </Dropdown>
  );
}
