"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useOverlayPresence } from "@/components/ui/bottom-sheet";
import { useIsDesktop } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { MegaMenuFeatureCard } from "./feature-card";
import { MegaMenuRow } from "./menu-row";
import type { CoursesMenuData, MegaMenuLink } from "./types";

/** Hover intent: a pointer crossing the nav must rest this long before the panel opens… */
const OPEN_DELAY_MS = 120;
/** …and may leave for this long (a diagonal move into the panel) before it closes. */
const CLOSE_DELAY_MS = 200;
/** Matches --duration-element: the fade/translate budget, also the unmount delay after closing. */
const PANEL_MS = 250;
/** Minimum distance between the panel and the viewport edge. */
const VIEWPORT_GUTTER = 24;
/** Where the trigger sits along the panel (reference: roughly a quarter of the way in). */
const ANCHOR_RATIO = 0.25;
/** The caret never gets closer than this to a rounded corner. */
const CARET_INSET = 32;
/** Panel width in px (63.5rem); shrunk to the viewport minus both gutters on narrower screens. */
const PANEL_MAX_WIDTH = 1016;

type OpenReason = "hover" | "click" | "keyboard";

const ITEM_SELECTOR = "[data-mega-item]";

/**
 * Desktop "Courses" mega menu — a disclosure (button + panel of ordinary links), not an ARIA menu.
 *
 * Pointer: opens after a short hover delay, closes after a longer one, so sweeping across the nav
 * never flashes it and a diagonal move into the panel keeps it open. A click opens it too and pins
 * it open until an outside click, Escape, a link, or a route change.
 * Keyboard: Enter / Space toggle, ArrowDown opens and focuses the first link, ArrowUp / ArrowDown /
 * Home / End move between links, Escape closes and returns focus to the trigger, and tabbing out of
 * the panel closes it.
 *
 * Render it inside the header's desktop `<li>` (the header shows the nav only at lg+). It carries no
 * blur, filter or transform on any ancestor; the only translate is on the panel card itself.
 */
