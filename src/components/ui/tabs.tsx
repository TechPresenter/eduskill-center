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

/** Underline tabs; 44px tall, horizontally scrollable strip on narrow screens. */
export function Tabs({ items, value, onChange, className }: { items: TabItem[]; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("scrollbar-thin flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors tap-highlight-none",
              active ? "border-orange text-navy" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-orange-light text-orange" : "bg-surface text-muted")}>{t.count}</span>}
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
 * Tabs rendered as links; the active tab is derived from the pathname.
 * `scrollable` (default) keeps one row that scrolls sideways on phones; `false` wraps onto several rows.
 */
export function LinkTabs({ items, className, scrollable = true }: { items: LinkTabItem[]; className?: string; scrollable?: boolean }) {
  const pathname = usePathname();
  return (
    <div className={cn("flex gap-1 border-b border-line", scrollable ? "scrollbar-thin overflow-x-auto" : "flex-wrap", className)}>
      {items.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 shrink-0 items-center border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors tap-highlight-none",
              active ? "border-orange text-navy" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        );
      })}
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
}

/** Pill-style single-choice switch (filters such as "All / Unread", date ranges). */
export function SegmentedControl({ items, value, onChange, className, size = "md", fullWidth, scrollable }: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-surface p-1",
        fullWidth ? "flex w-full" : "inline-flex",
        scrollable && "no-scrollbar max-w-full overflow-x-auto",
        className
      )}
      role="tablist"
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-all tap-highlight-none",
              size === "lg" ? "min-h-11 px-4 text-[15px] sm:text-sm" : "min-h-9 px-3 py-1.5 text-sm max-sm:min-h-11 pointer-coarse:min-h-11",
              fullWidth && "flex-1",
              scrollable && "shrink-0",
              active ? "bg-white text-navy shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-orange-light text-orange" : "bg-white/70 text-muted")}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
