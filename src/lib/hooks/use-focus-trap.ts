import * as React from "react";

export interface FocusTrapOptions {
  /** Return focus to the element that was focused before activation. Default `true`. */
  returnFocus?: boolean;
  /**
   * CSS selector for elements to mark `inert` while the trap is active (e.g. `"#app-root"`),
   * hiding them from assistive tech and the tab order. Ancestors of the container are skipped;
   * elements that were already inert are left alone.
   */
  inertSelector?: string;
  /** Where initial focus goes: the first focusable element (default) or the container itself. */
  initialFocus?: "first" | "container";
  /**
   * Called on Escape. Only the top-most active trap receives it, so nested overlays
   * (a ConfirmDialog inside a Drawer) close one at a time.
   */
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Portals that legitimately take focus while an overlay is open (menus, nested dialogs). */
const IGNORE_SELECTOR = "[role='dialog'], [role='menu'], [role='listbox'], [data-focus-trap-ignore]";

function isFocusable(el: HTMLElement): boolean {
  if (el.hidden || el.closest("[inert]")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return el.getClientRects().length > 0;
}

/** Visible, enabled, tabbable descendants of `container` in DOM order. */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

function ensureTabbable(el: HTMLElement) {
  if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
}

/** Stack of active traps; only the top-most one handles keyboard and focus events. */
const activeTraps: symbol[] = [];

/**
 * Keeps keyboard focus inside `ref` while `active` is true: moves focus in on open, wraps Tab /
 * Shift+Tab at the edges, pulls focus back if it escapes, optionally makes the rest of the page
 * `inert`, and restores focus to the opener on close.
 *
 * Works with portals that mount a frame later (retries for a few frames until `ref.current` exists)
 * and with nested overlays (a stack decides which trap is in charge).
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean, opts: FocusTrapOptions = {}): void {
  const { returnFocus = true, inertSelector, initialFocus = "first", onEscape } = opts;
  const onEscapeRef = React.useRef(onEscape);
  React.useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  React.useEffect(() => {
    if (!active) return;
    const id = Symbol("focus-trap");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const inerted: Element[] = [];
    let container: HTMLElement | null = null;
    let raf = 0;
    let attempts = 0;
    let detach: (() => void) | null = null;

    const isTop = () => activeTraps[activeTraps.length - 1] === id;

    const focusInitial = (c: HTMLElement) => {
      const first = initialFocus === "first" ? getFocusable(c)[0] : undefined;
      if (first) {
        first.focus({ preventScroll: true });
      } else {
        ensureTabbable(c);
        c.focus({ preventScroll: true });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!container || !isTop() || e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (onEscapeRef.current) {
          e.preventDefault();
          onEscapeRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusable(container);
      if (items.length === 0) {
        e.preventDefault();
        ensureTabbable(container);
        container.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const inside = current instanceof Node && container.contains(current);
      if (e.shiftKey) {
        if (!inside || current === first) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (!inside || current === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!container || !isTop()) return;
      const target = e.target;
      if (!(target instanceof HTMLElement) || container.contains(target)) return;
      // A menu/listbox/dialog portal owned by something inside the trap may take focus.
      const owner = target.closest(IGNORE_SELECTOR);
      if (owner && owner !== container && !container.contains(owner)) return;
      focusInitial(container);
    };

    const activate = () => {
      const c = ref.current;
      if (!c) {
        // Portals rendered after a mounted-check appear a frame later.
        if (attempts++ < 10) raf = requestAnimationFrame(activate);
        return;
      }
      container = c;
      activeTraps.push(id);
      if (inertSelector) {
        document.querySelectorAll(inertSelector).forEach((el) => {
          if (el === c || el.contains(c) || c.contains(el) || el.hasAttribute("inert")) return;
          el.setAttribute("inert", "");
          inerted.push(el);
        });
      }
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("focusin", onFocusIn);
      detach = () => {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("focusin", onFocusIn);
      };
      if (!c.contains(document.activeElement)) focusInitial(c);
    };
    activate();

    return () => {
      cancelAnimationFrame(raf);
      detach?.();
      const i = activeTraps.indexOf(id);
      if (i >= 0) activeTraps.splice(i, 1);
      for (const el of inerted) el.removeAttribute("inert");
      if (returnFocus && previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref, active, returnFocus, inertSelector, initialFocus]);
}
