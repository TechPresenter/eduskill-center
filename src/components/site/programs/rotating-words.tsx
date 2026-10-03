"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const STEP_MS = 2200;
/** Stops on the last word after this many rounds: a headline should not move forever (WCAG 2.2.2). */
const ROUNDS = 3;

/**
 * One word (or short phrase) at a time, sliding up into place — the animated line under a hero
 * title. All the words share one grid cell, so the line is always as wide as the longest of them
 * and nothing below it jumps when the word changes.
 *
 * Screen readers get the whole list once (the moving copy is aria-hidden); hovering or focusing it
 * pauses it, and with prefers-reduced-motion the words are simply listed, separated by dots.
 */
export function RotatingWords({ words, className, wordClassName }: { words: string[]; className?: string; wordClassName?: string }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const steps = React.useRef(0);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (reduced || paused || words.length < 2) return;
    const timer = window.setInterval(() => {
      steps.current += 1;
      if (steps.current >= words.length * ROUNDS - 1) window.clearInterval(timer);
      setIndex((i) => (i + 1) % words.length);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [reduced, paused, words.length]);

  if (reduced) {
    return <span className={className}>{words.join(" • ")}</span>;
  }

  return (
    <span className={cn("inline-flex", className)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span className="sr-only">{words.join(", ")}</span>
      <span aria-hidden className="relative inline-grid overflow-hidden align-bottom">
        {words.map((w, i) => (
          <span
            key={w}
            className={cn(
              "[grid-area:1/1] whitespace-nowrap",
              i === index ? "animate-fade-up" : "invisible",
              wordClassName
            )}
          >
            {w}
          </span>
        ))}
      </span>
    </span>
  );
}
