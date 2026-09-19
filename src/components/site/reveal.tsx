"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SAFETY_MS = 2500;

/**
 * Subtle fade-up entrance for sections as they scroll into view — progressive enhancement only.
 * Content is fully visible in the server HTML and stays visible until hydration; after hydration,
 * only elements still below the fold are hidden and revealed by an IntersectionObserver
 * (with a 2.5 s safety timeout). Users who prefer reduced motion never see the effect.
 */
export function Reveal({ children, className, delay = 0, as: Tag = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" | "article" }) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen at hydration: leave it exactly as rendered (no flash, no animation).
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.style.opacity = "0";
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      el.style.opacity = "";
      el.classList.add("animate-fade-up");
      io.disconnect();
      clearTimeout(timer);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) show();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    io.observe(el);
    const timer = setTimeout(show, SAFETY_MS);
    return () => {
      io.disconnect();
      clearTimeout(timer);
      el.style.opacity = "";
    };
  }, []);

  const Comp = Tag as React.ElementType;
  return (
    <Comp ref={ref} data-reveal className={cn(className)} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </Comp>
  );
}
