"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/hooks";

export interface SwipeRowAction {
  label: string;
  icon: React.ReactNode;
  tone?: "danger" | "navy" | "orange";
  onSelect: () => void;
}

export interface SwipeRowProps {
  /** The visible row (card, list item). */
  children: React.ReactNode;
  /** Actions revealed by swiping left (1–2 recommended). */
  actions: SwipeRowAction[];
  className?: string;
  /** Classes for the sliding content layer (defaults to a white background). */
  contentClassName?: string;
  disabled?: boolean;
  /** Width of each action button in px. Default 72. */
  actionWidth?: number;
}

const TONES: Record<NonNullable<SwipeRowAction["tone"]>, string> = {
  danger: "bg-danger text-white",
  navy: "bg-navy text-white",
  orange: "bg-orange text-white",
};

/** Horizontal movement (px) before a gesture counts as a swipe rather than a scroll. */
const AXIS_LOCK_PX = 6;

/**
 * Swipe-to-reveal row for notification / document lists: drag the content left to expose the actions,
 * release past half-way to snap open, tap outside or press Escape to close. Vertical scrolling is untouched
 * (`touch-pan-y`, axis lock). The snap runs on the 150ms micro duration and the product easing, and is
 * instant under prefers-reduced-motion.
 * Optional enhancement: keep a visible alternative (menu / buttons) for keyboard and desktop users.
 */
export function SwipeRow({ children, actions, className, contentClassName, disabled, actionWidth = 72 }: SwipeRowProps) {
  const reduce = usePrefersReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const start = React.useRef<{ x: number; y: number; offset: number } | null>(null);
  const axis = React.useRef<"x" | "y" | null>(null);
  const moved = React.useRef(false);
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const max = actions.length * actionWidth;
  const revealed = offset > 0;

  React.useEffect(() => {
    if (!revealed) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOffset(0);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOffset(0);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [revealed]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || max === 0) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, offset };
    axis.current = null;
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!axis.current) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis.current === "x") {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (axis.current !== "x") return;
    moved.current = true;
    setOffset(Math.max(0, Math.min(max, s.offset - dx)));
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    if (axis.current === "x") {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      setDragging(false);
      setOffset((o) => (o > max / 2 ? max : 0));
    }
    axis.current = null;
  };

  // A drag must not also fire the row's own click (e.g. a Link inside the content).
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!moved.current) return;
    moved.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={rootRef} className={cn("relative overflow-hidden touch-pan-y select-none", className)} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finish} onPointerCancel={finish}>
      <div className="absolute inset-y-0 right-0 flex" style={{ width: max }} inert={revealed ? undefined : true}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              setOffset(0);
              a.onSelect();
            }}
            className={cn(
              "flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold tap-highlight-none ring-focus-inverse focus-visible:ring-0 focus-visible:ring-offset-0 active:opacity-90",
              TONES[a.tone ?? "navy"]
            )}
            style={{ width: actionWidth }}
          >
            <span className="flex h-6 w-6 items-center justify-center" aria-hidden>
              {a.icon}
            </span>
            {a.label}
          </button>
        ))}
      </div>
      <div
        className={cn("relative z-raised bg-white", !dragging && !reduce && "transition-[translate] duration-micro", contentClassName)}
        style={{ translate: `${-offset}px 0` }}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
