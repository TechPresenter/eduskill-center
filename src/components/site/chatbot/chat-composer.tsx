"use client";

import * as React from "react";
import { Mic, SendHorizontal, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsCoarsePointer } from "@/lib/hooks";
import { useSpeechInput } from "./use-speech";
import { ICON_BTN_ON_WHITE, SEND_BTN, STOP_BTN } from "./chat-theme";
import { MAX_MESSAGE_CHARS, type ChatLang } from "./types";
import type { ChatCopy } from "./copy";

export interface ChatComposerProps {
  t: ChatCopy;
  lang: ChatLang;
  /** A reply is streaming: the send button becomes Stop. */
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const MAX_ROWS_PX = 120;
const COUNTER_FROM = MAX_MESSAGE_CHARS - 200;

/**
 * The input row: auto-growing textarea, optional dictation and one primary action that flips between
 * Send and Stop. The draft lives here and is never cleared by a failure — only by a successful send.
 *
 * The three controls live INSIDE one capsule rather than floating beside it: the `<form>` owns the
 * border, the shadow and the focus ring, and the textarea is frameless on a transparent background.
 * That is why the focus treatment is `focus-within:*` on the form (the field itself can no longer
 * draw it) and why the dictation highlight moved up here too — while the mic is live the whole
 * capsule turns orange, which is a far clearer "we are recording" signal than one glowing circle.
 */
export function ChatComposer({ t, lang, busy, onSend, onStop }: ChatComposerProps) {
  const [draft, setDraft] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const dictationBase = React.useRef("");
  const coarsePointer = useIsCoarsePointer();
  const fieldId = React.useId();
  const countId = `${fieldId}-count`;

  const handleTranscript = React.useCallback((text: string) => {
    const base = dictationBase.current;
    const merged = `${base}${base && !base.endsWith(" ") ? " " : ""}${text}`.slice(0, MAX_MESSAGE_CHARS);
    setDraft(merged);
  }, []);

  const speech = useSpeechInput(handleTranscript);

  // Grow with the content up to five-ish rows, then scroll inside the field.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
    // Only the capped field scrolls; otherwise the browser paints a scrollbar over a field that fits.
    el.style.overflowY = el.scrollHeight > MAX_ROWS_PX ? "auto" : "hidden";
  }, [draft]);

  // Focus once when the panel opens, but only where a hardware keyboard is likely: pulling up the
  // on-screen keyboard the moment the sheet appears would hide most of the conversation.
  const focusedOnce = React.useRef(false);
  React.useEffect(() => {
    if (focusedOnce.current || coarsePointer) return;
    focusedOnce.current = true;
    textareaRef.current?.focus();
  }, [coarsePointer]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (speech.listening) speech.stop();
    onSend(text);
    setDraft("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    // On touch keyboards Enter stays a newline; the send button is right there.
    if (coarsePointer) return;
    event.preventDefault();
    submit();
  };

  const toggleDictation = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    dictationBase.current = draft.trim();
    speech.start(lang);
  };

  const remaining = MAX_MESSAGE_CHARS - draft.length;

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={cn(
          // `items-end` keeps the buttons pinned to the bottom edge as the field grows, so a
          // five-line draft pushes the capsule up rather than floating Send in the middle of it.
          "flex items-end gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-e1",
          "transition-[border-color,box-shadow] duration-micro ease-soft focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15 motion-reduce:transition-none",
          speech.listening && "border-orange ring-2 ring-orange/20"
        )}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={fieldId} className="sr-only">
            {t.placeholder}
          </label>
          <textarea
            id={fieldId}
            ref={textareaRef}
            rows={1}
            value={draft}
            maxLength={MAX_MESSAGE_CHARS}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={speech.listening ? t.listening : t.placeholder}
            aria-describedby={remaining <= COUNTER_FROM ? countId : undefined}
            className={cn(
              // Frameless: the capsule around it owns the border and the focus ring, so every
              // `focus:` treatment here is explicitly turned OFF rather than merely unstyled —
              // otherwise the browser's default outline would draw a second box inside the first.
              // `text-base` (16px) on phones is non-negotiable: Android zooms the viewport on any
              // smaller focused input, and globals.css force-corrects it under 40rem anyway.
              "block max-h-[120px] min-h-11 w-full resize-none border-0 bg-transparent px-3 py-2.5 text-base leading-6 text-ink placeholder:text-muted/80 focus:ring-0 focus:outline-none sm:text-[15px]"
            )}
          />
        </div>

        {speech.supported && (
          <button
            type="button"
            onClick={toggleDictation}
            aria-label={speech.listening ? t.micStop : t.micStart}
            aria-pressed={speech.listening}
            // ICON_BTN_ON_WHITE carries the 44px circle, `press-scale` and the transition; the
            // ternary adds the fill AND the matching focus ring, because the ring is the one thing
            // that has to change with the fill and `cn()` cannot merge the two ring utilities (see
            // the note on ICON_BTN_ON_WHITE). White ring on the orange live state, the standard
            // orange ring on the resting ghost circle — never both.
            className={cn(
              ICON_BTN_ON_WHITE,
              speech.listening ? "bg-orange btn-fill-orange text-white ring-focus-inverse" : "border border-line bg-white text-muted ring-focus hover:border-navy/30 hover:text-navy"
            )}
          >
            {/* Same rule as the launcher's pulse: `animate-ping` grows to `scale(2)`, which here is
                an 88px hit box over a 44px button — wide enough to sit on top of Send, right beside
                it. The halo is decoration and must not intercept that tap. */}
            {speech.listening && <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-orange/40 motion-reduce:animate-none" aria-hidden />}
            <Mic className="relative h-5 w-5" aria-hidden />
          </button>
        )}

        {busy ? (
          <button type="button" onClick={onStop} aria-label={t.stop} className={STOP_BTN}>
            <Square className="h-4 w-4 fill-current" aria-hidden />
          </button>
        ) : (
          <button type="submit" disabled={draft.trim().length === 0} aria-label={t.send} className={SEND_BTN}>
            <SendHorizontal className="h-5 w-5" aria-hidden />
          </button>
        )}
      </form>

      {/*
        Outside the capsule on purpose. Inside it, the counter is a block in the flex row's first
        column and its height shoves the field — and therefore the buttons — upward the moment it
        appears. `aria-describedby` still resolves: it points at this id, and a reference is by id,
        not by ancestry.
      */}
      {remaining <= COUNTER_FROM && (
        <p id={countId} className="mt-1 text-right text-[12px] leading-4 text-muted">
          {t.charactersLeft(remaining)}
        </p>
      )}
    </>
  );
}
