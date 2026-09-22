"use client";

import * as React from "react";
import { AlertCircle, ArrowDown, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useMediaQuery, useScrollLock, useVisualViewport } from "@/lib/hooks";
import { UI_COPY } from "./copy";
import { ChatBubble, GreetingBubble } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { useSpeechOutput } from "./use-speech";
import type { ChatController } from "./use-chat";
import { detectLang, type ChatConfig, type ChatLang } from "./types";

/** Phones get the sheet; from Tailwind's `sm` up it is a floating card (same breakpoint as BottomSheet). */
const SHEET_QUERY = "(min-width: 640px)";

export interface ChatPanelProps {
  panelId: string;
  /** The Foundation's short name, from DB branding — never a hard-coded product name. */
  name: string;
  config: ChatConfig;
  chat: ChatController;
  /** True while the exit animation plays; the widget unmounts the panel right after. */
  closing: boolean;
  onClose: () => void;
  voiceOn: boolean;
  onVoiceChange: (on: boolean) => void;
}

/**
 * The conversation surface: a near-full-height sheet on phones, a 380×560 card pinned above the
 * launcher on desktop. It is a dialog in both cases (focus trapped, Escape closes, focus returns to
 * the launcher) but only phones lock body scroll, because the desktop card deliberately leaves the
 * page usable behind it.
 */
