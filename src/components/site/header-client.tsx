"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Award,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  Compass,
  Home,
  Info,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  type LucideIcon,
  Mail,
  MapPin,
  Menu,
  Sparkles,
  UserCheck,
  UserCircle,
  X,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useMounted, useOverlayPresence } from "@/components/ui/bottom-sheet";
import { useFocusTrap, useIsDesktop, useScrollLock } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { SearchPalette } from "@/components/site/search/search-palette";
import { SearchFieldTrigger, SearchIconTrigger, useSearchShortcut } from "@/components/site/search/search-trigger";
import { CoursesMegaMenu, MobileCoursesMenu, type CoursesMenuData } from "@/components/site/mega-menu";
import { SITE_SEARCH_OPEN_EVENT, SITE_SEARCH_STATE_EVENT } from "@/components/site/public-bottom-nav";
import { OPEN_SITE_SEARCH_EVENT } from "@/components/site/home/home-search-bar";

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Items shown inline from lg; the rest sit in a "More" menu until 1600px, where everything is inline.
 *
 * Measured budget (Inter 600 13px, px-2.5 links): all ten links are 936px, the logo 189px, Student Login
 * + Apply Now 262px, the search field's 44px minimum and three 12px gaps — 1467px of row. At the old
 * 2xl breakpoint (1536px, 1519px of layout width beside a classic scrollbar) the row is 1455px wide,
 * so the full menu already scrolled the page sideways by ~20px before search existed; at 1600px it
 * has ~50px to spare. The 2xl size bump (14px / px-3, 1049px of links) could never fit inside the
 * 1600px container and is gone. At lg the row has ~6px to spare with a scrollbar (gap-2 there), so
 * nothing may be added to it without moving an item into "More".
 */
const INLINE_AT_LG = 5;
const INLINE_AT_XL = 6;

/** Slide/fade budget for the mobile sheet (ms); also the exit budget handed to useOverlayPresence. */
const SHEET_MS = 250;

/**
 * Grouping for the mobile sheet. Below lg the public tab bar (PublicBottomNav) carries Home, Courses,
 * Centres, Search and the account, so the sheet is the secondary "everything else" menu: Home is left
 * out (tab bar + logo), Courses stays because its accordion adds popular courses and quick links, and
 * Training Centers stays for pages whose sticky Apply bar replaces the tab bar. Any nav entry not listed
 * (and not in MOBILE_EXCLUDED) is appended to the trailing group, so every destination stays reachable.
 */
const MOBILE_SECTIONS: { label: string | null; hrefs: string[] }[] = [
  { label: "Explore", hrefs: ["/about", "/programs", "/courses", "/training-centers"] },
  { label: "Get involved", hrefs: ["/scholarship", "/become-a-trainer", "/open-a-centre"] },
  { label: "More", hrefs: ["/success-stories", "/contact"] },
];
const MOBILE_EXCLUDED = new Set(["/"]);

/** Legal pages, listed quietly at the foot of the phone menu (the footer carries the same four). */
const LEGAL_LINKS: NavItem[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Disclaimer", href: "/disclaimer" },
];

/** Leading icon per destination; unmapped hrefs fall back to a neutral compass. */
const NAV_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/about": Info,
  "/programs": LayoutGrid,
  "/courses": BookOpen,
  "/training-centers": MapPin,
  "/become-a-trainer": UserCheck,
  "/open-a-centre": Building2,
  "/scholarship": Award,
  "/success-stories": Sparkles,
  "/contact": Mail,
};

interface MobileSection {
  label: string | null;
  items: NavItem[];
}

