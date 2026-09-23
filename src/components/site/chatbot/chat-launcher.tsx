"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardOpen } from "@/lib/hooks";
import { LAUNCHER_COPY } from "./copy";
import { ORB } from "./chat-theme";

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
 * It sits above the public tab bar and a page's sticky CTA bar rather than on top of them: the bottom
 * offset is the same `--bottom-nav-h + --sticky-bar-h + safe-area` stack that `Fab` and the toaster use.
 * PublicBottomNav publishes `--bottom-nav-h` (4rem) only while it is visible below lg, so on phones the
 * button floats 1rem above the tabs, a course or centre detail page (sticky bar instead of tabs) pushes
 * it above that bar, and on desktop both are 0 and it keeps its 1rem corner. `z-sticky` (20) is the FAB step: over page content,
 * under the header, the drawer, dialogs (z-overlay) and toasts (z-toast). Its labels stay English because it exists before the conversation has a
 * language; `aria-expanded` and `aria-controls` carry the state.
 *
 * THE HEIGHT IS A CONTRACT, NOT A CHOICE. `chat-panel` anchors the desktop card with
 * `sm:bottom-[calc(… + 5.25rem)]`, which is this button's 1rem offset + its 3.5rem height + a 0.75rem
 * gap. Changing `h-14`, or the two anchor classes below, detaches the card from the button on desktop
 * with nothing to fail at compile time — which is why the desktop pill form grows only in WIDTH.
 *
 * The glyph is the assistant's own `Sparkles`, the same mark `AssistantAvatar` puts in the header and
 * beside every reply, rather than the generic `MessageCircle` speech bubble that made this
 * indistinguishable from any support widget.
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
        "fixed z-sticky flex h-14 w-14 items-center justify-center rounded-full text-white",
        // ORB owns the fill, the press and the hover rise. It also owns the transition and the
        // `:active` scale (via `btn-micro`), so nothing here restates them — a second
        // `transition-*`/`active:scale-*` would only fight it.
        ORB,
        "right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(var(--bottom-nav-h)+var(--sticky-bar-h)+env(safe-area-inset-bottom,0px)+1rem)]",
        // Desktop, closed: widen into a labelled pill so the button says what it is instead of
        // asking the visitor to guess from an icon. It stays the 56px circle on phones (where the
        // corner is scarce) and whenever it is the close button. The width is deliberately not
        // animated: a transition from a fixed width to `auto` does not run, and faking it with
        // max-width buys nothing when the open/closed swap already re-renders the contents.
        !open && "sm:w-auto sm:gap-2 sm:px-5",
        keyboardOpen && "pointer-events-none translate-y-6 opacity-0"
      )}
    >
      {pulse && !open && (
        // Three iterations, then `forwards` holds the last keyframe (fully transparent) so the ring
        // rests instead of snapping back — no timer, no state, and reduced motion drops it entirely.
        // Two staggered, low-opacity haloes read as a soft breath rather than the single hard ring a
        // 50% halo drew; the delay is inline because it is a one-off value, not a design token, and
        // it reuses `animate-ping` so no new keyframe enters globals.css.
        //
        // `pointer-events-none` is LOAD-BEARING, not tidiness. `animate-ping` ends at `scale(2)`,
        // and `forwards` keeps it there for as long as `pulse` is true — so each halo is a 112px
        // hit-testable box centred on a 56px button, 28px past every edge. Clicks landing on it
        // still open the chat (it is a child of the button), but the 28px that hangs BELOW reaches
        // into the public bottom nav, and an invisible, fully transparent ring must never eat a tap
        // meant for the tab underneath it. Opting the decoration out of hit testing hands those
        // pixels back and leaves the button its own 56px target.
        <>
          <span
            className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-orange/25 motion-reduce:animate-none"
            style={{ animationIterationCount: 3, animationFillMode: "forwards" }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-orange/15 motion-reduce:animate-none"
            style={{ animationIterationCount: 3, animationFillMode: "forwards", animationDelay: "260ms" }}
            aria-hidden
          />
        </>
      )}
      <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden>
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </span>
      {/* Visible only in the pill form; the circle keeps the icon alone, and the accessible name
          comes from `aria-label` either way, so this text never duplicates it in the a11y tree. */}
      {!open && <span className="hidden text-[15px] font-semibold text-white sm:inline">{LAUNCHER_COPY.label}</span>}
      {unread && !open && (
        <>
          {/* Nudged inward at `sm+` so it rides the pill's rounded end instead of the label's line. */}
          <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-navy ring-2 ring-white sm:top-1 sm:right-1" aria-hidden />
          <span className="sr-only">{LAUNCHER_COPY.unread}</span>
        </>
      )}
    </button>
  );
});
