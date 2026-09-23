"use client";

import * as React from "react";

/**
 * The 3px strip across the top of the window showing how far through the article the reader is.
 *
 * It is DECORATION, not a control and not an announcement: `aria-hidden`, no `role`, no
 * `aria-valuenow`. A progressbar role would make a screen reader narrate a number that changes on
 * every scroll frame, which is noise — the reader already knows where they are in the document.
 *
 * Two things here are load-bearing and were both learned the hard way in this codebase:
 *
 * 1. The `transform` lives ONLY on the inner `<span>` (`reading-progress-bar`). A transform makes
 *    an element the containing block for its `position: fixed` descendants; the rail itself is
 *    fixed, so scaling the rail — or any ancestor of it — is how the Fab, the sticky action bar
 *    and the mobile menu each broke in turn. Never move it outwards.
 * 2. Scroll is measured inside a `requestAnimationFrame`, so a fast flick does one layout read per
 *    painted frame instead of one per scroll event.
 *
 * It survives `prefers-reduced-motion` on purpose: the bar is information about position, not an
 * animation, and the CSS carries no transition for reduced motion to switch off.
 */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const [ratio, setRatio] = React.useState(0);
  /** False until we know the article is actually taller than the viewport. */
  const [scrollable, setScrollable] = React.useState(false);

  React.useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      // The article is "being read" from the moment its top passes the top of the viewport until
      // its bottom does. Measuring against the element, not the document, keeps the hero, the
      // related strip and the footer out of the calculation — otherwise the bar reads 60% when
      // the last paragraph is on screen.
      const span = rect.height - viewport;
      if (span <= 0) {
        // A short post fits on one screen: there is no progress to report, so report none rather
        // than a bar that jumps 0 → 100 on a single wheel tick.
        setScrollable(false);
        setRatio(0);
        return;
      }
      setScrollable(true);
      setRatio(Math.min(1, Math.max(0, -rect.top / span)));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [targetId]);

  if (!scrollable) return null;

  return (
    <div className="reading-progress" aria-hidden>
      {/* The island writes the custom property; `reading-progress-bar` does the painting. */}
      <span className="reading-progress-bar" style={{ "--reading-progress": ratio } as React.CSSProperties} />
    </div>
  );
}
