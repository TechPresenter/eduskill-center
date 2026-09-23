"use client";

import * as React from "react";
import { AlertCircle, ArrowDown, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useMediaQuery, useScrollLock, useVisualViewport } from "@/lib/hooks";
import { UI_COPY } from "./copy";
import { ChatBubble, GreetingBubble } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { ChatEmptyState } from "./chat-empty-state";
import { AssistantAvatar, CONVERSATION_SURFACE, HEADER_ACCENT, HEADER_GLOW, HEADER_SHELL, ICON_BTN_ON_NAVY } from "./chat-theme";
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
 * The conversation surface: a near-full-height sheet on phones, a 400px (420px from `lg`) × 620px
 * card pinned above the launcher on desktop. It is a dialog in both cases (focus trapped, Escape
 * closes, focus returns to the launcher) but only phones lock body scroll, because the desktop card
 * deliberately leaves the page usable behind it.
 *
 * LAYOUT CONTRACT: this element is `position: fixed`, and so is the phone backdrop beside it. No
 * ancestor may acquire a transform, filter, backdrop-filter, clip-path or will-change — which is why
 * `chat-widget.tsx` returns a bare fragment — and no DESCENDANT of the panel may become `fixed`
 * either. The jump-to-latest button is `absolute` inside the `relative` conversation wrapper for
 * exactly that reason. The one `filter` in the whole widget is {@link HEADER_ACCENT}, a childless
 * `aria-hidden` leaf, so it has nothing to re-parent.
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
  // Even at its widest the panel is a single narrow column, so each quick question takes a whole
  // row: show the first few and leave the conversation the space. They disappear — along with the
  // whole empty state that hosts them — as soon as the visitor has asked something.
  const suggestions = messages.length === 0 ? config.suggestions.slice(0, 4) : [];

  // Rate limiting is the one error the visitor caused and can simply wait out; everything else is a
  // fault on our side. Same markup, same `role="alert"`, amber instead of red.
  //
  // Both tones use the repo's own tinted-banner pairing from `ui/feedback.tsx` (`bg-warning-light` +
  // `text-amber-900`, `bg-danger-light` + `text-red-900`) rather than the flat `text-warning` /
  // `text-danger` dots. That matters here: `text-danger` (#d92d20) is 4.83:1 on WHITE but only
  // 4.11:1 on `bg-danger-light` (#fde8e6), which fails AA for this 13px sentence. There is no
  // `--color-danger-dark` token to reach for the way `warning`/`success`/`info` have one, and the
  // product already answers this exact question with `text-red-900` (8.5:1 here). The amber half
  // moves with it so the two branches stay one idiom; `text-amber-900` is 8.3:1 on the warning tint.
  const warn = error === "rateLimit";

  // With the on-screen keyboard open, a `bottom: 0` fixed sheet would sit behind it: pin the sheet to
  // the visual viewport instead so the composer stays in view.
  const keyboardStyle: React.CSSProperties | undefined =
    isPhone && keyboardOpen && viewportHeight > 0 ? { top: 0, bottom: "auto", height: `${viewportHeight}px` } : undefined;

  return (
    <>
      {/* Phones only: the sheet is modal, desktop deliberately leaves the page visible and clickable.
          Deliberately NOT `backdrop-blur`: this would be legal (a childless sibling of the panel), but
          a full-viewport backdrop-filter is the most expensive paint there is and this audience is on
          low-end Android. The extra 10% of navy buys the same separation for free. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-overlay bg-navy/50 sm:hidden",
          closing ? "opacity-0 transition-opacity duration-micro motion-reduce:transition-none" : "animate-fade-in motion-reduce:animate-none"
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
          // phone: near-full-height sheet that clears the notch. `max(1.5rem, safe-area)` rather than
          // `pt-safe`, because a phone without a notch reports 0 and the sheet would touch the edge.
          "inset-x-0 bottom-0 top-[max(1.5rem,env(safe-area-inset-top))] rounded-t-2xl",
          // desktop: compact card sitting just above the launcher (1rem offset + 3.5rem button + 0.75rem gap).
          // The 5.25rem is arithmetic against the launcher's 56px height — do not touch one without the other.
          "sm:inset-x-auto sm:top-auto sm:left-auto sm:right-[max(1rem,env(safe-area-inset-right))] sm:bottom-[calc(var(--bottom-nav-h)+var(--sticky-bar-h)+env(safe-area-inset-bottom,0px)+5.25rem)] sm:h-[620px] sm:max-h-[calc(100dvh-7rem)] sm:w-[400px] sm:rounded-card-lg sm:border sm:border-line lg:w-[420px]",
          closing
            ? "pointer-events-none animate-slide-down motion-reduce:animate-none sm:animate-none sm:translate-y-2 sm:opacity-0 sm:transition sm:duration-micro sm:ease-in sm:motion-reduce:transition-none"
            : "animate-slide-up sm:animate-fade-up motion-reduce:animate-none"
        )}
      >
        {/* The sheet grabber is a visual affordance ONLY — it says "this is a sheet", it is not a drag
            handle. A swipe-to-dismiss gesture layered over a scrolling log is a real behavioural
            change, and the sheet already closes via X, Escape and the backdrop. */}
        <span aria-hidden className="absolute inset-x-0 top-0 z-raised mx-auto mt-1.5 h-1.5 w-10 rounded-full bg-white/40 sm:hidden" />

        {/* Header. Two decorative aria-hidden leaves under one `overflow-hidden` shell: the depth
            comes from a layer, never from a filter on the header itself. */}
        <div className={HEADER_SHELL}>
          <span aria-hidden className={HEADER_GLOW} />
          <span aria-hidden className={HEADER_ACCENT} />

          <div className="relative flex items-center gap-2.5 px-3 py-2.5">
            {/* Hidden on phones: at 390px this 36px mark plus its gap was squeezing the title down
                to "EduSkill Assis…" and the status to "Online — usually". It is decorative
                (aria-hidden) and the empty state renders a large one directly below, so nothing is
                lost by giving the row back to the text. */}
            <AssistantAvatar size="md" ringTone="navy" className="max-sm:hidden" />

            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate font-heading text-[15px] font-bold text-white">
                {t.title(name)}
              </h2>
              {/* A status line, not a tagline: the visitor can see at a glance whether a reply is on
                  its way. Deliberately NOT a live region — the typing indicator already carries
                  `role="status"`, and two announcements for one event is noise. */}
              <p className="flex items-center gap-1.5 truncate text-[12px] leading-4 text-white/80">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                {busy ? t.typing : t.statusIdle}
              </p>
            </div>

            <div role="group" aria-label={t.languageLabel} className="flex shrink-0 items-center rounded-full bg-white/10 p-0.5">
              {(["en", "hi"] as ChatLang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={cn(
                    // `ring-focus-inverse`, not the global `ring-focus`: the standard ring is orange on
                    // a white offset and is effectively invisible against this navy bar.
                    "min-h-9 rounded-full px-2.5 text-[12px] font-bold ring-focus-inverse transition-colors duration-micro tap-highlight-none motion-reduce:transition-none max-sm:min-h-11 max-sm:min-w-11",
                    lang === code ? "bg-white text-navy shadow-e1" : "text-white/80 hover:text-white"
                  )}
                >
                  {code === "en" ? "EN" : "हिं"}
                </button>
              ))}
            </div>

            {voiceAvailable && (
              <button type="button" onClick={toggleVoice} aria-label={voiceOn ? t.voiceOn : t.voiceOff} aria-pressed={voiceOn} className={ICON_BTN_ON_NAVY}>
                {voiceOn ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
              </button>
            )}

            <button type="button" onClick={onClose} aria-label={t.close} className={ICON_BTN_ON_NAVY}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Conversation. The tint is load-bearing: assistant replies are WHITE cards and would vanish
            on a white background. `relative` anchors both the scroll layer and the jump button. */}
        <div className={cn("relative min-h-0 flex-1", CONVERSATION_SURFACE)}>
          <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto overscroll-contain scrollbar-thin px-4 py-4">
            <div role="log" aria-live="polite" aria-atomic="false" aria-label={t.logLabel} className="flex flex-col gap-3">
              {messages.length === 0 ? (
                // First visit: the greeting becomes a real empty state (identity mark, heading,
                // capabilities, quick questions). It owns `role="group" aria-label={t.suggestionsLabel}`
                // now — the panel must not render a second copy.
                <ChatEmptyState greeting={greeting} suggestions={suggestions} lang={lang} busy={busy} onSelect={send} t={t} />
              ) : (
                <>
                  {/* Once the conversation starts the greeting collapses back to an ordinary bubble, so
                      it stays part of the transcript instead of disappearing from the log. */}
                  <GreetingBubble text={greeting} />
                  {messages.map((message, i) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      t={t}
                      typingLabel={t.typing}
                      voiceAvailable={voiceAvailable}
                      speaking={speakingId === message.id}
                      // Only the first reply of a consecutive run wears the avatar, so a multi-bubble
                      // answer reads as one voice rather than three unrelated cards.
                      showAvatar={messages[i - 1]?.role !== "assistant"}
                      onSpeak={() => speak(message.id, message.content, voiceLangFor(message))}
                      onStopSpeaking={stopSpeaking}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          {!atBottom && (
            <button
              type="button"
              onClick={scrollToLatest}
              aria-label={t.jumpToLatest}
              // `absolute`, never `fixed` — a fixed descendant here would be re-parented the moment any
              // ancestor gained a transform. 44px below `sm`: it was the last sub-target control left.
              className="absolute bottom-3 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-white text-navy shadow-e2 ring-focus transition-colors duration-micro ease-soft hover:bg-lavender animate-fade-in motion-reduce:animate-none motion-reduce:transition-none max-sm:h-11 max-sm:w-11"
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Composer. `shrink-0` so a long reply can never squash the input out of the flex column. */}
        <div className="shrink-0 border-t border-line bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && (
            <div
              role="alert"
              className={cn(
                "mb-2 flex items-start gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] leading-5",
                warn ? "bg-warning-light text-amber-900 ring-1 ring-warning/30" : "bg-danger-light text-red-900 ring-1 ring-danger/30"
              )}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">{t.errors[error]}</span>
              {canRetry && (
                <button
                  type="button"
                  onClick={retry}
                  className="min-h-9 shrink-0 rounded-lg px-2 font-semibold text-navy underline-offset-2 ring-focus transition-colors duration-micro hover:underline motion-reduce:transition-none max-sm:min-h-11"
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
              // The visible label is short so it cannot crowd the disclaimer on a 360px phone; the
              // full sentence stays as the accessible name.
              <button
                type="button"
                onClick={clear}
                aria-label={t.clear}
                className="inline-flex min-h-9 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold text-muted ring-focus transition-colors duration-micro hover:bg-lavender/60 hover:text-navy tap-highlight-none motion-reduce:transition-none max-sm:min-h-11"
              >
                {t.clearShort}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