function buildMobileSections(nav: NavItem[]): MobileSection[] {
  const grouped = new Set(MOBILE_SECTIONS.flatMap((s) => s.hrefs));
  const byHref = new Map(nav.map((item) => [item.href, item]));
  const sections: MobileSection[] = MOBILE_SECTIONS.map((section) => ({
    label: section.label,
    items: section.hrefs.map((href) => byHref.get(href)).filter((item): item is NavItem => Boolean(item)),
  })).filter((section) => section.items.length > 0);

  const ungrouped = nav.filter((item) => !grouped.has(item.href) && !MOBILE_EXCLUDED.has(item.href));
  if (ungrouped.length > 0) {
    const last = sections[sections.length - 1];
    if (last?.label === "More") last.items = [...last.items, ...ungrouped];
    else sections.push({ label: "More", items: ungrouped });
  }
  return sections;
}

/**
 * Public site header.
 * - >= lg (1024px): logo, menu (overflow items in "More" until 1600px), a search field that takes whatever
 *   room is left, Student Login / My Dashboard, Apply Now.
 * - below lg the header is an app bar, 56px like the portal MobileHeader, and PublicBottomNav (mounted by
 *   the site layout) is the primary navigation; the hamburger opens the secondary menu sheet.
 * - sm..lg: logo, search field, account icon, Apply Now pill, hamburger.
 * - < sm: logo, compact Apply pill, a 44px search icon and the hamburger.
 *
 * Search opens a command palette (sm+) / full-screen sheet (phones) — see components/site/search. The
 * tab bar's Search tab opens the same sheet through SITE_SEARCH_OPEN_EVENT.
 * Width budget at 360-412px: the phone row is logo + Apply pill (~64px incl. its 44px hit box) + two
 * 44px icons edge to edge, with the hamburger bled 10px into the gutter so its glyph sits on the same
 * 16px inset as the logo. At 381px, where the brand's "India Foundation" line appears (logo 189px),
 * that is about 343 of 349px — which is why the account icon only joins the row from sm (on phones the
 * tab bar's account tab is one thumb away). Re-measure before adding anything to this row.
 */
