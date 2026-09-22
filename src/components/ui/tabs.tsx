"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  count?: number;
}

/**
 * ONE active treatment for the underline tabs (`Tabs`, `LinkTabs`): a 2px orange rule under a navy,
 * semibold label; everything else is muted. ONE motion: a 150ms colour change.
 */
const TAB_ITEM = "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors duration-micro tap-highlight-none ring-focus focus-visible:ring-0 focus-visible:ring-offset-0 motion-reduce:transition-none";
const TAB_ACTIVE = "border-orange text-navy";
const TAB_IDLE = "border-transparent text-muted hover:text-ink";

/**
 * `relative` matters: this is an `overflow-x-auto` container, and an absolutely positioned `sr-only`
 * descendant inside one that is NOT a containing block escapes it and stretches the page's scrollWidth.
 */
const TAB_LIST = "scrollbar-thin relative flex gap-1 overflow-x-auto border-b border-line";

function CountChip({ count, active, tone = "surface" }: { count: number; active: boolean; tone?: "surface" | "tray" }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        active ? "bg-orange-light text-orange" : tone === "tray" ? "bg-white/70 text-muted" : "bg-surface text-muted"
      )}
    >
      {count}
    </span>
  );
}

/**
 * Keeps the selected item visible in a strip that scrolls sideways on phones, and gives the group
 * roving-tabindex keyboard behaviour (←/→/Home/End) as the tablist pattern requires.
 */
function useTabStrip<T extends HTMLElement>(items: TabItem[], value: string, onChange: (v: string) => void) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(T | null)[]>([]);
  const activeIndex = items.findIndex((t) => t.value === value);
  // Nothing selected yet: keep the first item reachable so the group never drops out of the tab order.
  const focusIndex = activeIndex >= 0 ? activeIndex : 0;

  React.useEffect(() => {
    const el = itemRefs.current[focusIndex];
    const box = listRef.current;
    if (!el || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: Math.max(0, el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2) });
  }, [focusIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (items.length < 2) return;
    const from = focusIndex;
    let next = -1;
    if (e.key === "ArrowRight") next = (from + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (from - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next]!.value);
    itemRefs.current[next]?.focus();
  };

  return { listRef, itemRefs, focusIndex, onKeyDown };
}

/** Underline tabs; 44px tall, horizontally scrollable strip on narrow screens, arrow-key navigable. */
export function Tabs({ items, value, onChange, className }: { items: TabItem[]; value: string; onChange: (v: string) => void; className?: string }) {
  const { listRef, itemRefs, focusIndex, onKeyDown } = useTabStrip<HTMLButtonElement>(items, value, onChange);
  return (
    <div ref={listRef} role="tablist" aria-orientation="horizontal" onKeyDown={onKeyDown} className={cn(TAB_LIST, className)}>
      {items.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(TAB_ITEM, active ? TAB_ACTIVE : TAB_IDLE)}
          >
            {t.label}
            {t.count !== undefined && <CountChip count={t.count} active={active} />}
          </button>
        );
      })}
    </div>
  );
}

export interface LinkTabItem {
  href: string;
  label: React.ReactNode;
  /** Match the pathname exactly instead of by prefix. */
  exact?: boolean;
}

/**
 * Tabs rendered as links; the active tab is derived from the pathname and shares `Tabs`' active
 * treatment exactly. `scrollable` (default) keeps one row that scrolls sideways on phones and brings the
 * current tab into view; `false` wraps onto several rows.
 */
export function LinkTabs({ items, className, scrollable = true }: { items: LinkTabItem[]; className?: string; scrollable?: boolean }) {
  const pathname = usePathname();
  const listRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndex = items.findIndex((t) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/")));

  React.useEffect(() => {
    const el = itemRefs.current[activeIndex];
    const box = listRef.current;
    if (!scrollable || !el || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: Math.max(0, el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2) });
  }, [activeIndex, scrollable]);

  return (
    <div ref={listRef} className={cn("relative flex gap-1 border-b border-line", scrollable ? "scrollbar-thin overflow-x-auto" : "flex-wrap", className)}>
      {items.map((t, i) => (
        <Link
          key={t.href}
          href={t.href}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          aria-current={i === activeIndex ? "page" : undefined}
          className={cn(TAB_ITEM, i === activeIndex ? TAB_ACTIVE : TAB_IDLE)}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export interface SegmentedControlProps {
  items: TabItem[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** `md` keeps the compact desktop look (36px, 44px on phones/touch); `lg` is 44px everywhere. */
  size?: "md" | "lg";
  /** Stretch to the container width with equal-width segments. */
  fullWidth?: boolean;
  /** Allow the strip to scroll sideways instead of squeezing many segments. */
  scrollable?: boolean;
  /** Accessible name for the tablist ("Sign-in method", "Date range"). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Pill-style single-choice switch (filters such as "All / Unread", date ranges). Same keyboard model and
 * the same 150ms motion as `Tabs`; the active segment is a white pill lifted one elevation step (`e1`).
 */
export function SegmentedControl({ items, value, onChange, className, size = "md", fullWidth, scrollable, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby }: SegmentedControlProps) {
  const { listRef, itemRefs, focusIndex, onKeyDown } = useTabStrip<HTMLButtonElement>(items, value, onChange);
  return (
    <div
      ref={listRef}
      onKeyDown={onKeyDown}
      className={cn(
        "relative rounded-full bg-surface p-1",
        fullWidth ? "flex w-full" : "inline-flex",
        scrollable && "no-scrollbar max-w-full overflow-x-auto",
        className
      )}
      role="tablist"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
    >
      {items.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition duration-micro tap-highlight-none ring-focus focus-visible:ring-0 focus-visible:ring-offset-0 motion-reduce:transition-none",
              size === "lg" ? "min-h-11 px-4 text-base sm:text-sm" : "min-h-9 px-3 py-1.5 text-sm max-sm:min-h-11 pointer-coarse:min-h-11",
              fullWidth && "flex-1",
              scrollable && "shrink-0",
              active ? "bg-white text-navy shadow-e1" : "text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && <CountChip count={t.count} active={active} tone="tray" />}
          </button>
        );
      })}
    </div>
  );
}
