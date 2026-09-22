"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/lib/hooks";
import { usePortalHeader } from "./header-context";
import type { NavItem } from "./shell";

/** `true` when `pathname` is the item's route or nested below it (or listed in `item.match`). */
export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.action === "menu" || item.href.startsWith("#")) return false;
  if (item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
  return item.match?.some((m) => pathname === m || pathname.startsWith(m + "/")) ?? false;
}

/**
 * Longest-prefix match: the nav item whose route is the deepest ancestor of `pathname`,
 * so `/admin/centers/abc` resolves to "Training Centers", not "Dashboard".
 */
export function matchNavItem(pathname: string, items: NavItem[]): NavItem | undefined {
  let best: NavItem | undefined;
  let bestLen = -1;
  for (const item of items) {
    if (!isNavActive(pathname, item)) continue;
    const len = pathname === item.href || pathname.startsWith(item.href + "/") ? item.href.length : (item.match?.find((m) => pathname === m || pathname.startsWith(m + "/"))?.length ?? 0);
    if (len > bestLen) {
      best = item;
      bestLen = len;
    }
  }
  return best;
}

export interface BottomNavProps {
  /** Up to five items (extra ones are dropped). Items with `action: "menu"` open the drawer. */
  items: NavItem[];
  pathname: string;
  /** Called by "menu" items; when omitted, menu items are not rendered. */
  onMore?: () => void;
  /** Reflects the drawer state on the menu item (`aria-expanded`, highlighted while open). */
  menuOpen?: boolean;
  className?: string;
}

/**
 * 56px row. The press lands on the icon pill (a 150ms squeeze + tint, the Material 3 feel) rather than
 * the whole cell; one focus treatment — inset, because the bar has no room for an offset ring.
 */
const ITEM_CLASS =
  "group flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1.5 tap-highlight-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange";

function Badge({ count }: { count: number }) {
  return (
    <span className="absolute -top-0.5 right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-orange px-1 text-caption leading-none font-bold text-white tabular-nums ring-2 ring-white" aria-hidden>
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Android-style fixed bottom navigation for phones (`lg:hidden`): ≤ 5 items, 56px rows,
 * Material-3 orange pill behind the active icon, orange label, `aria-current`, badge dots,
 * safe-area padding. Hidden while the on-screen keyboard is open or a page asks for
 * `hideBottomNav` through the header context.
 */
export function BottomNav({ items, pathname, onMore, menuOpen = false, className }: BottomNavProps) {
  const { hideBottomNav } = usePortalHeader();
  const { keyboardOpen } = useVisualViewport();
  const visible = items.filter((i) => (i.action === "menu" || i.href === "#menu" ? Boolean(onMore) : true)).slice(0, 5);
  if (visible.length === 0) return null;
  const active = matchNavItem(pathname, visible);
  const hidden = hideBottomNav || keyboardOpen;

  return (
    <nav
      aria-label="Primary"
      hidden={hidden}
      className={cn("fixed inset-x-0 bottom-0 z-header border-t border-line bg-white pb-safe lg:hidden", className)}
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map((item) => {
          const isMenu = item.action === "menu" || item.href === "#menu";
          const on = isMenu ? menuOpen : active === item;
          const inner = (
            <>
              <span
                className={cn(
                  "relative flex h-8 w-14 items-center justify-center rounded-full transition duration-micro ease-soft group-active:scale-95 motion-reduce:transition-none motion-reduce:group-active:scale-100",
                  on ? "bg-orange-light text-orange" : "text-muted group-active:bg-lavender"
                )}
              >
                <item.icon className="size-5.5" strokeWidth={on ? 2.25 : 2} aria-hidden />
                {item.badge ? <Badge count={item.badge} /> : null}
              </span>
              <span className={cn("max-w-full truncate text-caption leading-none tracking-wide transition-colors duration-micro motion-reduce:transition-none", on ? "font-bold text-orange" : "font-semibold text-muted")}>{item.label}</span>
            </>
          );
          return (
            <li key={item.href} className="min-w-0">
              {isMenu ? (
                <button type="button" onClick={onMore} className={ITEM_CLASS} aria-haspopup="dialog" aria-expanded={menuOpen} aria-label={item.badge ? `${item.label} (${item.badge})` : undefined}>
                  {inner}
                </button>
              ) : (
                <Link href={item.href} className={ITEM_CLASS} aria-current={on ? "page" : undefined} aria-label={item.badge ? `${item.label} (${item.badge})` : undefined}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
