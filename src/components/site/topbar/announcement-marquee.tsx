"use client";

import * as React from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * The topbar announcements.
 *
 * Moving text is an accessibility hazard, so everything here is built around giving it back to the
 * reader:
 *
 *  - It only moves when it has to. The track is measured after mount; if every announcement already
 *    fits the bar, nothing scrolls at all.
 *  - It pauses on hover and whenever a link inside it takes focus, so a keyboard user can tab
 *    through the announcements without chasing them.
 *  - WCAG 2.2.2 (Pause, Stop, Hide) needs an explicit control for content that moves for more than
 *    five seconds: the toggle at the end is it, and the choice is remembered in localStorage.
 *  - Under prefers-reduced-motion it does not move. The strip becomes an ordinary
 *    horizontally-scrollable row the reader drives themselves.
 *  - The announcements are rendered TWICE for a seamless loop, but only the first copy is in the
 *    accessibility tree; the second is aria-hidden and its links are taken out of the tab order, so
 *    each announcement is met exactly once.
 *
 * CONTAINING-BLOCK NOTE: the transform lives on the inner track and nowhere else. The track has no
 * `position: fixed` descendant, and no ancestor of the sticky site header (or of its fixed menus)
 * gains a transform, a filter or a backdrop-filter from this component.
 */

export interface Announcement {
  text: string;
  href?: string;
}

const STORAGE_KEY = "esk.topbar.marqueePaused";
/** Reading pace, not drama: ~70px a second is a comfortable scan speed for short lines. */
const PX_PER_SECOND = 70;
const MIN_DURATION_S = 18;
const MAX_DURATION_S = 120;

/**
 * The pause choice, as a tiny external store.
 *
 * localStorage cannot be read while rendering on the server, and reading it in an effect would mean
 * a second render for every visitor. `useSyncExternalStore` is the shape React wants for exactly
 * this: the server (and the hydration render) see `false`, the real value arrives once, and every
 * marquee on the page shares it. Every access is wrapped — localStorage throws outright in a private
 * window and with site data blocked, and the toggle must still work for the current page view.
 */
let pausedCache: boolean | null = null;
const pauseListeners = new Set<() => void>();

function getPaused(): boolean {
  if (pausedCache === null) {
    try {
      pausedCache = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      pausedCache = false;
    }
  }
  return pausedCache;
}

function setPaused(paused: boolean) {
  pausedCache = paused;
  try {
    localStorage.setItem(STORAGE_KEY, paused ? "1" : "0");
  } catch {
    /* remembered for this page view only */
  }
  for (const l of pauseListeners) l();
}

function subscribePaused(onChange: () => void): () => void {
  pauseListeners.add(onChange);
  return () => {
    pauseListeners.delete(onChange);
  };
}

/** One run of the announcements. Rendered twice inside the track; the second copy is decorative. */
function AnnouncementRun({ items, decorative, innerRef }: { items: Announcement[]; decorative?: boolean; innerRef?: React.Ref<HTMLUListElement> }) {
  return (
    <ul ref={innerRef} className="flex shrink-0 items-center gap-8 pe-8" aria-hidden={decorative || undefined}>
      {items.map((item, i) => (
        <li key={`${item.text}-${i}`} className="flex items-center gap-2 whitespace-nowrap">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" aria-hidden />
          {item.href ? (
            <Link
              href={item.href}
              tabIndex={decorative ? -1 : undefined}
              className={cn(
                "rounded-sm text-caption text-white/85 underline-offset-4 transition-colors duration-micro hover:text-white hover:underline focus-visible:text-white focus-visible:underline motion-reduce:transition-none",
                // A 16px line of text in a 40px bar is a 16px tap target. The link fills the bar
                // height and a transparent ::after pads it the last 4px to a 44px target, the same
                // trick the pause toggle and the app pill use. It bleeds 2px past the strip, which
                // costs nothing: above is the page edge and below is the header, which paints over it.
                "relative inline-flex h-10 items-center after:absolute after:-inset-y-0.5 after:inset-x-0 after:content-['']"
              )}
            >
              {item.text}
            </Link>
          ) : (
            <span className="text-caption text-white/80">{item.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AnnouncementMarquee({ items, scroll = true, className }: { items: Announcement[]; scroll?: boolean; className?: string }) {
  const reduceMotion = usePrefersReducedMotion();
  const paused = React.useSyncExternalStore(subscribePaused, getPaused, () => false);
  const [overflows, setOverflows] = React.useState(false);
  const [duration, setDuration] = React.useState(MIN_DURATION_S);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const runRef = React.useRef<HTMLUListElement | null>(null);

  // Measure one run against the visible width. Nothing scrolls unless it genuinely does not fit, and
  // the duration is derived from the real width so the speed is the same on a 360px phone and a
  // 1920px desktop.
  React.useEffect(() => {
    const viewport = viewportRef.current;
    const run = runRef.current;
    if (!viewport || !run) return;
    const measure = () => {
      const runWidth = run.scrollWidth;
      const available = viewport.clientWidth;
      setOverflows(runWidth > available + 4);
      setDuration(Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, runWidth / PX_PER_SECOND)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(run);
    return () => ro.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  const animating = scroll && overflows && !reduceMotion;

  return (
    <div role="region" aria-label="Announcements" className={cn("flex min-w-0 flex-1 items-center gap-1.5", className)}>
      <div
        ref={viewportRef}
        className={cn(
          // `relative` so anything absolutely positioned inside anchors here, and the clip so the
          // track can never widen the page. overflow-x-clip, not hidden: nothing inside may scroll.
          "relative min-w-0 flex-1",
          animating ? "overflow-x-clip" : "overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // A soft edge instead of a guillotine, so a half-cut word reads as "there is more" rather
          // than as a layout bug. Only where there IS more: both edges while the track is moving,
          // the trailing edge only when the reader scrolls it themselves. `mask-image` makes a
          // stacking context, NOT a containing block — no fixed descendant is affected by it.
          animating && "[mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%-22px),transparent_100%)]",
          !animating && overflows && "[mask-image:linear-gradient(to_right,black_calc(100%-22px),transparent_100%)]"
        )}
      >
        <div
          className={cn(
            "flex w-max items-center",
            // `animate-marquee` (globals.css) carries the keyframes AND the pause rules: the track
            // stops on :hover, on :focus-within — which is what lets a keyboard user tab through the
            // announcements without chasing them — and whenever it carries `.marquee-paused`, which
            // is the explicit toggle below. prefers-reduced-motion drops the animation there too.
            animating && "animate-marquee",
            animating && paused && "marquee-paused"
          )}
          style={animating ? ({ "--marquee-duration": `${duration.toFixed(1)}s` } as React.CSSProperties) : undefined}
        >
          <AnnouncementRun items={items} innerRef={runRef} />
          {animating && <AnnouncementRun items={items} decorative />}
        </div>
      </div>

      {animating && (
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
          aria-label="Pause announcements"
          title={paused ? "Play announcements" : "Pause announcements"}
          className={cn(
            // 28px circle inside a 40px bar, padded out to a 44 × 44 target by the transparent ::after.
            "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70",
            "ring-1 ring-inset ring-white/20 ring-focus-inverse tap-highlight-none",
            "transition-colors duration-micro hover:bg-white/15 hover:text-white motion-reduce:transition-none",
            "after:absolute after:-inset-2 after:rounded-full after:content-['']"
          )}
        >
          {paused ? <Play className="h-3 w-3" aria-hidden /> : <Pause className="h-3 w-3" aria-hidden />}
        </button>
      )}
    </div>
  );
}
