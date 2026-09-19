"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks";
import { BottomSheet, SHEET_BREAKPOINT_QUERY } from "@/components/ui/bottom-sheet";

export interface DropdownProps {
  /** The element that toggles the menu (a button; the wrapper adds aria-haspopup / aria-expanded). */
  trigger: React.ReactNode;
  /** Menu content: `DropdownItem`s, `DropdownSeparator`s or any `[role="menuitem"]` elements. */
  children: React.ReactNode;
  /** Horizontal anchor of the desktop menu. Default "right". */
  align?: "left" | "right";
  className?: string;
  /** Extra classes on the anchored desktop menu (e.g. `w-56`). Not applied to the mobile sheet. */
  menuClassName?: string;
  /**
   * Below `sm` (640px): "sheet" (default) shows the items in a `BottomSheet` with 56px rows,
   * "menu" keeps the anchored menu everywhere.
   */
  mobile?: "menu" | "sheet";
  /** Title of the mobile sheet (adds a header with a close button). */
  mobileTitle?: React.ReactNode;
  /** Accessible name of the mobile sheet when it has no title. Default "Menu". */
  mobileLabel?: string;
}

const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);
const MENUITEM_SELECTOR = "[role='menuitem']:not([aria-disabled='true']):not(:disabled)";

/**
 * Click-to-open menu. Desktop: anchored popover with arrow-key navigation, closes on outside click,
 * Escape or item click. Phones (< sm): the same children render inside a BottomSheet (focus-trapped,
 * scroll-locked) so rows are thumb-sized.
 */
export function Dropdown({ trigger, children, align = "right", className, menuClassName, mobile = "sheet", mobileTitle, mobileLabel = "Menu" }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isSm = useMediaQuery(SHEET_BREAKPOINT_QUERY, true);
  const asSheet = mobile === "sheet" && !isSm;
  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open || asSheet) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!NAV_KEYS.has(e.key) || !menuRef.current) return;
      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>(MENUITEM_SELECTOR));
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === "ArrowDown" ? items[(i + 1) % items.length] : e.key === "ArrowUp" ? items[(i - 1 + items.length) % items.length] : e.key === "Home" ? items[0] : items[items.length - 1];
      next.focus();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, asSheet]);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <div onClick={() => setOpen((o) => !o)} aria-haspopup={asSheet ? "dialog" : "menu"} aria-expanded={open}>
        {trigger}
      </div>
      {asSheet ? (
        <BottomSheet open={open} onClose={close} title={mobileTitle} aria-label={mobileLabel} size="sm" hideClose={!mobileTitle} bodyClassName="px-3 pb-2">
          <div
            role="menu"
            className="space-y-0.5 [&_[role=menuitem]]:min-h-14 [&_[role=menuitem]]:rounded-xl [&_[role=menuitem]]:px-3 [&_[role=menuitem]]:text-[15px] [&_[role=separator]]:my-2"
            onClick={close}
          >
            {children}
          </div>
        </BottomSheet>
      ) : (
        open && (
          <div
            ref={menuRef}
            role="menu"
            className={cn(
              "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-line bg-white p-1 shadow-card-hover animate-pop motion-reduce:animate-none",
              align === "right" ? "right-0" : "left-0",
              menuClassName
            )}
            onClick={close}
          >
            {children}
          </div>
        )
      )}
    </div>
  );
}

interface DropdownItemBase {
  /** Red text / red hover for destructive items. */
  danger?: boolean;
  icon?: React.ReactNode;
  /** Secondary line under the label. */
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export type DropdownItemButtonProps = DropdownItemBase & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

export type DropdownItemLinkProps = DropdownItemBase &
  Omit<React.ComponentProps<typeof Link>, "className" | "children" | "href"> & {
    /** Renders a Next `Link` menu item instead of a button. */
    href: string;
    disabled?: boolean;
  };

export type DropdownItemProps = DropdownItemButtonProps | DropdownItemLinkProps;

const ITEM_CLASSES = "flex w-full min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface focus-visible:bg-surface disabled:opacity-50 lg:min-h-0";

/** Splits the presentational props from the ones forwarded to the underlying button / link. */
function splitItemProps<T extends DropdownItemBase>(props: T) {
  const { danger, icon, description, className, children, ...rest } = props;
  return { danger, icon, description, className, children, rest };
}

/** Menu row (button, or `Link` when `href` is set). 44px tall below lg, desktop density at lg+. */
export function DropdownItem(props: DropdownItemProps) {
  const { danger, icon, description, className, children, rest } = splitItemProps(props);
  const classes = cn(ITEM_CLASSES, danger && "text-danger hover:bg-danger-light", className);
  const content = (
    <>
      {icon}
      {description ? (
        <span className="min-w-0 flex-1">
          <span className="block">{children}</span>
          <span className="block text-xs font-normal text-muted">{description}</span>
        </span>
      ) : (
        children
      )}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, disabled, ...linkRest } = rest as Omit<DropdownItemLinkProps, keyof DropdownItemBase>;
    return (
      <Link href={href} role="menuitem" aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} className={cn(classes, disabled && "pointer-events-none opacity-50")} {...linkRest}>
        {content}
      </Link>
    );
  }

  // `rest.href` is `undefined` here; React drops undefined attributes, so nothing reaches the DOM.
  return (
    <button type="button" role="menuitem" className={classes} {...(rest as Omit<DropdownItemButtonProps, keyof DropdownItemBase>)}>
      {content}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-line" role="separator" />;
}