export function ChatPanel({ panelId, name, config, chat, closing, onClose, voiceOn, onVoiceChange }: ChatPanelProps) {
  const { messages, lang, setLang, status, busy, error, canRetry, send, retry, stop, clear } = chat;
  const t = UI_COPY[lang];

  const panelRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const titleId = `${panelId}-title`;
  const isPhone = !useMediaQuery(SHEET_QUERY, true);
  const { keyboardOpen, height: viewportHeight } = useVisualViewport();
  const [atBottom, setAtBottom] = React.useState(true);

  const { speak, stop: stopSpeaking, speakingId, supported: speechSupported } = useSpeechOutput();
  const voiceAvailable = config.voice && speechSupported;

  useScrollLock(isPhone && !closing);
  useFocusTrap(panelRef, !closing, { onEscape: onClose, initialFocus: "container" });

  /* Auto-scroll: follow the stream unless the visitor has scrolled up to read something earlier. */
  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 64);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status, error, atBottom]);

  const scrollToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

  /* Spoken replies: only a genuinely new, finished reply is read aloud, and only with the toggle on. */
  const lastReply = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role === "assistant" && m.status === "done" && m.content) return m;
    }
    return null;
  }, [messages]);

  /**
   * Which voice reads a given reply. The server reports the language of each reply in its `done`
   * event, but a transcript restored from sessionStorage only carries role and content — and the
   * conversation language may since have changed — so fall back to the script of the reply itself
   * rather than to the current language, or an English answer would be read with a Hindi voice.
   */
  const voiceLangFor = React.useCallback((message: { content: string; lang?: ChatLang }) => message.lang ?? detectLang(message.content, lang), [lang]);

  const spokenRef = React.useRef<string | null>(null);
  const primed = React.useRef(false);

  React.useEffect(() => {
    const id = lastReply?.id ?? null;
    const previous = spokenRef.current;
    spokenRef.current = id;
    if (!primed.current) {
      // Everything already on screen when the panel opened (a restored session) stays silent.
      primed.current = true;
      return;
    }
    if (!voiceOn || !voiceAvailable || !lastReply || previous === id) return;
    speak(lastReply.id, lastReply.content, voiceLangFor(lastReply));
  }, [lastReply, voiceOn, voiceAvailable, speak, voiceLangFor]);

  const toggleVoice = () => {
    const next = !voiceOn;
    if (!next) stopSpeaking();
    onVoiceChange(next);
  };

  const greeting = config.greeting[lang] || t.greetingFallback;
  // The panel is 380px wide even on desktop, so each chip takes a row: show the first few and leave
  // the conversation the space. They disappear as soon as the visitor has asked something.
  const suggestions = messages.length === 0 ? config.suggestions.slice(0, 4) : [];

  // With the on-screen keyboard open, a `bottom: 0` fixed sheet would sit behind it: pin the sheet to
  // the visual viewport instead so the composer stays in view.
  const keyboardStyle: React.CSSProperties | undefined =
    isPhone && keyboardOpen && viewportHeight > 0 ? { top: 0, bottom: "auto", height: `${viewportHeight}px` } : undefined;

  return (
    <>
      {/* Phones only: the sheet is modal, desktop deliberately leaves the page visible and clickable. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-overlay bg-navy/40 sm:hidden",
          closing ? "opacity-0 transition-opacity duration-200 motion-reduce:transition-none" : "animate-fade-in motion-reduce:animate-none"
        )}
      />

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={keyboardStyle}
        className={cn(
          "fixed z-overlay flex flex-col overflow-hidden bg-white shadow-e3 outline-none",
          // phone: near-full-height sheet that clears the notch
          "inset-x-0 bottom-0 top-[max(1.5rem,env(safe-area-inset-top))] rounded-t-2xl",
          // desktop: compact card sitting just above the launcher (1rem offset + 3.5rem button + 0.75rem gap)
          "sm:inset-x-auto sm:top-auto sm:left-auto sm:right-[max(1rem,env(safe-area-inset-right))] sm:bottom-[calc(var(--bottom-nav-h)+var(--sticky-bar-h)+env(safe-area-inset-bottom,0px)+5.25rem)] sm:h-[600px] sm:max-h-[calc(100dvh-7rem)] sm:w-[380px] sm:rounded-card sm:border sm:border-line",
          closing
            ? "pointer-events-none animate-slide-down sm:animate-none sm:translate-y-2 sm:opacity-0 sm:transition sm:duration-200 sm:ease-in sm:motion-reduce:transition-none"
            : "animate-slide-up sm:animate-fade-up motion-reduce:animate-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 bg-navy px-3 py-2.5 text-white">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10" aria-hidden>
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate font-heading text-[15px] font-bold text-white">
              {t.title(name)}
            </h2>
            <p className="truncate text-[12px] leading-4 text-white/70">{t.subtitle}</p>
          </div>

          <div role="group" aria-label={t.languageLabel} className="flex shrink-0 items-center rounded-full bg-white/10 p-0.5">
            {(["en", "hi"] as ChatLang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={cn(
                  "min-h-9 rounded-full px-2.5 text-[12px] font-bold transition-colors tap-highlight-none motion-reduce:transition-none max-sm:min-h-11 max-sm:min-w-11",
                  lang === code ? "bg-white text-navy" : "text-white/75 hover:text-white"
                )}
              >
                {code === "en" ? "EN" : "हिं"}
              </button>
            ))}
          </div>

          {voiceAvailable && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={voiceOn ? t.voiceOn : t.voiceOff}
              aria-pressed={voiceOn}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white tap-highlight-none motion-reduce:transition-none max-sm:h-11 max-sm:w-11"
            >
              {voiceOn ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white tap-highlight-none motion-reduce:transition-none max-sm:h-11 max-sm:w-11"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Conversation */}
        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto overscroll-contain scrollbar-thin px-4 py-4">
            <div role="log" aria-live="polite" aria-atomic="false" aria-label={t.logLabel} className="flex flex-col gap-3">
              <GreetingBubble text={greeting} />
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  t={t}
                  typingLabel={t.typing}
                  voiceAvailable={voiceAvailable}
                  speaking={speakingId === message.id}
                  onSpeak={() => speak(message.id, message.content, voiceLangFor(message))}
                  onStopSpeaking={stopSpeaking}
                />
              ))}
            </div>
          </div>

          {!atBottom && (
            <button
              type="button"
              onClick={scrollToLatest}
              aria-label={t.jumpToLatest}
              className="absolute bottom-3 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-white text-navy shadow-card transition-colors hover:bg-lavender motion-reduce:transition-none"
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {suggestions.length > 0 && (
            // `relative` + `overflow-x-auto`: a single very long suggestion scrolls inside the panel
            // instead of stretching it, and absolutely positioned descendants stay anchored here.
            <div role="group" aria-label={t.suggestionsLabel} className="relative mb-3 flex flex-wrap gap-2 overflow-x-auto pb-1 no-scrollbar">
              {suggestions.map((suggestion) => {
                const label = suggestion[lang] || suggestion.en || suggestion.hi;
                if (!label) return null;
                return (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => send(label)}
                    disabled={busy}
                    className="min-h-11 shrink-0 rounded-full border border-navy-soft bg-lavender/50 px-3.5 py-2 text-left text-[13px] font-medium text-navy transition-colors tap-highlight-none hover:border-navy/30 hover:bg-lavender disabled:opacity-50 motion-reduce:transition-none sm:min-h-10"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div role="alert" className="mb-2 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-light px-3 py-2 text-[13px] leading-5 text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">{t.errors[error]}</span>
              {canRetry && (
                <button
                  type="button"
                  onClick={retry}
                  className="min-h-9 shrink-0 rounded-lg px-2 font-semibold text-navy underline-offset-2 transition-colors hover:underline motion-reduce:transition-none max-sm:min-h-11"
                >
                  {t.retry}
                </button>
              )}
            </div>
          )}

          <ChatComposer t={t} lang={lang} busy={busy} onSend={send} onStop={stop} />

          <div className="mt-2 flex items-start justify-between gap-2">
            <p className="text-[12px] leading-4 text-muted">{t.disclaimer}</p>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="min-h-9 shrink-0 rounded-lg px-2 text-[12px] font-semibold text-muted transition-colors hover:bg-surface hover:text-navy tap-highlight-none motion-reduce:transition-none max-sm:min-h-11"
              >
                {t.clear}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
