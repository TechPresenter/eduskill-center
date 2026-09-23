import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The assistant widget's visual vocabulary — every surface, gradient, bubble, chip and icon-button
 * class string, in one place.
 *
 * WHY THIS FILE EXISTS: the widget is five components (launcher, panel, message, composer, empty
 * state) that are worked on independently. Without one owner for the palette, each file grows its
 * own gradient and its own idea of a radius, and the result stops looking like one product. Every
 * sibling imports from here; NOTHING below may be re-declared locally, and a component that needs a
 * variation adds it as a `cn(CONSTANT, "…")` at the call site rather than forking the constant.
 *
 * NO "use client" ON PURPOSE — same as `copy.ts` and `types.ts`. There is not a hook, an event
 * handler or a browser API in this module, so it is legal in either graph and adds nothing to the
 * server bundle when a server component happens to reach it.
 *
 * ── DESIGN RULES THIS FILE ENCODES ──
 * Gradients stay inside one brand hue and only ever get DARKER (`btn-fill-orange`, `btn-fill-navy`,
 * navy → navy-dark). That is the repo's contrast solution: a gradient that lightens puts white text
 * on a stop nobody measured. Decorative colour is carried by a separate absolutely-positioned
 * `aria-hidden` layer (the `social-links.tsx` idiom) or by the gradient itself, never by a `filter`
 * on a real element — see the containing-block contract below. Movement is `motion-safe:` only, so
 * reduced motion still receives the colour change with nothing sliding. No dark-mode variants: the
 * repo has zero dark tokens and inventing some here would be the only ones in the product.
 *
 * ── CONTAINING-BLOCK CONTRACT (every sibling step must obey this) ──
 * `transform`, `filter`, `backdrop-filter`, `clip-path`, `will-change: transform` and
 * `contain: paint` each turn an element into the containing block for `position: fixed`
 * descendants. A FINISHED animation still counts when it was declared `fill-mode: both` (the repo's
 * `animate-page` leaves an identity `matrix(…)` behind — an identity transform is still a
 * transform). The widget has three fixed elements: the launcher button, the phone backdrop and the
 * panel root. If any ancestor of them acquires one of those properties they stop being viewport-
 * anchored and scroll away with the page. Therefore:
 *   (a) `chat-widget.tsx` must keep returning a BARE FRAGMENT. No step may wrap `<ChatLauncher>` or
 *       `<ChatPanel>` in a positioning div, a motion wrapper or a theme provider element.
 *   (b) NO descendant of the panel may become `position: fixed`. The jump-to-latest button is
 *       `absolute` inside a `relative` parent and must stay that way. That rule is precisely what
 *       makes {@link HEADER_ACCENT}'s `blur-2xl` legal — the blurred span has no fixed descendant,
 *       because it has no descendant at all — and what would also have made a `backdrop-filter` on
 *       the panel root legal (it is excluded for cost, not for correctness: a full-screen blur is
 *       the most expensive thing this audience's low-end Android phones can be asked to paint).
 *   (c) The launcher's OWN transforms are fine — `btn-micro`'s `:active { scale(.97) }`, the
 *       `motion-safe:hover:-translate-y-0.5` in {@link ORB}, the keyboard-open `translate-y-6`.
 *       Its children are `absolute`, never `fixed`, so nothing is re-parented.
 *
 * ── `cn()` HAZARD ──
 * `cn()` teaches tailwind-merge the repo's custom type scale, which means an unrecognised `text-*`
 * token is filed as a COLOUR and two of them collide. The bubble and chip sizes below are therefore
 * written as arbitrary brackets (`text-[15px]`, `text-[13px]`, `text-[12px]`), which tailwind-merge
 * reads as a real font-size and keeps alongside `text-navy` / `text-ink`. Do not "improve" them to
 * `text-body-sm` — that silently drops the size the moment a caller adds a colour.
 */

/**
 * The tint behind the message list. LOAD-BEARING: the assistant bubble is WHITE, so it only reads as
 * a raised card against this. `chat-panel` puts it on the scroll wrapper; `chat-empty-state` assumes
 * it. If either file inlines `bg-white` there instead, the conversation becomes white-on-white.
 */
export const CONVERSATION_SURFACE = "bg-surface";

/**
 * Panel header shell. `overflow-hidden` is what keeps {@link HEADER_ACCENT} inside the rounded top
 * corners, and `relative` is what the two decorative layers below position against.
 */
export const HEADER_SHELL = "relative shrink-0 overflow-hidden bg-navy text-white";

/**
 * Header depth, as a separate `aria-hidden` LEAF `<span>` rather than a gradient on the header
 * itself — the social-links idiom, and the reason the header can carry depth without becoming a
 * containing block. Within-hue and never lighter than `navy-light`: white over the lightest
 * composite stop (~#1A4497) measures ~9:1, so both the title and the 12px subtitle clear 4.5:1.
 */
export const HEADER_GLOW = "pointer-events-none absolute inset-0 bg-linear-to-br from-navy-light/70 via-navy/0 to-navy-dark/70";

/**
 * The one warm accent, and the ONE `filter` in the whole widget. It is a CHILDLESS `aria-hidden`
 * leaf span inside the header's `overflow-hidden`, so it can never become the containing block of
 * anything (see the contract above). It sits in the top-right corner, away from the title; at /20
 * over navy the close and voice icons still clear 4.5:1 where they overlap it.
 */
export const HEADER_ACCENT = "pointer-events-none absolute -top-8 -right-6 h-24 w-24 rounded-full bg-orange/20 blur-2xl";

/**
 * The launcher fill.
 *
 * `btn-fill-orange` is the repo's contrast solution rather than a decoration: the gradient DEEPENS
 * downward and has reached #C94104 (4.95:1 against white) by 22% of the height, so a white glyph
 * never sits on the 3.72:1 brand orange. `bg-orange` stays underneath as the forced-colors and
 * no-gradient fallback.
 *
 * DO NOT add `btn-lift`: it sets `box-shadow: var(--shadow-e2)` on hover, which is BELOW the
 * launcher's resting `shadow-e3` — the button would visually sink when you point at it. The 2px
 * `motion-safe` rise plus `btn-micro`'s press is the lift instead. DO NOT add `btn-shine` either:
 * it runs 560ms (over this widget's 300ms ceiling) and it claims `::after`.
 */
export const ORB = cn(
  "bg-orange btn-fill-orange btn-micro",
  "shadow-e3 tap-highlight-none ring-focus-inverse",
  "transition-[box-shadow,opacity] duration-micro ease-soft motion-reduce:transition-none",
  "motion-safe:hover:-translate-y-0.5"
);

/** Geometry and typography shared by both bubbles; the fills below add the colour. */
export const BUBBLE_BASE = "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-6";

/**
 * Assistant reply: a white card on the {@link CONVERSATION_SURFACE} tint, with the tail corner
 * squared off. `ring-1 ring-line` draws the hairline — a RING, while `ring-focus*` draws an
 * `outline`, so the border and the focus indicator can never collide or hide each other.
 */
export const BUBBLE_ASSISTANT = cn(BUBBLE_BASE, "rounded-bl-md bg-white text-ink shadow-e1 ring-1 ring-line");

/**
 * Visitor turn. Narrower than the assistant bubble so the two sides are never mistaken for each
 * other, and within-hue: navy → navy-dark only ever darkens, so the worst case is white on #12357A
 * at 11.57:1. `bg-navy` underneath is the fallback when the gradient does not paint.
 */
export const BUBBLE_USER =
  "max-w-[88%] rounded-2xl rounded-br-md bg-navy bg-linear-to-br from-navy via-navy to-navy-dark px-3.5 py-2.5 text-[15px] leading-6 text-white shadow-e1";

/**
 * A quick-question row. Full-width rows, NOT wrapped pills: the panel is 400px at its widest, so two
 * pills could never share a line and a pill row would degrade into a ragged one-per-line list
 * anyway. `min-h-11` is the 44px touch target; `group/chip` is named so a caller can style an icon
 * inside without colliding with an outer `group`.
 */
export const CHIP = cn(
  "group/chip flex min-h-11 w-full items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 text-left text-[13px] leading-5 font-medium text-navy",
  "shadow-e1 ring-1 ring-line tap-highlight-none press-scale ring-focus",
  "transition-[box-shadow,background-color] duration-micro ease-soft hover:bg-lavender/50 hover:shadow-e2 hover:ring-navy/25",
  "disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
);

/**
 * A non-interactive "what I can help with" tag. Deliberately has no hover, no ring and no press: it
 * is a label, and anything that looks pressable in a chat panel will be pressed.
 */
export const CAPABILITY = "inline-flex items-center gap-1.5 rounded-full bg-lavender px-2.5 py-1 text-[12px] leading-4 font-semibold text-navy";

/**
 * Header icon buttons (close, clear, voice, language).
 *
 * `ring-focus-inverse` is the point: the widget currently uses the global orange-ring-on-white
 * treatment everywhere, and orange on navy is very nearly invisible. The white ring is the
 * documented fix for a control sitting on a brand surface. 36px on desktop where the pointer is
 * precise, 44px below `sm` where a thumb has to find it.
 */
export const ICON_BTN_ON_NAVY =
  "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/85 transition-colors duration-micro ease-soft hover:bg-white/15 hover:text-white ring-focus-inverse tap-highlight-none press-scale motion-reduce:transition-none max-sm:h-11 max-sm:w-11";

/**
 * Composer icon-button base (mic, send, stop). Geometry and motion ONLY — the caller supplies both
 * the fill and the focus ring, because the same 44px circle is a ghost mic on white, a filled orange
 * send and a navy stop.
 *
 * THE FOCUS RING IS DELIBERATELY NOT HERE. It used to be: the base carried `ring-focus` and the
 * three filled call sites appended `ring-focus-inverse` on top. `cn()`'s tailwind-merge has no idea
 * those two custom utilities conflict, so it kept BOTH and the winner was decided by the order the
 * two `@utility` rules happen to be emitted in the stylesheet — same specificity, last one wins.
 * It resolved correctly by luck, and would have flipped silently the day globals.css reordered.
 * A utility whose override cannot be expressed in `cn()` does not belong in a shared base, so each
 * call site now states the one ring that matches the surface it painted: `ring-focus-inverse` on a
 * navy or orange fill, `ring-focus` on white. Exactly one ring class reaches the element.
 */
export const ICON_BTN_ON_WHITE =
  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full tap-highlight-none press-scale transition-[background-color,border-color,color,box-shadow] duration-micro ease-soft motion-reduce:transition-none";

/**
 * Send. Same deepening orange as the launcher, so the widget's one primary action looks the same
 * wherever it appears. `disabled:opacity-40` reads as "nothing to send yet" without changing hue.
 */
export const SEND_BTN = cn(ICON_BTN_ON_WHITE, "bg-orange btn-fill-orange text-white ring-focus-inverse shadow-e1 disabled:pointer-events-none disabled:opacity-40");

/**
 * Stop-generating. Navy, not orange: it is the counterpart of send, not a second primary action, and
 * a red "stop" would read as an error in a panel that already has a red error banner.
 */
export const STOP_BTN = cn(ICON_BTN_ON_WHITE, "bg-navy btn-fill-navy text-white ring-focus-inverse shadow-e1");

/**
 * The caret that trails a streaming reply. `animate-pulse` is Tailwind's built-in opacity loop —
 * already used by `Skeleton` and by the typing dots — so a blinking caret costs no new keyframes and
 * no globals.css change. `align-baseline` plus the small nudge keeps it sitting on the text baseline
 * instead of floating above the last word.
 */
export const STREAM_CARET =
  "ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] rounded-full bg-orange align-baseline animate-pulse motion-reduce:animate-none";

/** Per-size geometry for {@link AssistantAvatar}: the tile, and the glyph that sits in it. */
const AVATAR_SIZES = {
  sm: { box: "h-7 w-7 rounded-lg", glyph: "h-3.5 w-3.5", dot: false },
  md: { box: "h-9 w-9 rounded-xl", glyph: "h-4.5 w-4.5", dot: true },
  lg: { box: "h-14 w-14 rounded-2xl", glyph: "h-7 w-7", dot: true },
} as const;

/**
 * The assistant's identity mark: one sparkle tile that now appears on the launcher, in the header,
 * beside every assistant reply and as the empty state's hero. Before this, the entry point and the
 * thing it opened shared no visual identity at all.
 *
 * ALWAYS `aria-hidden`. It is decoration in every one of those places — the accessible name comes
 * from real text or from the host control's `aria-label`, never from this mark. That also means it
 * can be dropped into a button without adding a second name to it.
 *
 * `md` and `lg` carry a small orange presence dot. Its ring has to match whatever the tile sits on,
 * which is why `ringTone` is a prop rather than a function of the size: `md` in the navy header
 * wants `ring-navy`, the same `md` on a white bubble row wants the default `ring-white`.
 *
 * No gradient text, no photography, no external font or image service — the whole mark is two spans
 * and a lucide glyph.
 */
export function AssistantAvatar({
  size = "md",
  ringTone = "white",
  className,
}: {
  size?: "sm" | "md" | "lg";
  /** Colour the presence dot's 2px ring must blend into — the surface BEHIND the avatar. */
  ringTone?: "white" | "navy";
  className?: string;
}) {
  const s = AVATAR_SIZES[size];

  return (
    <span
      aria-hidden
      className={cn(
        // Within-hue and darkening, like every other gradient in the widget: navy-light → navy-dark
        // keeps white at ~7:1 even over the lightest stop.
        "relative inline-flex shrink-0 items-center justify-center bg-linear-to-br from-navy-light to-navy-dark text-white",
        s.box,
        className
      )}
    >
      <Sparkles className={s.glyph} />
      {s.dot && (
        <span className={cn("absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-orange ring-2", ringTone === "navy" ? "ring-navy" : "ring-white")} />
      )}
    </span>
  );
}
