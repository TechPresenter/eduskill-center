import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabLink {
  value: string;
  label: string;
  href: string;
  count?: number;
}

/**
 * Server-safe tab strip: the active tab is decided by the caller (e.g. from a `?tab=` query param).
 * On phones the row scrolls sideways edge to edge (no page overflow, no visible scrollbar) with 44px
 * tall tabs; from `lg` up it renders exactly as before.
 */
export function TabLinks({ items, active, className, ariaLabel = "Sections" }: { items: TabLink[]; active: string; className?: string; ariaLabel?: string }) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0", className)}
    >
      {items.map((t) => {
        const isActive = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors tap-highlight-none",
              isActive ? "border-orange text-navy" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", isActive ? "bg-orange-light text-orange" : "bg-surface text-muted")}>{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
