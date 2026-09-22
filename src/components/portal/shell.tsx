"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useScrollLock, useVisualViewport } from "@/lib/hooks";
import { Avatar } from "@/components/ui/misc";
import { Dropdown, DropdownSeparator } from "@/components/ui/dropdown";
import { BrandMark } from "@/components/brand";
import { api } from "@/lib/api-client";
import { toast } from "@/components/ui/toast";
import { purgeOfflineCaches } from "@/components/pwa/register-sw";
import type { Branding } from "@/lib/settings";
import { PortalHeaderProvider, usePortalHeader } from "./header-context";
import { BottomNav, isNavActive } from "./bottom-nav";
import { AccountRowIcon, MobileHeader, accountRowClass } from "./mobile-header";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** any-of permission keys (admin only) */
  permission?: string | string[];
  exact?: boolean;
  badge?: number;
  /** Extra route prefixes that also count as "active" for this item. */
  match?: string[];
  /** `"menu"`: a bottom-nav item that opens the full navigation drawer instead of navigating. */
  action?: "menu";
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export interface ShellUser {
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  role: string;
  permissions?: string[];
}

interface ShellProps {
  nav: NavGroup[];
  user: ShellUser;
  branding: Pick<Branding, "siteName" | "shortName" | "logoUrl" | "logoMobileUrl" | "logoFooterUrl" | "logoAdminUrl">;
  portalLabel: string;
  homeHref: string;
  bottomNav?: NavItem[];
  unreadCount?: number;
  notificationsHref?: string;
  profileHref?: string;
  settingsHref?: string;
  children: React.ReactNode;
}

function allowed(item: NavItem, user: ShellUser) {
  if (!item.permission) return true;
  if (user.role === "SUPER_ADMIN" || user.permissions?.includes("*")) return true;
  const need = Array.isArray(item.permission) ? item.permission : [item.permission];
  return need.some((p) => user.permissions?.includes(p));
}

/** Kept for callers; delegates to the shared matcher (exact / prefix / `match`). */
function isActive(pathname: string, item: NavItem) {
  return isNavActive(pathname, item);
}

/** Height of the phone bottom nav (56px rows + border) exposed as `--bottom-nav-h` for Toaster / Fab / pb-safe-nav. */
const BOTTOM_NAV_HEIGHT = "4rem";
/**
 * Drawer slide duration in ms. This MUST equal `--duration-overlay` (350ms), which is what the
 * `duration-overlay` classes below use: the timer is what flips the drawer to `display: none`, so a
 * shorter value cuts the closing slide off part-way and the panel vanishes instead of leaving.
 */
const DRAWER_MS = 350;

export function LogoutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const logout = async () => {
    setBusy(true);
    try {
      const data = await api.post<{ redirect: string }>("/api/auth/logout");
      // Let the PWA layer drop cached pages/API responses before the next user signs in.
      window.dispatchEvent(new CustomEvent("esk:logout"));
      purgeOfflineCaches();
      router.replace(data.redirect);
      router.refresh();
    } catch {
      toast.error("Could not log out");
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={logout} disabled={busy} className={className}>
      {children ?? (
        <>
          <LogOut className="h-4 w-4" /> Log out
        </>
      )}
    </button>
  );
}

export function PortalShell(props: ShellProps) {
  return (
    <PortalHeaderProvider>
      <ShellInner {...props} />
    </PortalHeaderProvider>
  );
}

