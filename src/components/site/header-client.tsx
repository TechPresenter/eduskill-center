"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
}

/** Items shown inline from lg; the rest sit in a "More" menu until 2xl where everything is inline. */
const INLINE_AT_LG = 5;
const INLINE_AT_XL = 6;

/**
 * Public site header.
 * - ≥ lg (1024px): logo, menu (overflow items in "More" until 2xl), Student Login / My Dashboard, Apply Now.
 * - < lg: Android-style bar with logo, Apply Now and a hamburger opening a full-screen menu.
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
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
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

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
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

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const overflow = nav.slice(INLINE_AT_LG);
  const moreActive = overflow.some((i) => isActive(i.href));

  const linkClass = (active: boolean) =>
    cn(
      "relative inline-flex h-10 items-center rounded-lg px-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors 2xl:px-3 2xl:text-[14px]",
      active ? "text-orange" : "text-navy hover:bg-surface hover:text-navy-dark"
    );

  return (
    <header className={cn("sticky top-0 z-50 bg-white/95 backdrop-blur transition-shadow duration-300 pt-safe", scrolled ? "shadow-[0_4px_24px_-8px_rgba(16,24,40,0.18)]" : "shadow-[0_1px_0_0_rgba(228,231,236,1)]")}>
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
                  <ul role="menu" className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-card-hover animate-pop">
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

      {/* Full-screen mobile menu */}
      <div id="site-mobile-menu" role="dialog" aria-modal="true" aria-label="Site menu" className={cn("fixed inset-0 z-[80] lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} hidden={!open}>
        <div className={cn("absolute inset-0 bg-navy/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} aria-hidden />
        <div className={cn("absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-float transition-transform duration-300 pt-safe pb-safe sm:max-w-sm", open ? "translate-x-0" : "translate-x-full")}>
          <div className="flex h-14 items-center justify-between border-b border-line px-4 sm:h-16">
            <span>{logoMobile}</span>
            <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="touch-target inline-flex items-center justify-center rounded-xl text-navy tap-highlight-none active:bg-surface">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-3">
            <ul className="space-y-1">
              {nav.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold tap-highlight-none active:bg-surface",
                        active ? "bg-orange-light text-orange" : "text-navy"
                      )}
                    >
                      {item.label}
                      <ChevronRight className={cn("h-4 w-4", active ? "text-orange" : "text-muted")} aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="space-y-2 border-t border-line p-4">
            {dashboardHref ? (
              <ButtonLink href={dashboardHref} variant="outline" fullWidth leftIcon={<LayoutDashboard className="h-4 w-4" />}>
                My Dashboard
              </ButtonLink>
            ) : (
              <ButtonLink href="/login" variant="outline" fullWidth leftIcon={<LogIn className="h-4 w-4" />}>
                Student Login
              </ButtonLink>
            )}
            {registrationOpen && (
              <ButtonLink href="/register" fullWidth>
                Apply Now
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
