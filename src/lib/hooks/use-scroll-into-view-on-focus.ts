import * as React from "react";

export interface ScrollIntoViewOnFocusOptions {
  /** Set `false` to disable (e.g. on desktop-only forms). Default `true`. */
  enabled?: boolean;
  /**
   * Only scroll when a fixed bottom bar is on screen (`--bottom-nav-h` or `--sticky-bar-h` > 0)
   * and the viewport is below `lg`; otherwise the browser's own behaviour is fine. Default `true`.
   */
  onlyWithStickyBar?: boolean;
  /** Vertical alignment passed to `scrollIntoView`. Default `"center"`. */
  block?: ScrollLogicalPosition;
  /** Delay in ms so the keyboard has resized the viewport first. Default `250`. */
  delay?: number;
}

function isFormControl(el: HTMLElement): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable;
}

function stickyBarPresent(): boolean {
  if (window.matchMedia("(min-width: 1024px)").matches) return false;
  const style = window.getComputedStyle(document.documentElement);
  const nav = parseFloat(style.getPropertyValue("--bottom-nav-h")) || 0;
  const bar = parseFloat(style.getPropertyValue("--sticky-bar-h")) || 0;
  return nav > 0 || bar > 0;
}

/**
 * When a form control inside `containerRef` receives focus on a phone, scrolls it to the middle
 * of the viewport so it is not hidden behind the on-screen keyboard or a sticky action bar.
 * Honours prefers-reduced-motion (instant scroll) and cancels if focus moves on before the delay.
 */
export function useScrollIntoViewOnFocus(containerRef: React.RefObject<HTMLElement | null>, opts: ScrollIntoViewOnFocusOptions = {}): void {
  const { enabled = true, onlyWithStickyBar = true, block = "center", delay = 250 } = opts;

  React.useEffect(() => {
    const root = containerRef.current;
    if (!root || !enabled) return;
    let timer = 0;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement) || !isFormControl(target)) return;
      if (onlyWithStickyBar && !stickyBarPresent()) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.activeElement !== target) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ block, behavior: reduce ? "auto" : "smooth" });
      }, delay);
    };
    const onFocusOut = () => window.clearTimeout(timer);

    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, [containerRef, enabled, onlyWithStickyBar, block, delay]);
}
