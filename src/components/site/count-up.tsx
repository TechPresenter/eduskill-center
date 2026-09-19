"use client";

import * as React from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

const fmt = new Intl.NumberFormat("en-IN");

/**
 * Animated counter for statistics. Server-renders the final value (SEO) and counts up
 * from zero once the number scrolls into view. Respects reduced-motion.
 */
export function CountUp({ value, suffix = "", duration = 1400, className }: { value: number; suffix?: string; duration?: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [display, setDisplay] = React.useState(value);
  // Keep the shown number in sync if the value prop changes (adjust-state-on-prop-change pattern).
  const [lastValue, setLastValue] = React.useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDisplay(value);
  }

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Without motion (or without IntersectionObserver) the final value is already rendered.
    if (reduceMotion || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(value * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        setDisplay(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration, reduceMotion]);

  return (
    <span ref={ref} className={className} aria-label={`${fmt.format(value)}${suffix}`}>
      {fmt.format(display)}
      {suffix}
    </span>
  );
}