export function HeaderClient({
  nav,
  logo,
  logoMobile,
  siteName,
  dashboardHref,
  registrationOpen,
  coursesMenu,
}: {
  nav: NavItem[];
  logo: React.ReactNode;
  logoMobile: React.ReactNode;
  siteName: string;
  /** Portal home when a user is logged in; null renders "Student Login". */
  dashboardHref: string | null;
  registrationOpen: boolean;
  /** Courses mega-menu data (getCoursesMenu); null/undefined keeps the plain Courses link. */
  coursesMenu?: CoursesMenuData | null;
}) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const moreRef = React.useRef<HTMLLIElement>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus when the route changes (adjust-state-on-prop-change pattern, no effect).
  const [lastPathname, setLastPathname] = React.useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
    setMoreOpen(false);
    setSearchOpen(false);
  }

  // Growing past lg swaps in the desktop nav, so drop the sheet (and its scroll lock) with it.
  const [lastDesktop, setLastDesktop] = React.useState(isDesktop);
  if (lastDesktop !== isDesktop) {
    setLastDesktop(isDesktop);
    if (isDesktop) setOpen(false);
  }

  // Safety net: if the sheet's focus trap could not restore focus (the opener never took it),
  // put it back on the hamburger so a keyboard user does not land on <body>.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    if (document.activeElement === document.body) menuButtonRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const isActive = React.useCallback(
    (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")),
    [pathname]
  );
  const overflow = nav.slice(INLINE_AT_LG);
  const moreActive = overflow.some((i) => isActive(i.href));
  const sections = React.useMemo(() => buildMobileSections(nav), [nav]);
  const closeMenu = React.useCallback(() => setOpen(false), []);
  const openSearch = React.useCallback(() => {
    setOpen(false);
    setMoreOpen(false);
    setSearchOpen(true);
  }, []);
  const closeSearch = React.useCallback(() => setSearchOpen(false), []);
  useSearchShortcut(openSearch);

  // The public tab bar's Search tab opens this same sheet, and mirrors its state.
  React.useEffect(() => {
    // The home screen's search bar is a link to /search; it dispatches a cancelable event first, and
    // preventDefault() tells it the sheet opened so the navigation is cancelled.
    const onHomeBar = (e: Event) => {
      e.preventDefault();
      openSearch();
    };
    window.addEventListener(SITE_SEARCH_OPEN_EVENT, openSearch);
    window.addEventListener(OPEN_SITE_SEARCH_EVENT, onHomeBar);
    return () => {
      window.removeEventListener(SITE_SEARCH_OPEN_EVENT, openSearch);
      window.removeEventListener(OPEN_SITE_SEARCH_EVENT, onHomeBar);
    };
  }, [openSearch]);
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent(SITE_SEARCH_STATE_EVENT, { detail: { open: searchOpen } }));
  }, [searchOpen]);

  const linkClass = (active: boolean) =>
    cn(
      "relative inline-flex h-10 items-center rounded-lg px-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
      active ? "text-orange" : "text-navy hover:bg-surface hover:text-navy-dark"
    );

  return (
    <header className={cn("sticky top-0 z-header bg-white transition-shadow duration-element motion-reduce:transition-none pt-safe", scrolled ? "shadow-[0_4px_24px_-8px_rgba(16,24,40,0.18)]" : "shadow-[0_1px_0_0_rgba(228,231,236,1)]")}>
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-1 px-4 sm:gap-3 sm:px-6 lg:h-[72px] lg:gap-2 lg:px-8 xl:gap-3">
        <Link href="/" aria-label={`${siteName} – home`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg">
          <span className="hidden sm:block">{logo}</span>
          <span className="sm:hidden">{logoMobile}</span>
        </Link>

        {/* Desktop menu */}
        <nav aria-label="Primary" className="hidden shrink-0 lg:block">
          <ul className="flex items-center gap-0.5">
            {nav.map((item, index) => {
              const active = isActive(item.href);
              const visibility = index < INLINE_AT_LG ? "" : index < INLINE_AT_XL ? "hidden xl:block" : "hidden min-[1600px]:block";
              if (item.href === "/courses" && coursesMenu) {
                return (
                  <li key={item.href} className={visibility}>
                    <CoursesMegaMenu data={coursesMenu} label={item.label} active={active} />
                  </li>
                );
              }
              return (
                <li key={item.href} className={visibility}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
                    {item.label}
                    {active && <span aria-hidden className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-orange" />}
                  </Link>
                </li>
              );
            })}
            {overflow.length > 0 && (
              <li className="relative min-[1600px]:hidden" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className={cn(linkClass(moreActive), "gap-1")}
                >
                  More
                  <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} aria-hidden />
                </button>
                {moreOpen && (
                  <ul role="menu" className="absolute right-0 z-raised mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-e2 animate-pop motion-reduce:animate-none">
                    {overflow.map((item, i) => {
                      const active = isActive(item.href);
                      const idx = INLINE_AT_LG + i;
                      return (
                        <li key={item.href} className={idx < INLINE_AT_XL ? "xl:hidden" : ""} role="none">
                          <Link
                            role="menuitem"
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold", active ? "bg-orange-light text-orange" : "text-navy hover:bg-surface")}
                          >
                            {item.label}
                            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            )}
          </ul>
        </nav>

        {/* Grows into the room the row leaves; on phones it is only the spacer that pushes the actions right. */}
        <div className="flex min-w-0 flex-1 justify-end sm:min-w-11">
          <SearchFieldTrigger onOpen={openSearch} open={searchOpen} className="hidden max-w-80 sm:flex" />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {dashboardHref ? (
            <ButtonLink href={dashboardHref} variant="outline" size="sm" className="hidden lg:inline-flex" leftIcon={<LayoutDashboard className="h-4 w-4" />}>
              <span className="hidden xl:inline">My Dashboard</span>
              <span className="xl:hidden">Dashboard</span>
            </ButtonLink>
          ) : (
            <ButtonLink href="/login" variant="outline" size="sm" className="hidden lg:inline-flex" leftIcon={<LogIn className="h-4 w-4" />}>
              <span className="hidden xl:inline">Student Login</span>
              <span className="xl:hidden">Login</span>
            </ButtonLink>
          )}
          {/* Account icon for the tablet app bar; on phones the tab bar's account tab covers it. */}
          <Link
            href={dashboardHref ?? "/login"}
            aria-label={dashboardHref ? "My account" : "Student login"}
            className="touch-target hidden items-center justify-center rounded-full text-navy tap-highlight-none transition-colors duration-micro active:bg-surface ring-focus motion-reduce:transition-none sm:inline-flex lg:hidden"
          >
            <UserCircle className="h-6 w-6" aria-hidden />
          </Link>
          {registrationOpen && (
            <>
              {/* App-bar pill (below lg): a 36px orange pill inside a 44px hit box. "Apply" alone on
                  phones buys the room for the search icon at 381-412px. */}
              <Link href="/register" className="group inline-flex h-11 shrink-0 items-center tap-highlight-none outline-none lg:hidden">
                <span className="inline-flex h-9 items-center rounded-full bg-orange px-3.5 text-[13px] font-bold text-white shadow-e1 transition duration-micro ease-soft group-hover:bg-orange-hover group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-orange group-focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:group-active:scale-100 sm:px-4 sm:text-sm">
                  <span className="sm:hidden">Apply</span>
                  <span className="hidden sm:inline">Apply Now</span>
                </span>
              </Link>
              <ButtonLink href="/register" size="sm" className="hidden h-11 px-4 text-sm lg:inline-flex">
                Apply Now
              </ButtonLink>
            </>
          )}
          {/* The two app-bar icons sit edge to edge (each is already a 44px target with its own air). */}
          <span className="flex items-center lg:hidden">
            <SearchIconTrigger onOpen={openSearch} open={searchOpen} className="sm:hidden" />
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="site-mobile-menu"
              className="touch-target -mr-2.5 inline-flex items-center justify-center rounded-xl text-navy tap-highlight-none active:bg-surface ring-focus sm:mr-0 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
          </span>
        </div>
      </div>

      {/*
        The sheet is portalled to <body> on purpose, and stays portalled. The header used to carry
        `backdrop-blur`, and a non-none backdrop-filter is a containing block for fixed descendants -
        rendered inside the header, `fixed inset-0` resolved against the 56px-tall header box and
        clipped the sheet to a transparent sliver. The blur is gone (opaque bg-white, same look over
        content, no per-frame GPU pass on cheap Androids) but any future filter, transform or
        `animate-*` on this header would bring the bug straight back. Same class of bug CLAUDE.md
        documents for transforms / animate-page.
      */}
      <MobileMenu
        open={open}
        onClose={closeMenu}
        sections={sections}
        logo={logoMobile}
        dashboardHref={dashboardHref}
        registrationOpen={registrationOpen}
        isActive={isActive}
        coursesMenu={coursesMenu}
      />
      {/* Portalled by OverlaySurface, so the header never becomes its containing block. */}
      <SearchPalette open={searchOpen} onClose={closeSearch} />
    </header>
  );
}

/**
 * Full-height right-hand navigation sheet for phones and tablets, portalled to `document.body` so no
 * filtered or transformed ancestor can contain it. Traps focus, locks body scroll, closes on Escape /
 * scrim tap / navigation, and returns focus to the hamburger.
 */
function MobileMenu({
  open,
  onClose,
  sections,
  logo,
  dashboardHref,
  registrationOpen,
  isActive,
  coursesMenu,
}: {
  open: boolean;
  onClose: () => void;
  sections: MobileSection[];
  logo: React.ReactNode;
  dashboardHref: string | null;
  registrationOpen: boolean;
  isActive: (href: string) => boolean;
  coursesMenu?: CoursesMenuData | null;
}) {
  const mounted = useMounted();
  const { rendered, closing } = useOverlayPresence(open, SHEET_MS);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [entered, setEntered] = React.useState(false);

  useScrollLock(rendered);
  useFocusTrap(panelRef, open, { onEscape: onClose, initialFocus: "first" });

  // Closing drops the transform straight away (render-phase reset), so the panel slides back out
  // while useOverlayPresence keeps it mounted for the exit.
  const [lastOpen, setLastOpen] = React.useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (!open) setEntered(false);
  }

  // Two frames: the panel must paint off-canvas once before the transform flips, or there is nothing
  // to transition from.
  React.useEffect(() => {
    if (!open) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open]);

  if (!mounted) return null;
  const shown = open && entered;

  return createPortal(
    <div hidden={!rendered} className={cn("fixed inset-0 z-drawer lg:hidden", closing && "pointer-events-none")}>
      <div
        onClick={onClose}
        aria-hidden
        className={cn("absolute inset-0 bg-navy/60 transition-opacity duration-250 ease-out motion-reduce:transition-none", shown ? "opacity-100" : "opacity-0")}
      />
      <div
        ref={panelRef}
        id="site-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 right-0 flex w-[86vw] max-w-88 flex-col bg-white shadow-float outline-none pt-safe pb-safe",
          "transition-transform duration-250 ease-out motion-reduce:transition-none",
          shown ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
          <span className="min-w-0 pl-1">{logo}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="touch-target inline-flex items-center justify-center rounded-xl text-navy tap-highlight-none active:bg-surface"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav aria-label="Site" className="flex-1 overflow-y-auto overscroll-contain px-2.5 pb-4">
          {sections.map((section, index) => (
            <div key={section.label ?? "section-" + index}>
              {section.label && <p className="px-3 pt-4 pb-1 text-[12px] font-bold tracking-[0.08em] text-muted uppercase">{section.label}</p>}
              <ul className={cn("space-y-0.5", !section.label && "pt-3")}>
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = NAV_ICONS[item.href] ?? Compass;
                  if (item.href === "/courses" && coursesMenu) {
                    return (
                      <li key={item.href}>
                        <MobileCoursesMenu data={coursesMenu} label={item.label} active={active} onNavigate={onClose} />
                      </li>
                    );
                  }
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={onClose}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] font-semibold transition-colors tap-highlight-none active:bg-surface",
                          active ? "bg-orange-light text-orange" : "text-navy"
                        )}
                      >
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-orange text-white" : "bg-lavender text-navy")}>
                          <Icon className="h-4.5 w-4.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {active ? (
                          <span aria-hidden className="mr-1 h-2 w-2 shrink-0 rounded-full bg-orange" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="mt-4 border-t border-line px-1 pt-3">
            <p className="px-2 pb-1 text-[12px] font-bold tracking-[0.08em] text-muted uppercase">Legal</p>
            <ul className="grid grid-cols-2 gap-x-1">
              {LEGAL_LINKS.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href} className="min-w-0">
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex min-h-11 items-center rounded-lg px-2 text-[13px] font-medium tap-highlight-none active:bg-surface", active ? "text-orange" : "text-muted")}
                    >
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="shrink-0 space-y-2 border-t border-line bg-white p-4">
          {dashboardHref ? (
            <ButtonLink href={dashboardHref} variant="outline" fullWidth onClick={onClose} leftIcon={<LayoutDashboard className="h-4 w-4" />}>
              My Dashboard
            </ButtonLink>
          ) : (
            <ButtonLink href="/login" variant="outline" fullWidth onClick={onClose} leftIcon={<LogIn className="h-4 w-4" />}>
              Student Login
            </ButtonLink>
          )}
          {registrationOpen && (
            <ButtonLink href="/register" fullWidth onClick={onClose}>
              Apply Now
            </ButtonLink>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
