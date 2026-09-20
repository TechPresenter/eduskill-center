/**
 * Internals for `<Carousel>` (src/components/ui/carousel.tsx): measurement, snap scrolling and
 * autoplay state. Kept out of the component so the JSX stays readable.
 *
 * The slider is native CSS scroll-snap — the browser owns the gesture, the momentum and the snap.
 * JavaScript only *reads* the scroll position (never writes during a gesture) and *writes* it when a
 * control is used, so touch swiping feels exactly like the platform.
 *
 * No "use client" on purpose: this module has no boundary of its own (same as `@/lib/hooks`), it is
 * pulled into the client bundle by carousel.tsx. Assumes a left-to-right writing mode.
 */
import * as React from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

/* ───────────── Responsive slides-per-view ───────────── */

/** Breakpoints the carousel understands; they mirror Tailwind sm/md/lg/xl. */
export const CAROUSEL_BREAKPOINTS = ["base", "sm", "md", "lg", "xl"] as const;
export type CarouselBreakpoint = (typeof CAROUSEL_BREAKPOINTS)[number];

/**
 * How many slides are visible at once. A plain number applies everywhere; an object sets it per
 * breakpoint and fills forward (`{ base: 1.15, lg: 3 }` → 1.15 up to `lg`, then 3).
 * Fractional values are allowed and are how you "peek" the next card on phones.
 */
export type SlidesPerView = number | Partial<Record<CarouselBreakpoint, number>>;

/** The custom property each breakpoint writes; the media-query cascade lives in globals.css. */
const PER_VIEW_VAR: Record<CarouselBreakpoint, string> = {
  base: "--cr-b",
  sm: "--cr-sm",
  md: "--cr-md",
  lg: "--cr-lg",
  xl: "--cr-xl",
};

const clampPerView = (n: number) => Math.min(12, Math.max(1, n));

/**
 * Turns `slidesPerView` + `gap` into the custom properties the track needs. Every breakpoint gets an
 * explicit value (forward-filled) so the CSS cascade never has to guess, and the slide width stays a
 * pure CSS calc — the layout is already correct in the server render, before any measurement.
 */
export function carouselTrackStyle(slidesPerView: SlidesPerView = 1, gap = 4): React.CSSProperties {
  const spec = typeof slidesPerView === "number" ? { base: slidesPerView } : slidesPerView;
  const vars: Record<string, string> = { "--cr-gap": `${Math.max(0, gap) * 0.25}rem` };
  let current = clampPerView(spec.base ?? 1);
  for (const bp of CAROUSEL_BREAKPOINTS) {
    const v = spec[bp];
    if (typeof v === "number" && Number.isFinite(v)) current = clampPerView(v);
    vars[PER_VIEW_VAR[bp]] = String(current);
  }
  return { ...vars, gap: "var(--cr-gap)" } as React.CSSProperties;
}

/**
 * The `base` slides-per-view, whole slides only. The server cannot measure anything, so this is what the
 * first render assumes: it makes the pre-hydration dot/arrow row correct at phone widths and, when every
 * slide already fits, keeps the server from painting controls that hydration then removes.
 */
export function basePerView(slidesPerView: SlidesPerView = 1): number {
  const spec = typeof slidesPerView === "number" ? { base: slidesPerView } : slidesPerView;
  return clampPerView(spec.base ?? 1);
}

/** Slide width for the current breakpoint, derived from `--cr-n` (resolved in globals.css). */
export const CAROUSEL_SLIDE_STYLE: React.CSSProperties = {
  flex: "0 0 calc((100% - (var(--cr-n) - 1) * var(--cr-gap)) / var(--cr-n))",
};

/* ───────────── Measurement ───────────── */

export interface CarouselMetrics {
  /** Index of the first slide at the current snap stop — what the dots and "n of m" report. */
  index: number;
  /** Reachable snap stops (`slides - visible + 1`), i.e. how many dots to draw. */
  stops: number;
  /** Slides visible at once, measured from the real DOM rather than trusted from the prop. */
  visible: number;
  atStart: boolean;
  atEnd: boolean;
  /** `false` until the first client measurement; the SSR render assumes the `base` breakpoint. */
  measured: boolean;
}

