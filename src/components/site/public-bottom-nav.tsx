"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, LogIn, MapPin, Search, UserCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop, useVisualViewport } from "@/lib/hooks";

/**
 * Tab bar -> header bridge. The phone search sheet belongs to HeaderClient; the Search tab asks for it
 * with this event, and the header answers with SITE_SEARCH_STATE_EVENT so the tab can reflect the
 * sheet in `aria-expanded` and its active pill. A plain DOM event keeps the two siblings decoupled —
 * neither needs a provider around the whole site layout.
 */
export const SITE_SEARCH_OPEN_EVENT = "esk:site-search-open";
export const SITE_SEARCH_STATE_EVENT = "esk:site-search-state";

/** Opens the header's search (full-screen sheet on phones, palette from sm). */
export function openSiteSearch() {
  window.dispatchEvent(new CustomEvent(SITE_SEARCH_OPEN_EVENT));
}

/** Same row height as the portal BottomNav; published as `--bottom-nav-h` like PortalShell does. */
const BOTTOM_NAV_HEIGHT = "4rem";

/** Same cell as the portal BottomNav (src/components/portal/bottom-nav.tsx): 56px, inset focus ring. */
const ITEM_CLASS =
  "group flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1.5 tap-highlight-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange";

interface Tab {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra route prefixes that belong to this tab. */
  match?: string[];
  exact?: boolean;
  action?: "search";
}

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * `--sticky-bar-h` is published on <html> by StickyActionBar while a page's own bottom CTA bar
 * (course detail, centre detail) is fixed on screen. Watching it keeps "one bottom bar at a time"
 * without the pages having to know the tab bar exists.
 */
function subscribeRootStyle(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  return () => observer.disconnect();
}
function readStickyBar() {
  return (parseFloat(document.documentElement.style.getPropertyValue("--sticky-bar-h")) || 0) > 0;
}
function useStickyActionBarPresent(): boolean {
  return React.useSyncExternalStore(subscribeRootStyle, readStickyBar, () => false);
}

function useSearchSheetOpen(): boolean {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onState = (e: Event) => setOpen(Boolean((e as CustomEvent<{ open: boolean }>).detail?.open));
    window.addEventListener(SITE_SEARCH_STATE_EVENT, onState);
    return () => window.removeEventListener(SITE_SEARCH_STATE_EVENT, onState);
  }, []);
  return open;
}

/**
 * The public website's Android-style tab bar (below `lg`): Home, Courses, Centres, Search and the
 * account tab. Visually identical to the portal BottomNav — 56px cells, orange pill behind the active
 * icon, 12px labels, pb-safe — so the site and the portals read as one app.
 *
 * - Search does not navigate: it opens the header's search sheet (/search still counts as its route).
 * - Hidden while the on-screen keyboard is open, and on pages that fix their own StickyActionBar.
 * - Publishes `--bottom-nav-h` while visible, which the chat launcher, the toaster and the layout's
 *   bottom spacer read to stay clear of it.
 */
export function PublicBottomNav({ dashboardHref }: { dashboardHref: string | null }) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const { keyboardOpen } = useVisualViewport();
  const stickyBar = useStickyActionBarPresent();
  const searchOpen = useSearchSheetOpen();

  const tabs: Tab[] = React.useMemo(
    () => [
      { key: "home", label: "Home", href: "/", icon: Home, exact: true },
      { key: "courses", label: "Courses", href: "/courses", icon: BookOpen },
      { key: "centres", label: "Centres", href: "/training-centers", icon: MapPin },
      { key: "search", label: "Search", href: "/search", icon: Search, action: "search" },
      dashboardHref
        ? { key: "account", label: "My account", href: dashboardHref, icon: UserCircle }
        : { key: "account", label: "Login", href: "/login", icon: LogIn, match: ["/register"] },
    ],
    [dashboardHref]
  );

  const activeKey = React.useMemo(() => {
    if (searchOpen) return "search";
    for (const tab of tabs) {
      if (tab.action === "search") {
        if (matches(pathname, tab.href)) return tab.key;
        continue;
      }
      if (tab.exact ? pathname === tab.href : matches(pathname, tab.href) || tab.match?.some((m) => matches(pathname, m))) return tab.key;
    }
    return null;
  }, [pathname, tabs, searchOpen]);

  const hidden = keyboardOpen || stickyBar;
  const visible = !isDesktop && !hidden;

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--bottom-nav-h", visible ? BOTTOM_NAV_HEIGHT : "0px");
    return () => {
      root.style.removeProperty("--bottom-nav-h");
    };
  }, [visible]);

  return (
    <nav aria-label="App" hidden={hidden} className="fixed inset-x-0 bottom-0 z-header border-t border-line bg-white pb-safe lg:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const on = activeKey === tab.key;
          const Icon = tab.icon;
          const inner = (
            <>
              <span
                className={cn(
                  "relative flex h-8 w-14 items-center justify-center rounded-full transition duration-micro ease-soft group-active:scale-95 motion-reduce:transition-none motion-reduce:group-active:scale-100",
                  on ? "bg-orange-light text-orange" : "text-muted group-active:bg-lavender"
                )}
              >
                <Icon className="size-5.5" strokeWidth={on ? 2.25 : 2} aria-hidden />
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-caption leading-none tracking-wide transition-colors duration-micro motion-reduce:transition-none",
                  on ? "font-bold text-orange" : "font-semibold text-muted"
                )}
              >
                {tab.label}
              </span>
            </>
          );
          return (
            <li key={tab.key} className="min-w-0">
              {tab.action === "search" ? (
                <button type="button" onClick={openSiteSearch} aria-haspopup="dialog" aria-expanded={searchOpen} className={ITEM_CLASS}>
                  {inner}
                </button>
              ) : (
                <Link href={tab.href} aria-current={on ? "page" : undefined} className={ITEM_CLASS}>
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

/**
 * Spacer rendered after the footer so the last line of the page can scroll clear of the tab bar.
 * Follows `--bottom-nav-h`, so it collapses on desktop, on sticky-CTA pages and with the keyboard up.
 */
export function PublicBottomNavSpacer() {
  return <div aria-hidden className="h-[calc(var(--bottom-nav-h)+min(var(--bottom-nav-h),env(safe-area-inset-bottom,0px)))] shrink-0 lg:hidden" />;
}
