"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * App-style route transition: remounts on every pathname change and plays the 220ms `animate-page`
 * fade/slide (disabled under prefers-reduced-motion). The animation class is dropped once it finishes
 * so no transform lingers on the wrapper — `animate-page` has `fill-mode: both`, so even after it ends
 * the computed transform stays an identity `matrix(...)` rather than `none`, and any non-`none`
 * transform makes the wrapper the containing block for `position: fixed` descendants (a Fab or a
 * StickyActionBar would then scroll away with the document instead of staying pinned).
 */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  return (
    <Animated key={pathname} className={className}>
      {children}
    </Animated>
  );
}

function Animated({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [done, setDone] = React.useState(false);

  // `onAnimationEnd` alone is not enough: on a server-rendered page the 220ms animation usually
  // finishes before React hydrates, so the event is never seen and the class would stay forever.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pending = el.getAnimations().filter((a) => a.playState !== "finished");
    if (pending.length === 0) {
      setDone(true);
      return;
    }
    let cancelled = false;
    void Promise.allSettled(pending.map((a) => a.finished)).then(() => {
      if (!cancelled) setDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div ref={ref} className={cn(!done && "animate-page motion-reduce:animate-none", className)}>
      {children}
    </div>
  );
}
