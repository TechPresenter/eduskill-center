"use client";

import * as React from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardOpen } from "@/lib/hooks";
import { LAUNCHER_COPY } from "./copy";

export interface ChatLauncherProps {
  open: boolean;
  onToggle: () => void;
  /** Id of the panel this button controls (for `aria-controls`). */
  panelId: string;
  /** Small dot: the greeting has not been opened in this tab, or a reply landed while it was closed. */
  unread: boolean;
  /** Runs the attention pulse three times, then rests (CSS-driven, disabled under reduced motion). */
  pulse: boolean;
}

/**
 * The floating entry point, bottom-right on every public page.
 *
 * It sits above a page's sticky CTA bar rather than on top of it: the bottom offset is the same
 * `--bottom-nav-h + --sticky-bar-h + safe-area` stack that `Fab` and the toaster use, so a course or
 * centre detail page pushes it up automatically. `z-sticky` (20) is the FAB step: over page content,
 * under the header, the drawer, dialogs (z-overlay) and toasts (z-toast). Its labels stay English because it exists before the conversation has a
 * language; `aria-expanded` and `aria-controls` carry the state.
 */
export const ChatLauncher = React.forwardRef<HTMLButtonElement, ChatLauncherProps>(function ChatLauncher({ open, onToggle, panelId, unread, pulse }, ref) {
  const keyboardOpen = useKeyboardOpen();

  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-label={open ? LAUNCHER_COPY.close : LAUNCHER_COPY.open}
      aria-expanded={open}
      aria-controls={panelId}
      className={cn(
        "fixed z-sticky flex h-14 w-14 items-center justify-center rounded-full bg-orange text-white shadow-e3 transition-[transform,opacity,background-color] duration-micro tap-highlight-none active:scale-95 motion-reduce:transition-none",
        "right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(var(--bottom-nav-h)+var(--sticky-bar-h)+env(safe-area-inset-bottom,0px)+1rem)]",
        "hover:bg-orange-hover",
        keyboardOpen && "pointer-events-none translate-y-6 opacity-0"
      )}
    >
      {pulse && !open && (
        // Three iterations, then `forwards` holds the last keyframe (fully transparent) so the ring
        // rests instead of snapping back — no timer, no state, and reduced motion drops it entirely.
        <span
          className="absolute inset-0 animate-ping rounded-full bg-orange/50 motion-reduce:animate-none"
          style={{ animationIterationCount: 3, animationFillMode: "forwards" }}
          aria-hidden
        />
      )}
      <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden>
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </span>
      {unread && !open && (
        <>
          <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-navy ring-2 ring-white" aria-hidden />
          <span className="sr-only">{LAUNCHER_COPY.unread}</span>
        </>
      )}
    </button>
  );
});
