"use client";

import * as React from "react";
import { Mic, SendHorizontal, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsCoarsePointer } from "@/lib/hooks";
import { useSpeechInput } from "./use-speech";
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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-end gap-2"
    >
      <div className="relative min-w-0 flex-1">
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
            "block max-h-[120px] min-h-11 w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-base leading-6 text-ink transition-colors placeholder:text-muted/80 focus:border-navy focus:ring-2 focus:ring-navy/15 focus:outline-none sm:text-[15px]",
            speech.listening && "border-orange ring-2 ring-orange/20"
          )}
        />
        {remaining <= COUNTER_FROM && (
          <p id={countId} className="mt-1 text-right text-[12px] text-muted">
            {t.charactersLeft(remaining)}
          </p>
        )}
      </div>

      {speech.supported && (
        <button
          type="button"
          onClick={toggleDictation}
          aria-label={speech.listening ? t.micStop : t.micStart}
          aria-pressed={speech.listening}
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors tap-highlight-none active:scale-95 motion-reduce:transition-none",
            speech.listening ? "border-orange bg-orange text-white" : "border-line bg-white text-muted hover:border-navy/30 hover:text-navy"
          )}
        >
          {speech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-orange/40 motion-reduce:animate-none" aria-hidden />}
          <Mic className="relative h-5 w-5" aria-hidden />
        </button>
      )}

      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label={t.stop}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-white transition-colors tap-highlight-none hover:bg-navy-dark active:scale-95 motion-reduce:transition-none"
        >
          <Square className="h-4 w-4 fill-current" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          aria-label={t.send}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange text-white transition-[background-color,transform,opacity] tap-highlight-none hover:bg-orange-hover active:scale-95 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
        >
          <SendHorizontal className="h-5 w-5" aria-hidden />
        </button>
      )}
    </form>
  );
}