export function CoursesMegaMenu({
  data,
  label = "Courses",
  active = false,
  className,
}: {
  data: CoursesMenuData;
  label?: string;
  /** The current route is the course catalogue (draws the same underline as the other nav links). */
  active?: boolean;
  /** Extra classes for the trigger, e.g. the header's shared link sizing. */
  className?: string;
}) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const baseId = React.useId();
  const triggerId = `${baseId}-trigger`;
  const panelId = `${baseId}-panel`;

  const [open, setOpen] = React.useState(false);
  const { rendered } = useOverlayPresence(open, PANEL_MS);
  const [entered, setEntered] = React.useState(false);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const caretRef = React.useRef<HTMLSpanElement>(null);
  const reasonRef = React.useRef<OpenReason>("click");
  const focusFirstRef = React.useRef(false);
  const openTimer = React.useRef<number | undefined>(undefined);
  const closeTimer = React.useRef<number | undefined>(undefined);

  const clearTimers = React.useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  const close = React.useCallback(() => {
    clearTimers();
    setOpen(false);
  }, [clearTimers]);

  const show = React.useCallback(
    (reason: OpenReason) => {
      clearTimers();
      reasonRef.current = reason;
      setOpen(true);
    },
    [clearTimers]
  );

  // Close on navigation and when the viewport drops below the desktop nav (render-phase reset).
  const [lastPathname, setLastPathname] = React.useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }
  if (!isDesktop && open) setOpen(false);

  // Closing drops the visual state at once; useOverlayPresence keeps the panel mounted for the fade.
  const [lastOpen, setLastOpen] = React.useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (!open) setEntered(false);
  }

  // Two frames so the panel paints once in its start state before the transition flips.
  React.useEffect(() => {
    if (!open) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open]);

  React.useEffect(() => clearTimers, [clearTimers]);

  const items = React.useCallback((): HTMLElement[] => Array.from(wrapRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []), []);

  // Position the panel inside the viewport and point the caret at the trigger. Written straight to
  // the DOM before paint, so there is no state round-trip and no frame at the wrong spot.
  React.useLayoutEffect(() => {
    if (!rendered) return;
    const place = () => {
      const root = rootRef.current;
      const trigger = triggerRef.current;
      const wrap = wrapRef.current;
      const caret = caretRef.current;
      if (!root || !trigger || !wrap || !caret) return;
      // clientWidth excludes the scrollbar (100vw does not), so size the panel from it here to keep
      // the same 24px gutter on both sides.
      const vw = document.documentElement.clientWidth;
      const width = Math.min(PANEL_MAX_WIDTH, vw - 2 * VIEWPORT_GUTTER);
      wrap.style.width = `${width}px`;
      const t = trigger.getBoundingClientRect();
      const center = t.left + t.width / 2;
      const max = Math.max(VIEWPORT_GUTTER, vw - VIEWPORT_GUTTER - width);
      const left = Math.min(Math.max(center - width * ANCHOR_RATIO, VIEWPORT_GUTTER), max);
      wrap.style.left = `${Math.round(left - root.getBoundingClientRect().left)}px`;
      caret.style.left = `${Math.round(Math.min(Math.max(center - left, CARET_INSET), width - CARET_INSET))}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [rendered]);

  // Keyboard open: move focus to the first link once the panel is in the DOM.
  React.useEffect(() => {
    if (!open || !rendered || !focusFirstRef.current) return;
    focusFirstRef.current = false;
    items()[0]?.focus();
  }, [open, rendered, items]);

  // Outside press and Escape (the latter from anywhere, e.g. while only hovering).
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const focusInside = rootRef.current?.contains(document.activeElement) ?? false;
      close();
      if (focusInside) triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer.current);
    if (open) return;
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => show("hover"), OPEN_DELAY_MS);
  };

  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(openTimer.current);
    // A panel opened by click or keyboard stays until dismissed; only hover-opened panels follow the pointer.
    if (!open || reasonRef.current !== "hover") return;
    // Someone tabbed into the hover-opened panel: keep it open while focus is inside.
    if (wrapRef.current?.contains(document.activeElement)) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(close, CLOSE_DELAY_MS);
  };

  const onTriggerClick = (e: React.MouseEvent) => {
    const keyboard = e.detail === 0; // Enter / Space activation dispatches a click with detail 0.
    if (!open) {
      focusFirstRef.current = keyboard;
      show(keyboard ? "keyboard" : "click");
    } else if (reasonRef.current === "hover" && !keyboard) {
      // The hover delay already opened it; a click here means "keep it open", not "close".
      clearTimers();
      reasonRef.current = "click";
    } else {
      close();
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown") return;
    e.preventDefault();
    if (open) items()[0]?.focus();
    else {
      focusFirstRef.current = true;
      show("keyboard");
    }
  };

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const list = items();
    if (list.length === 0) return;
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (e.key === "ArrowDown") next = list[(index + 1) % list.length];
    else if (e.key === "ArrowUp") next = index <= 0 ? list[list.length - 1] : list[index - 1];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  // Tabbing out of the trigger + panel closes it. A null relatedTarget (a click on plain text inside
  // the panel) is ignored; outside presses are handled by the pointerdown listener.
  const onBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (open && next && !rootRef.current?.contains(next)) close();
  };

  const shown = open && entered;
  const columns: { key: string; title: string; items: MegaMenuLink[] }[] = [
    { key: "popular", title: "Popular courses", items: data.popular },
    { key: "quick", title: "Quick links", items: data.quickLinks },
  ].filter((c) => c.items.length > 0);

  return (
    <div ref={rootRef} className="relative" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "relative inline-flex h-10 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold whitespace-nowrap ring-focus",
          "transition-colors duration-micro ease-soft motion-reduce:transition-none",
          open ? "bg-orange-light text-orange" : active ? "text-orange hover:bg-surface" : "text-navy hover:bg-surface hover:text-navy-dark",
          className
        )}
      >
        {label}
        <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform duration-element ease-soft motion-reduce:transition-none", open && "rotate-180")} />
        {active && !open && <span aria-hidden className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-orange" />}
      </button>

      {/*
        Always in the DOM (display:none while closed) so the links are server-rendered and crawlable,
        but `hidden` keeps the closed panel out of layout, the tab order and document.scrollWidth.
        pt-4.5 is an invisible hover bridge between the trigger and the card.
      */}
      <div
        ref={wrapRef}
        id={panelId}
        role="group"
        aria-labelledby={triggerId}
        hidden={!rendered}
        onKeyDown={onPanelKeyDown}
        className={cn("absolute top-full left-0 z-overlay w-[min(63.5rem,calc(100vw-3rem))] pt-4.5", !shown && "pointer-events-none")}
      >
        <div
          className={cn(
            "relative rounded-lg border border-line bg-white shadow-e3",
            "transition-[opacity,translate] duration-element ease-soft motion-reduce:transition-none",
            shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          )}
        >
          <span ref={caretRef} aria-hidden className="absolute -top-[7px] left-8 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-tl-[3px] border-t border-l border-line bg-white" />
          <div className="flex gap-6 p-4 xl:gap-8">
            <div className="w-52 shrink-0">
              <MegaMenuFeatureCard feature={data.feature} onNavigate={close} />
            </div>
            {columns.map((col, i) => (
              <React.Fragment key={col.key}>
                {i > 0 && <div aria-hidden className="my-2 w-px shrink-0 self-stretch bg-line" />}
                <MegaMenuColumn id={`${baseId}-${col.key}`} title={col.title} items={col.items} onNavigate={close} />
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MegaMenuColumn({ id, title, items, onNavigate }: { id: string; title: string; items: MegaMenuLink[]; onNavigate: () => void }) {
  return (
    <div className="min-w-0 flex-1 py-2">
      <p id={id} className="px-2.5 text-overline text-muted">
        {title}
      </p>
      <ul aria-labelledby={id} className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.href + item.title}>
            <MegaMenuRow item={item} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}