const px = (value: string) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/** Live read of the scroller. Cheap enough for a rAF-throttled scroll handler. */
export function measureTrack(track: HTMLElement): Omit<CarouselMetrics, "measured"> {
  const slides = Array.from(track.children) as HTMLElement[];
  const count = slides.length;
  if (count === 0) return { index: 0, stops: 1, visible: 1, atStart: true, atEnd: true };

  const cs = getComputedStyle(track);
  const padStart = px(cs.paddingInlineStart);
  const gap = px(cs.columnGap);
  const inner = track.clientWidth - padStart - px(cs.paddingInlineEnd);
  const slideWidth = slides[0].getBoundingClientRect().width;
  const visible = Math.max(1, Math.min(count, Math.round((inner + gap) / Math.max(1, slideWidth + gap))));
  const stops = Math.max(1, count - visible + 1);

  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  const left = track.scrollLeft;
  const atStart = left <= 1;
  const atEnd = left >= maxScroll - 1;

  let index = 0;
  if (atEnd) {
    index = stops - 1; // the tail stop never matches exactly: the last card sits flush with the right edge
  } else if (!atStart) {
    const origin = track.getBoundingClientRect().left + padStart;
    let best = Number.POSITIVE_INFINITY;
    slides.forEach((slide, i) => {
      const d = Math.abs(slide.getBoundingClientRect().left - origin);
      if (d < best - 0.5) {
        best = d;
        index = i;
      }
    });
    index = Math.min(index, stops - 1);
  }
  return { index, stops, visible, atStart, atEnd };
}

/** Scrolls stop `i` to the start of the scrollport. The caller picks `behavior` (reduced motion → instant). */
export function scrollToStop(track: HTMLElement, i: number, behavior: ScrollBehavior): void {
  const slides = Array.from(track.children) as HTMLElement[];
  const target = slides[Math.max(0, Math.min(i, slides.length - 1))];
  if (!target) return;
  const padStart = px(getComputedStyle(track).paddingInlineStart);
  const delta = target.getBoundingClientRect().left - track.getBoundingClientRect().left - padStart;
  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  const left = Math.max(0, Math.min(track.scrollLeft + delta, maxScroll));
  track.scrollTo({ left, behavior });
}

/** `useLayoutEffect` on the client, `useEffect` on the server (no SSR warning). */
const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/* ───────────── State machine ───────────── */

export interface UseCarouselOptions {
  /** Slides rendered (used for the pre-measurement SSR guess). */
  count: number;
  /** `base` slides-per-view, so the first (unmeasured) render guesses the right number of stops. */
  ssrPerView: number;
  /** Wrap around at the ends instead of stopping. */
  loop: boolean;
  /** Autoplay interval in ms; `0` disables it. */
  autoPlayMs: number;
  pauseOnHover: boolean;
  /** Stop autoplay for good once the visitor swipes, clicks an arrow/dot or uses the arrow keys. */
  pauseOnInteraction: boolean;
  onSlideChange?: (index: number) => void;
}

export interface CarouselApi {
  rootRef: React.RefObject<HTMLElement | null>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  metrics: CarouselMetrics;
  /** Scroll to a stop. `user` marks it as a deliberate interaction (see `pauseOnInteraction`). */
  goTo: (index: number, user?: boolean) => void;
  next: (user?: boolean) => void;
  prev: (user?: boolean) => void;
  /** Autoplay is configured AND allowed (i.e. not suppressed by prefers-reduced-motion). */
  autoPlayEnabled: boolean;
  /** The timer is ticking right now — false while hovered, focused, off-screen, backgrounded or stopped. */
  running: boolean;
  /** The visitor (or the play/pause button) has stopped autoplay. */
  stopped: boolean;
  toggle: () => void;
  /** Increments on every automatic advance; restarts the progress animation. */
  tick: number;
  /** Spread onto the carousel root. */
  rootHandlers: {
    onPointerEnter: React.PointerEventHandler;
    onPointerLeave: React.PointerEventHandler;
    onFocus: React.FocusEventHandler;
    onBlur: React.FocusEventHandler;
  };
}