function ShellInner({ nav, user, branding, portalLabel, homeHref, bottomNav, unreadCount = 0, notificationsHref, profileHref, settingsHref, children }: ShellProps) {
  const pathname = usePathname();
  const { hideBottomNav } = usePortalHeader();
  const { keyboardOpen } = useVisualViewport();

  // ── Drawer: always mounted. closed → opening (visible, off-canvas) → open (slid in) → closing → closed (display:none). ──
  const [phase, setPhase] = React.useState<"closed" | "opening" | "open" | "closing">("closed");
  const drawerRef = React.useRef<HTMLElement>(null);
  const open = phase === "opening" || phase === "open";
  const mounted = phase !== "closed";
  const shown = phase === "open";
  const closeDrawer = React.useCallback(() => setPhase((p) => (p === "closed" ? p : "closing")), []);
  const openDrawer = React.useCallback(() => setPhase("opening"), []);

  React.useEffect(() => {
    if (phase === "opening") {
      // Next frame: force a style flush at -translate-x-full, then slide in so the transition runs.
      const raf = requestAnimationFrame(() => {
        drawerRef.current?.getBoundingClientRect();
        setPhase((p) => (p === "opening" ? "open" : p));
      });
      return () => cancelAnimationFrame(raf);
    }
    if (phase === "closing") {
      const t = setTimeout(() => setPhase((p) => (p === "closing" ? "closed" : p)), DRAWER_MS + 20);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Close on client-side navigation (adjust state on prop change, no effect).
  const [lastPathname, setLastPathname] = React.useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (open) setPhase("closing");
  }

  useScrollLock(open);
  useFocusTrap(drawerRef, open, { onEscape: closeDrawer, inertSelector: "[data-portal-inert]" });

  const groups = React.useMemo(() => nav.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i, user)) })).filter((g) => g.items.length > 0), [nav, user]);
  const flatItems = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const bottomItems = React.useMemo(() => (bottomNav ?? []).filter((i) => allowed(i, user)), [bottomNav, user]);
  const hasBottomNav = bottomItems.length > 0;
  const bottomNavVisible = hasBottomNav && !hideBottomNav && !keyboardOpen;
  const portalKind = homeHref.split("/").filter(Boolean)[0] ?? "portal";

  // Toaster (and anything else portaled outside the shell) reads the var from <html>.
  React.useEffect(() => {
    if (!hasBottomNav) return;
    document.documentElement.style.setProperty("--bottom-nav-h", bottomNavVisible ? BOTTOM_NAV_HEIGHT : "0px");
    return () => {
      document.documentElement.style.removeProperty("--bottom-nav-h");
    };
  }, [hasBottomNav, bottomNavVisible]);

  const rootStyle = hasBottomNav ? ({ "--bottom-nav-h": bottomNavVisible ? BOTTOM_NAV_HEIGHT : "0px" } as React.CSSProperties) : undefined;

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label={`${portalLabel} navigation`}>
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <Link href={homeHref} aria-label={branding.siteName} onClick={closeDrawer}>
          <BrandMark branding={branding} variant="admin" light className="h-9" />
        </Link>
        <button
          type="button"
          className="touch-target ring-focus-inverse -mr-2 inline-flex items-center justify-center rounded-md text-white/70 tap-highlight-none transition-colors duration-micro hover:bg-white/10 hover:text-white active:bg-white/10 motion-reduce:transition-none lg:hidden"
          onClick={closeDrawer}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-overline text-white/40">{portalLabel}</p>
        {groups.map((g, gi) => (
          <div key={gi} className="mb-4">
            {g.title && <p className="px-3 pt-2 pb-1 text-overline text-white/40">{g.title}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeDrawer}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group ring-focus-inverse flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-body-sm font-medium transition-colors duration-micro motion-reduce:transition-none lg:min-h-0",
                        active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <item.icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-orange" : "text-white/50 group-hover:text-white/80")} />
                      <span className="truncate">{item.label}</span>
                      {item.badge ? <span className="ml-auto rounded-full bg-orange px-1.5 py-0.5 text-caption font-bold text-white">{item.badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <Avatar name={user.name} src={user.avatarUrl} size={34} className="bg-white/15 text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-caption text-white/50">{user.subtitle ?? user.role}</p>
          </div>
        </div>
        {/* Pinned Log out row (phone drawer only; the desktop header keeps the account menu). */}
        <LogoutButton className="ring-focus-inverse mt-1 flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-body-sm font-medium text-white/80 tap-highlight-none transition-colors duration-micro hover:bg-white/8 hover:text-white active:bg-white/10 motion-reduce:transition-none lg:hidden">
          <LogOut className="h-4.5 w-4.5 shrink-0 text-white/50" aria-hidden /> Log out
        </LogoutButton>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-surface" data-portal={portalKind} style={rootStyle}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-drawer hidden w-64 bg-navy-dark lg:block">{sidebar}</aside>

      {/* Mobile drawer: always mounted so the slide transition can run both ways */}
      <div id="portal-drawer" className="fixed inset-0 z-drawer lg:hidden" role="dialog" aria-modal="true" aria-label={`${portalLabel} menu`} hidden={!mounted}>
        <div className={cn("absolute inset-0 bg-navy/60 transition-opacity duration-overlay motion-reduce:transition-none", shown ? "opacity-100" : "opacity-0")} onClick={closeDrawer} aria-hidden />
        <aside
          ref={drawerRef}
          className={cn(
            "absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-navy-dark pt-safe pb-safe shadow-e3 transition-transform duration-overlay will-change-transform motion-reduce:transition-none",
            shown ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64" data-portal-inert>
        {/* Phone app bar */}
        <MobileHeader
          portalLabel={portalLabel}
          homeHref={homeHref}
          branding={branding}
          navItems={flatItems}
          user={user}
          unreadCount={unreadCount}
          notificationsHref={notificationsHref}
          profileHref={profileHref}
          settingsHref={settingsHref}
          onOpenMenu={openDrawer}
          showMenuButton
          logout={
            <LogoutButton className={accountRowClass(true)}>
              <AccountRowIcon danger>
                <LogOut className="h-5 w-5" aria-hidden />
              </AccountRowIcon>
              Log out
            </LogoutButton>
          }
        />

        {/* Desktop header (unchanged at lg+) */}
        <header className="sticky top-0 z-header hidden h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6 lg:flex">
          <div className="min-w-0 flex-1">
            <p className="truncate text-h4 text-navy">{portalLabel}</p>
          </div>
          {notificationsHref && (
            <Link href={notificationsHref} className="relative rounded-md p-2 text-muted ring-focus transition-colors duration-micro hover:bg-surface hover:text-navy motion-reduce:transition-none" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange px-1 text-caption leading-none font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </Link>
          )}
          <Dropdown
            trigger={
              <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1.5 ring-focus transition-colors duration-micro hover:bg-surface motion-reduce:transition-none" aria-label="Account menu">
                <Avatar name={user.name} src={user.avatarUrl} size={32} />
                <span className="hidden max-w-[10rem] truncate text-body-sm font-medium text-ink sm:block">{user.name}</span>
                <ChevronDown className="hidden h-4 w-4 text-muted sm:block" />
              </button>
            }
          >
            <div className="px-3 py-2">
              <p className="truncate text-body-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-caption text-muted">{user.subtitle ?? user.role}</p>
            </div>
            <DropdownSeparator />
            {profileHref && (
              <Link href={profileHref} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-body-sm text-ink ring-focus transition-colors duration-micro hover:bg-surface motion-reduce:transition-none lg:min-h-0">
                My profile
              </Link>
            )}
            {settingsHref && (
              <Link href={settingsHref} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-body-sm text-ink ring-focus transition-colors duration-micro hover:bg-surface motion-reduce:transition-none lg:min-h-0">
                Account settings
              </Link>
            )}
            <Link href="/" className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-body-sm text-ink ring-focus transition-colors duration-micro hover:bg-surface motion-reduce:transition-none lg:min-h-0">
              Go to website
            </Link>
            <DropdownSeparator />
            <LogoutButton className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-body-sm text-danger ring-focus transition-colors duration-micro hover:bg-danger-light motion-reduce:transition-none lg:min-h-0">
              <LogOut className="h-4 w-4" /> Log out
            </LogoutButton>
          </Dropdown>
        </header>

        <main className={cn("flex-1 px-4 pt-6 sm:px-6 lg:px-8", hasBottomNav ? "pb-safe-nav lg:pb-8" : "pb-6 lg:pb-8")}>{children}</main>
      </div>

      {hasBottomNav && (
        <div className="contents" data-portal-inert>
          <BottomNav items={bottomItems} pathname={pathname} onMore={openDrawer} menuOpen={open} />
        </div>
      )}
    </div>
  );
}
