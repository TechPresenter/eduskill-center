"use client";

import * as React from "react";

/**
 * Keeps the current tab visible inside a strip that scrolls sideways on phones (a list page can carry
 * a dozen status tabs and a 360px screen shows three). Renders nothing: it finds its own strip through
 * `[data-tab-strip]`, so `TabLinks` stays a server component.
 *
 * `hidden` rather than `sr-only` on purpose — an absolutely positioned descendant of an
 * `overflow-x: auto` box escapes it and stretches the page's scrollWidth.
 */
export function TabStripAutoScroll() {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const strip = ref.current?.closest<HTMLElement>("[data-tab-strip]");
    const el = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !el || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: Math.max(0, el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2) });
  });
  return <span ref={ref} hidden aria-hidden="true" />;
}