export function useCarousel({ count, ssrPerView, loop, autoPlayMs, pauseOnHover, pauseOnInteraction, onSlideChange }: UseCarouselOptions): CarouselApi {
  const rootRef = React.useRef<HTMLElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const reduce = usePrefersReducedMotion();

  const [metrics, setMetrics] = React.useState<CarouselMetrics>(() => {
    // Same value on the server and in the hydrating render (no mismatch); the layout effect measures for real.
    const visible = Math.max(1, Math.min(Math.max(1, count), Math.floor(ssrPerView)));
    const stops = Math.max(1, count - visible + 1);
    return { index: 0, stops, visible, atStart: true, atEnd: stops <= 1, measured: false };
  });
  const [stopped, setStopped] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [inView, setInView] = React.useState(true);
  const [pageVisible, setPageVisible] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  const sync = React.useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const m = measureTrack(track);
    setMetrics((prev) =>
      prev.measured && prev.index === m.index && prev.stops === m.stops && prev.visible === m.visible && prev.atStart === m.atStart && prev.atEnd === m.atEnd
        ? prev
        : { ...m, measured: true }
    );
  }, []);

  // First measurement before paint, so the dots and arrows never flash a wrong state on the client.
  useIsoLayoutEffect(() => {
    sync();
  }, [sync, count]);

  // Read the scroller on scroll (rAF-throttled) and whenever the track or a slide resizes.
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        sync();
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(track);
    for (const child of Array.from(track.children)) ro.observe(child);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      track.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [sync, count]);

  const lastIndex = React.useRef(0);
  React.useEffect(() => {
    if (!metrics.measured || lastIndex.current === metrics.index) return;
    lastIndex.current = metrics.index;
    onSlideChange?.(metrics.index);
  }, [metrics.index, metrics.measured, onSlideChange]);

  const goTo = React.useCallback(
    (target: number, user = false) => {
      const track = trackRef.current;
      if (!track) return;
      const { stops } = measureTrack(track); // always fresh: the viewport may have changed since the last render
      let i = target;
      if (i < 0) i = loop ? stops - 1 : 0;
      else if (i > stops - 1) i = loop ? 0 : stops - 1;
      if (user && pauseOnInteraction && autoPlayMs > 0) setStopped(true);
      scrollToStop(track, i, reduce ? "instant" : "smooth");
    },
    [loop, pauseOnInteraction, autoPlayMs, reduce]
  );

  const next = React.useCallback((user = false) => goTo(metrics.index + 1, user), [goTo, metrics.index]);
  const prev = React.useCallback((user = false) => goTo(metrics.index - 1, user), [goTo, metrics.index]);

  const autoPlayEnabled = autoPlayMs > 0 && !reduce;
  const running =
    autoPlayEnabled && !stopped && metrics.stops > 1 && inView && pageVisible && !(pauseOnHover && hovered) && !focused && (loop || !metrics.atEnd);

  // One self-rearming timeout: a manual move (index change) and an automatic advance (tick) both
  // restart the dwell, which keeps the timer and the progress bar in lockstep.
  React.useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      goTo(metrics.index + 1);
      setTick((v) => v + 1);
    }, autoPlayMs);
    return () => window.clearTimeout(id);
  }, [running, autoPlayMs, tick, metrics.index, goTo]);

  // An off-screen carousel does not steal attention (or battery).
  React.useEffect(() => {
    const root = rootRef.current;
    if (!autoPlayEnabled || !root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold: 0 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [autoPlayEnabled]);

  React.useEffect(() => {
    if (!autoPlayEnabled) return;
    const onVisibility = () => setPageVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [autoPlayEnabled]);

  // A swipe or a wheel/trackpad gesture counts as taking over.
  React.useEffect(() => {
    const track = trackRef.current;
    if (!pauseOnInteraction || autoPlayMs <= 0 || !track) return;
    const takeOver = () => setStopped(true);
    track.addEventListener("pointerdown", takeOver, { passive: true });
    track.addEventListener("wheel", takeOver, { passive: true });
    return () => {
      track.removeEventListener("pointerdown", takeOver);
      track.removeEventListener("wheel", takeOver);
    };
  }, [pauseOnInteraction, autoPlayMs]);

  const toggle = React.useCallback(() => {
    // Resuming is an explicit request, so neither the pointer parked on the play button nor the focus ring
    // on it may keep the rotation paused — otherwise pressing play appears to do nothing. Leaving and
    // re-entering (or moving focus on) fires pointerenter/focusin again and pauses it as usual.
    if (stopped) {
      setFocused(false);
      setHovered(false);
    }
    setStopped(!stopped);
    setTick((v) => v + 1);
  }, [stopped]);

  const rootHandlers = React.useMemo(
    () => ({
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") setHovered(true);
      },
      onPointerLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: (e: React.FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      },
    }),
    []
  );

  return { rootRef, trackRef, metrics, goTo, next, prev, autoPlayEnabled, running, stopped, toggle, tick, rootHandlers };
}
