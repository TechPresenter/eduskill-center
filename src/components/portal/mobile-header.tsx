"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, Globe, LayoutGrid, Menu, Settings, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BrandMark } from "@/components/brand";
import type { Branding } from "@/lib/settings";
import { usePortalHeader } from "./header-context";
import { matchNavItem } from "./bottom-nav";
import type { NavItem, ShellUser } from "./shell";

/** The 44px icon control of the app bar: one size, one radius, one 150ms press, one focus ring. */
export const APP_BAR_ICON_CLASS =
  "touch-target ring-focus inline-flex items-center justify-center rounded-md text-ink tap-highlight-none transition-colors duration-micro active:bg-surface motion-reduce:transition-none";

/** 56px row inside the account sheet; shared with the LogoutButton row rendered by the shell. */
export function accountRowClass(danger?: boolean) {
  return cn(
    "ring-focus flex min-h-14 w-full items-center gap-3 rounded-md px-3 text-left text-body font-medium tap-highlight-none transition-colors duration-micro active:bg-surface motion-reduce:transition-none",
    danger ? "text-danger" : "text-ink"
  );
}

/** Icon well for account-sheet rows. */
export function AccountRowIcon({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", danger ? "bg-danger-light text-danger" : "bg-lavender text-navy")}>{children}</span>;
}

export interface MobileHeaderProps {
  portalLabel: string;
  homeHref: string;
  branding: Pick<Branding, "siteName" | "shortName" | "logoUrl" | "logoMobileUrl" | "logoFooterUrl" | "logoAdminUrl">;
  /** Flattened, permission-filtered nav items used for the title / back-arrow fallback. */
  navItems: NavItem[];
  user: ShellUser;
  unreadCount?: number;
  notificationsHref?: string;
  profileHref?: string;
  settingsHref?: string;
  /** Opens the full navigation drawer ("All sections" in the account sheet, hamburger). */
  onOpenMenu: () => void;
  /** Render a hamburger on the left of top-level pages (deeper pages show the back arrow instead). */
  showMenuButton?: boolean;
  /** Custom logo for the leading slot (defaults to the mobile BrandMark linking to `homeHref`). */
  logo?: React.ReactNode;
  /** Extra rows for the account sheet, rendered before "Log out". */
  menu?: React.ReactNode;
  /** The Log out row (a LogoutButton styled with `accountRowClass(true)`), rendered last. */
  logout?: React.ReactNode;
}

/**
 * Sticky Android-style app bar for phones (`lg:hidden`). Leading slot = back arrow when the page
 * registered one (or sits deeper than its nav section) else the logo; centre = page title; trailing =
 * optional page action, notifications bell with unread badge and the avatar, which opens the account sheet.
 */
export function MobileHeader({ portalLabel, homeHref, branding, navItems, user, unreadCount = 0, notificationsHref, profileHref, settingsHref, onOpenMenu, showMenuButton, logo, menu, logout }: MobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const ctx = usePortalHeader();
  const [accountOpen, setAccountOpen] = React.useState(false);

  // Close the account sheet on navigation (adjust state on prop change, no effect).
  const [lastPathname, setLastPathname] = React.useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setAccountOpen(false);
  }

  const section = matchNavItem(pathname, navItems);
  const deeper = Boolean(section && pathname !== section.href);
  const title = ctx.title ?? section?.label ?? portalLabel;
  const back: string | true | undefined = ctx.backHref ?? (deeper && section ? section.href : undefined);
  const closeAccount = React.useCallback(() => setAccountOpen(false), []);

  const leading = back ? (
    back === true ? (
      <button type="button" onClick={() => router.back()} className={cn(APP_BAR_ICON_CLASS, "-ml-2 text-navy")} aria-label="Go back">
        <ArrowLeft className="h-6 w-6" aria-hidden />
      </button>
    ) : (
      <Link href={back} className={cn(APP_BAR_ICON_CLASS, "-ml-2 text-navy")} aria-label="Go back">
        <ArrowLeft className="h-6 w-6" aria-hidden />
      </Link>
    )
  ) : showMenuButton ? (
    <button type="button" onClick={onOpenMenu} className={cn(APP_BAR_ICON_CLASS, "-ml-2")} aria-label="Open menu" aria-haspopup="dialog" aria-controls="portal-drawer">
      <Menu className="h-6 w-6" aria-hidden />
    </button>
  ) : (
    (logo ?? (
      <Link href={homeHref} aria-label={branding.siteName} className="inline-flex min-h-11 items-center tap-highlight-none">
        <BrandMark branding={branding} variant="mobile" className="h-8" />
      </Link>
    ))
  );

  return (
    <>
      <header className="sticky top-0 z-header border-b border-line bg-white pt-safe lg:hidden" data-app-bar>
        <div className="flex h-14 items-center gap-1 px-2">
          <div className="flex shrink-0 items-center">{leading}</div>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-h4 text-navy" aria-live="polite">
              {title}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            {ctx.action}
            {notificationsHref && (
              <Link href={notificationsHref} className={cn(APP_BAR_ICON_CLASS, "relative")} aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}>
                <Bell className="h-5.5 w-5.5" aria-hidden />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange px-1 text-caption leading-none font-bold text-white ring-2 ring-white" aria-hidden>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <button type="button" onClick={() => setAccountOpen(true)} className={APP_BAR_ICON_CLASS} aria-label="Account menu" aria-haspopup="dialog" aria-expanded={accountOpen}>
              <Avatar name={user.name} src={user.avatarUrl} size={32} />
            </button>
          </div>
        </div>
      </header>

      <BottomSheet open={accountOpen} onClose={closeAccount} size="sm" title={user.name} description={user.subtitle ?? user.role}>
        <ul className="-mx-2 flex flex-col gap-0.5 pb-1">
          {profileHref && (
            <li>
              <Link href={profileHref} onClick={closeAccount} className={accountRowClass()}>
                <AccountRowIcon>
                  <UserCircle className="h-5 w-5" aria-hidden />
                </AccountRowIcon>
                My profile
              </Link>
            </li>
          )}
          {settingsHref && (
            <li>
              <Link href={settingsHref} onClick={closeAccount} className={accountRowClass()}>
                <AccountRowIcon>
                  <Settings className="h-5 w-5" aria-hidden />
                </AccountRowIcon>
                Account settings
              </Link>
            </li>
          )}
          <li>
            <button
              type="button"
              className={accountRowClass()}
              onClick={() => {
                closeAccount();
                onOpenMenu();
              }}
            >
              <AccountRowIcon>
                <LayoutGrid className="h-5 w-5" aria-hidden />
              </AccountRowIcon>
              All sections
            </button>
          </li>
          <li>
            <Link href="/" onClick={closeAccount} className={accountRowClass()}>
              <AccountRowIcon>
                <Globe className="h-5 w-5" aria-hidden />
              </AccountRowIcon>
              Go to website
            </Link>
          </li>
          {menu}
          {logout && <li className="mt-1 border-t border-line pt-1">{logout}</li>}
        </ul>
      </BottomSheet>
    </>
  );
}
