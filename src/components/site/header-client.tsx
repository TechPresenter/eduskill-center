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
  X,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useMounted, useOverlayPresence } from "@/components/ui/bottom-sheet";
import { useFocusTrap, useIsDesktop, useScrollLock } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
}

/** Items shown inline from lg; the rest sit in a "More" menu until 2xl where everything is inline. */
const INLINE_AT_LG = 5;
const INLINE_AT_XL = 6;

/** Slide/fade budget for the mobile sheet (ms); also the exit budget handed to useOverlayPresence. */
const SHEET_MS = 250;

/**
 * Grouping for the mobile sheet. Any nav entry not listed here is appended to the trailing group,
 * so every destination in SITE_NAV stays reachable even if the nav gains items later.
 */
const MOBILE_SECTIONS: { label: string | null; hrefs: string[] }[] = [
  { label: null, hrefs: ["/"] },
  { label: "Explore", hrefs: ["/about", "/programs", "/courses", "/training-centers"] },
  { label: "Get involved", hrefs: ["/become-a-trainer", "/open-a-centre", "/scholarship"] },
  { label: "More", hrefs: ["/success-stories", "/contact"] },
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

  const ungrouped = nav.filter((item) => !grouped.has(item.href));
  if (ungrouped.length > 0) {
    const last = sections[sections.length - 1];
    if (last?.label === "More") last.items = [...last.items, ...ungrouped];
    else sections.push({ label: "More", items: ungrouped });
  }
  return sections;
}

/**
 * Public site header.
 * - >= lg (1024px): logo, menu (overflow items in "More" until 2xl), Student Login / My Dashboard, Apply Now.
 * - < lg: Android-style bar with logo, Apply Now and a hamburger opening a full-height right-hand sheet.
 */
export function HeaderClient({
  nav,
  logo,
  logoMobile,
  siteName,
  dashboardHref,
  registrationOpen,
}: {
  nav: NavItem[];
  logo: React.ReactNode;
  logoMobile: React.ReactNode;
  siteName: string;
  /** Portal home when a user is logged in; null renders "Student Login". */
  dashboardHref: string | null;
  registrationOpen: boolean;
}) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
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

  const linkClass = (active: boolean) =>
    cn(
      "relative inline-flex h-10 items-center rounded-lg px-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors 2xl:px-3 2xl:text-[14px]",
      active ? "text-orange" : "text-navy hover:bg-surface hover:text-navy-dark"
    );

  return (
    <header className={cn("sticky top-0 z-header bg-white transition-shadow duration-element motion-reduce:transition-none pt-safe", scrolled ? "shadow-[0_4px_24px_-8px_rgba(16,24,40,0.18)]" : "shadow-[0_1px_0_0_rgba(228,231,236,1)]")}>
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:h-[72px] lg:px-8">
        <Link href="/" aria-label={`${siteName} – home`} className="shrink-0 rounded-lg">
          <span className="hidden sm:block">{logo}</span>
          <span className="sm:hidden">{logoMobile}</span>
        </Link>

        {/* Desktop menu */}
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-0.5 2xl:gap-1">
            {nav.map((item, index) => {
              const active = isActive(item.href);
              const visibility = index < INLINE_AT_LG ? "" : index < INLINE_AT_XL ? "hidden xl:block" : "hidden 2xl:block";
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
              <li className="relative 2xl:hidden" ref={moreRef}>
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

        <div className="flex shrink-0 items-center gap-2">
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
          {registrationOpen && (
            <ButtonLink href="/register" size="sm" className="h-10 px-3.5 text-[13px] sm:h-11 sm:px-4 sm:text-sm">
              Apply Now
            </ButtonLink>
          )}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="site-mobile-menu"
            className="touch-target inline-flex items-center justify-center rounded-xl text-navy tap-highlight-none active:bg-surface lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
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
      />
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
}: {
  open: boolean;
  onClose: () => void;
  sections: MobileSection[];
  logo: React.ReactNode;
  dashboardHref: string | null;
  registrationOpen: boolean;
  isActive: (href: string) => boolean;
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
    <div hidden={!rendered} className={cn("fixed inset-0 z-80 lg:hidden", closing && "pointer-events-none")}>
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
