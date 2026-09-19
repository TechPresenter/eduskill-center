"use client";

import * as React from "react";

/**
 * What a page (or a component such as StickyActionBar) can ask the mobile app bar / bottom nav to do.
 * Every field is optional; unset fields fall back to the shell's own derivation (nav item label, logo).
 */
export interface PortalHeaderState {
  /** App-bar title on phones. Falls back to the longest-prefix nav item label, then the portal label. */
  title?: React.ReactNode;
  /** Show a back arrow: a route string renders a Link, `true` calls `router.back()`. */
  backHref?: string | true;
  /** Optional trailing control (already 44px) rendered between the title and the bell. */
  action?: React.ReactNode;
  /** Hide the bottom navigation while registered (wizards, sticky action bars, full-screen flows). */
  hideBottomNav?: boolean;
}

export interface PortalHeaderContextValue extends PortalHeaderState {
  /** `true` while at least one registration asks to hide the bottom nav. */
  hideBottomNav: boolean;
  /** `true` when rendered inside a PortalShell (outside, every method is a no-op). */
  inPortal: boolean;
  /**
   * Register a header configuration and get back its remover. Later registrations override
   * earlier ones field by field, so a nested component can add an action without clearing the title.
   */
  register: (state: PortalHeaderState) => () => void;
  /** One-shot variant of `register` (replaces the previous `set`); `null` clears it. */
  set: (state: PortalHeaderState | null) => void;
}

interface Entry {
  id: number;
  state: PortalHeaderState;
}

const noop = () => {};
const NO_PROVIDER: PortalHeaderContextValue = {
  hideBottomNav: false,
  inPortal: false,
  register: () => noop,
  set: noop,
};

const PortalHeaderContext = React.createContext<PortalHeaderContextValue>(NO_PROVIDER);

/** Reserved id for the `set()` convenience so repeated calls replace instead of stack. */
const SET_ID = 0;
let nextId = 1;

/** Wraps PortalShell so pages can drive the mobile app bar and bottom nav. */
export function PortalHeaderProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<Entry[]>([]);

  const register = React.useCallback((state: PortalHeaderState) => {
    const id = nextId++;
    setEntries((prev) => [...prev, { id, state }]);
    return () => setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const set = React.useCallback((state: PortalHeaderState | null) => {
    setEntries((prev) => {
      const rest = prev.filter((e) => e.id !== SET_ID);
      return state ? [...rest, { id: SET_ID, state }] : rest;
    });
  }, []);

  const value = React.useMemo<PortalHeaderContextValue>(() => {
    const merged: PortalHeaderState = {};
    let hide = false;
    for (const { state } of entries) {
      if (state.title !== undefined) merged.title = state.title;
      if (state.backHref !== undefined) merged.backHref = state.backHref;
      if (state.action !== undefined) merged.action = state.action;
      if (state.hideBottomNav) hide = true;
    }
    return { ...merged, hideBottomNav: hide, inPortal: true, register, set };
  }, [entries, register, set]);

  return <PortalHeaderContext.Provider value={value}>{children}</PortalHeaderContext.Provider>;
}

/** Read (and drive) the mobile app bar. Safe outside PortalShell: returns inert defaults. */
export function usePortalHeader(): PortalHeaderContextValue {
  return React.useContext(PortalHeaderContext);
}

/**
 * Declarative registration: render it anywhere inside a portal page to set the app-bar title,
 * back arrow, trailing action or to hide the bottom nav. Registers on mount, clears on unmount.
 * PageHeader renders it for you; use it directly for pages without a PageHeader.
 */
export function SetMobileHeader({ title, backHref, action, hideBottomNav }: PortalHeaderState) {
  const { register } = usePortalHeader();
  // Layout effect so the app bar shows the right title in the same paint as the page.
  React.useLayoutEffect(() => register({ title, backHref, action, hideBottomNav }), [register, title, backHref, action, hideBottomNav]);
  return null;
}

/** Hide the bottom navigation while `active` (used by sticky action bars and full-screen flows). */
export function useHideBottomNav(active = true): void {
  const { register } = usePortalHeader();
  React.useLayoutEffect(() => (active ? register({ hideBottomNav: true }) : undefined), [register, active]);
}
