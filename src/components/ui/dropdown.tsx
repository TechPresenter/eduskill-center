"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
 * Escape or item click. Phones (< sm): the same children render inside the shared overlay core as a
 * BottomSheet (focus-trapped, scroll-locked) so rows are thumb-sized.
 *
 * The popover is a surface like any other: `rounded-lg`, `shadow-e3`, `z-overlay`, `animate-pop`.
 */
export function Dropdown({ trigger, children, align = "right", className, menuClassName, mobile = "sheet", mobileTitle, mobileLabel = "Menu" }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isSm = useMediaQuery(SHEET_BREAKPOINT_QUERY, true);
  const asSheet = mobile === "sheet" && !isSm;
  const close = React.useCallback(() => setOpen(false), []);
  // Desktop menu position, measured from the trigger. The menu is portalled to <body> and `fixed`, so a
  // scrolling ancestor (TableWrap is overflow-x:auto, which forces overflow-y:auto) can never clip it.
  const [pos, setPos] = React.useState<{ top: number; left?: number; right?: number } | null>(null);

  // Forget the last position when the menu closes (render-phase reset, not an effect), so the next
  // open is measured afresh instead of flashing at the old spot.
  const [lastOpen, setLastOpen] = React.useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (!open) setPos(null);
  }

  React.useLayoutEffect(() => {
    if (!open || asSheet) return;
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const menuH = menuRef.current?.offsetHeight ?? 0;
      const gap = 8;
      const below = r.bottom + gap;
      // Flip above the trigger when the menu would run off the bottom of the viewport.
      const top = menuH && below + menuH > window.innerHeight - gap && r.top - gap - menuH > gap ? r.top - gap - menuH : below;
      setPos(align === "right" ? { top, right: Math.max(gap, document.documentElement.clientWidth - r.right) } : { top, left: Math.max(gap, r.left) });
    };
    place();
    // A second pass once the menu has rendered and has a height to flip with.
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, asSheet, align]);

  React.useEffect(() => {
    if (!open || asSheet) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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
        <BottomSheet open={open} onClose={close} title={mobileTitle} aria-label={mobileLabel} size="sm" hideClose={!mobileTitle} bodyClassName="px-3 py-3">
          <div role="menu" className="space-y-1 [&_[role=menuitem]]:min-h-14 [&_[role=menuitem]]:rounded-md [&_[role=menuitem]]:px-3 [&_[role=menuitem]]:text-body [&_[role=separator]]:my-2" onClick={close}>
            {children}
          </div>
        </BottomSheet>
      ) : (
        open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={pos ? { top: pos.top, left: pos.left, right: pos.right } : { top: 0, left: 0, visibility: "hidden" }}
            className={cn("fixed z-overlay min-w-[12rem] overflow-hidden rounded-lg border border-line bg-white p-1 shadow-e3 animate-pop motion-reduce:animate-none", menuClassName)}
            onClick={close}
          >
            {children}
          </div>,
          document.body
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

const ITEM_CLASSES = "flex w-full min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-ink tap-highlight-none transition-colors duration-micro hover:bg-surface focus-visible:bg-surface active:bg-lavender disabled:opacity-50 lg:min-h-0";

/** Splits the presentational props from the ones forwarded to the underlying button / link. */
function splitItemProps<T extends DropdownItemBase>(props: T) {
  const { danger, icon, description, className, children, ...rest } = props;
  return { danger, icon, description, className, children, rest };
}

/**
 * Menu row (button, or `Link` when `href` is set). 44px tall below lg, desktop density at lg+.
 *
 * `text-body-sm` is appended after `cn()` on purpose: tailwind-merge reads any unrecognised `text-*`
 * class as a text colour, so a `text-danger` merged in later would silently delete the type-scale class.
 */
export function DropdownItem(props: DropdownItemProps) {
  const { danger, icon, description, className, children, rest } = splitItemProps(props);
  const base = cn(ITEM_CLASSES, danger && "text-danger hover:bg-danger-light", className);
  const classes = `${base} text-body-sm`;
  const content = (
    <>
      {icon}
      {description ? (
        <span className="min-w-0 flex-1">
          <span className="block">{children}</span>
          <span className="mt-0.5 block font-normal text-muted text-caption">{description}</span>
        </span>
      ) : (
        children
      )}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, disabled, ...linkRest } = rest as Omit<DropdownItemLinkProps, keyof DropdownItemBase>;
    return (
      <Link href={href} role="menuitem" aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} className={`${cn(base, disabled && "pointer-events-none opacity-50")} text-body-sm`} {...linkRest}>
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
