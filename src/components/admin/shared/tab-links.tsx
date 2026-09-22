import Link from "next/link";
import { cn } from "@/lib/utils";
import { TabStripAutoScroll } from "./tab-strip-scroll";

export interface TabLink {
  value: string;
  label: React.ReactNode;
  href: string;
  count?: number;
}

/*
 * THE tab strip for tabs that are links.
 *
 * The audit found three components doing this one job: `QueryTabs` (buttons carrying `role="tab"`
 * with no `tabpanel` anywhere — a tablist that lies, because activating it loads a new server render),
 * `TabLinks` (correct) and `LinkTabs`. This is the one implementation; `QueryTabs` now renders through
 * it and keeps its old props.
 *
 * Why links and `aria-current="page"` rather than `role="tab"`: the panel is a fresh server render at a
 * new URL. That is navigation, so the correct pattern is a `<nav>` of links with the current one marked,
 * which also restores middle-click, open-in-new-tab and prefetch. `role="tab"` belongs to
 * `TabbedPanels`, where the panels really are on the page.
 *
 * The visual treatment (2px orange rule, navy semibold label, 150ms colour change, 44px row) is the
 * same one `Tabs` / `LinkTabs` use in `src/components/ui/tabs.tsx`. If that is retuned, retune this.
 */
const TAB_ITEM =
  "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-body-sm font-semibold transition-colors duration-micro tap-highlight-none ring-focus focus-visible:ring-0 focus-visible:ring-offset-0 motion-reduce:transition-none";
const TAB_ACTIVE = "border-orange text-navy";
const TAB_IDLE = "border-transparent text-muted hover:text-ink";

export interface TabLinksProps {
  items: TabLink[];
  /** The `value` of the current tab — the caller decides it (from `?tab=`, the pathname, anything). */
  active: string;
  className?: string;
  ariaLabel?: string;
  /** `false` keeps the page's scroll position across a tab change (used by `QueryTabs`). */
  scroll?: boolean;
}

export function TabLinks({ items, active, className, ariaLabel = "Sections", scroll = true }: TabLinksProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-tab-strip
      /*
       * `relative`: this is an overflow-x container, and an absolutely positioned descendant of one
       * that is not itself a containing block escapes and widens the document.
       * The negative gutter lets the row bleed to the screen edge on phones so the first tab is never
       * clipped mid-swipe; from `lg` it sits flush with the page grid again.
       */
      className={cn("no-scrollbar relative -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0", className)}
    >
      {items.map((t) => {
        const isActive = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            scroll={scroll}
            aria-current={isActive ? "page" : undefined}
            className={cn(TAB_ITEM, isActive ? TAB_ACTIVE : TAB_IDLE)}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-caption tabular-nums", isActive ? "bg-orange-light text-orange" : "bg-surface text-muted")}>{t.count}</span>
            )}
          </Link>
        );
      })}
      <TabStripAutoScroll />
    </nav>
  );
}
