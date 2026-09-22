"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

function detectMac(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. The server (and first paint) say "Ctrl K". */
export function useShortcutLabel(): string {
  return React.useSyncExternalStore(noopSubscribe, () => (detectMac() ? "⌘K" : "Ctrl K"), () => "Ctrl K");
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/**
 * Global shortcuts: Ctrl K / ⌘K anywhere, and "/" when the visitor is not typing in a field.
 * Ignored while another dialog is open so the palette never stacks on a form's modal.
 */
export function useSearchShortcut(onOpen: () => void, enabled = true) {
  const onOpenRef = React.useRef(onOpen);
  React.useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const k = e.key.toLowerCase();
      const combo = k === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(e.target);
      if (!combo && !slash) return;
      if (document.querySelector("[data-overlay]")) {
        // Another overlay (or the palette itself) is open: just keep the browser's Ctrl K away.
        if (combo) e.preventDefault();
        return;
      }
      e.preventDefault();
      onOpenRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}

interface TriggerProps {
  onOpen: () => void;
  open: boolean;
  className?: string;
}

/**
 * Header search trigger that reads like a search field: icon, placeholder and a Ctrl K hint. It sizes
 * itself to the room the header row leaves (container queries): the placeholder shows from 13rem, the
 * shortcut hint from 6.5rem, and at its 44px minimum it is an icon button — so it can never push the
 * desktop menu into its "More" overflow or the row off-screen.
 */
export function SearchFieldTrigger({ onOpen, open, className }: TriggerProps) {
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="Control+K Meta+K /"
      aria-label={`Search courses, centres and PIN codes (${shortcut})`}
      className={cn(
        "@container flex h-11 w-full min-w-11 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-muted tap-highlight-none",
        "transition-colors duration-micro ease-soft hover:border-navy/30 hover:bg-white active:bg-lavender/60 ring-focus motion-reduce:transition-none",
        className
      )}
    >
      <Search className="h-4.5 w-4.5 shrink-0 text-navy" aria-hidden />
      <span className="hidden min-w-0 flex-1 truncate text-body-sm @[13rem]:block">Search courses, centres, PIN…</span>
      <kbd
        aria-hidden
        className="ml-auto hidden shrink-0 rounded-xs border border-line bg-white px-1.5 py-0.5 font-sans text-caption font-semibold whitespace-nowrap text-muted @[6.5rem]:inline-block"
      >
        {shortcut}
      </kbd>
    </button>
  );
}

/** 44px app-bar icon button for phones. */
export function SearchIconTrigger({ onOpen, open, className }: TriggerProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Search"
      className={cn(
        "touch-target inline-flex items-center justify-center rounded-xl text-navy tap-highlight-none transition-colors duration-micro active:bg-surface ring-focus motion-reduce:transition-none",
        className
      )}
    >
      <Search className="h-6 w-6" aria-hidden />
    </button>
  );
}
