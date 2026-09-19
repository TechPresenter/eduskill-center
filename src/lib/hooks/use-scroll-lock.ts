import * as React from "react";

let lockCount = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

function lock() {
  if (lockCount++ > 0) return;
  const body = document.body;
  saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  // Compensate the scrollbar gutter on desktop so the page does not shift when it disappears.
  const gutter = window.innerWidth - document.documentElement.clientWidth;
  if (gutter > 0) {
    const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + gutter}px`;
  }
  body.style.overflow = "hidden";
  body.setAttribute("data-scroll-locked", "");
}

function unlock() {
  if (lockCount === 0) return;
  if (--lockCount > 0) return;
  const body = document.body;
  body.style.overflow = saved?.overflow ?? "";
  body.style.paddingRight = saved?.paddingRight ?? "";
  body.removeAttribute("data-scroll-locked");
  saved = null;
}

/**
 * Locks body scroll while `active` is true (modals, drawers, bottom sheets, the mobile menu).
 *
 * Ref-counted: nested or overlapping overlays share one lock and the original body styles are
 * restored only when the last one releases, so no overlay can leave the page unscrollable or
 * unlock it early. Adds `data-scroll-locked` to `<body>` for CSS hooks.
 */
export function useScrollLock(active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
