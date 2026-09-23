"use client";

import { ArrowUpRight, BookOpen, GraduationCap, MapPin } from "lucide-react";
import { AssistantAvatar, CAPABILITY, CHIP } from "./chat-theme";
import type { ChatLang, ChatSuggestion } from "./types";
import type { ChatCopy } from "./copy";

/**
 * The first thing a visitor sees after opening the assistant.
 *
 * WHAT IT REPLACES: one lavender greeting bubble, plus up to four wrapped pills squeezed into the
 * composer block above the input. On a 360px phone those pills degraded into a ragged one-per-line
 * list that pushed the text field towards the keyboard, and nothing on screen said what the
 * assistant actually knows about. Here the greeting becomes a proper hero — identity mark, heading,
 * greeting, a row of capability tags, then the server's quick questions as full-width rows.
 *
 * PURE PRESENTATION. Every value is a prop: no fetch, no storage read, no `useChat`, no speech hook,
 * not a single piece of local state. The caller resolves `config.greeting[lang] || t.greetingFallback`
 * and already caps `config.suggestions.slice(0, 4)`, so this file must not re-slice, re-cap or add a
 * "more suggestions" affordance — a longer list would need state that lives in the (frozen)
 * chat-widget.
 *
 * WHERE IT RENDERS: inside the panel's `role="log" aria-live="polite"` scroll region, on the
 * {@link CONVERSATION_SURFACE} tint. That placement is deliberate — this IS the greeting, so it is
 * the first thing a screen reader should reach, and the white chips read as raised cards only
 * against that tint.
 *
 * No `position: fixed`, no `filter`, no `backdrop-filter`, no transform on any element here: the
 * panel root is `position: fixed` and any of those on an ancestor would re-parent it.
 */
export interface ChatEmptyStateProps {
  /** Already language-resolved by the caller (`config.greeting[lang] || t.greetingFallback`). */
  greeting: string;
  /** Server-provided quick questions, already capped at 4 by the caller. */
  suggestions: ChatSuggestion[];
  lang: ChatLang;
  /** A reply is in flight: the rows stay visible but stop accepting taps. */
  busy: boolean;
  onSelect: (text: string) => void;
  t: ChatCopy;
}

/** lucide marks for the three capability tags, in the order {@link ChatCopy.capabilities} declares them. */
const CAPABILITY_ICONS = [BookOpen, MapPin, GraduationCap] as const;

export function ChatEmptyState({ greeting, suggestions, lang, busy, onSelect, t }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col gap-4 pt-2 pb-1">
      {/* Hero. `h3` is the correct level: the dialog's own `h2` is the panel header's title. */}
      <div className="flex flex-col items-start gap-3">
        <AssistantAvatar size="lg" />
        <h3 className="font-heading text-[20px] leading-7 font-bold text-navy">{t.emptyTitle}</h3>
      </div>

      {/* `whitespace-pre-wrap`: the greeting is admin-authored in Settings and may carry line breaks. */}
      <p className="text-[15px] leading-6 whitespace-pre-wrap text-ink">{greeting}</p>

      {/*
        Capability tags. Labels, not prompts — no handler, no `tabIndex`, no hover state — so nothing
        here invites a tap that would do nothing. The tappable questions are the rows below.
      */}
      <ul className="flex flex-wrap gap-1.5">
        {t.capabilities.map((capability, index) => {
          const Icon = CAPABILITY_ICONS[index] ?? BookOpen;
          return (
            <li key={capability} className={CAPABILITY}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {capability}
            </li>
          );
        })}
      </ul>

      {/*
        Quick questions. The whole group disappears when the server sent none, rather than leaving an
        empty labelled group in the accessibility tree. This `role="group"` is the ONLY one for the
        suggestions in the panel — the composer's old copy was removed with the same change.
      */}
      {suggestions.length > 0 && (
        <div role="group" aria-label={t.suggestionsLabel} className="flex flex-col gap-2">
          {suggestions.map((suggestion) => {
            // Same fallback chain as before the reskin: the visitor's language, then English, then
            // Hindi. A suggestion with no text at all in any language is skipped, not rendered blank.
            const label = suggestion[lang] || suggestion.en || suggestion.hi;
            if (!label) return null;
            return (
              <button key={suggestion.id} type="button" onClick={() => onSelect(label)} disabled={busy} className={CHIP}>
                <span className="min-w-0 flex-1">{label}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-orange" aria-hidden />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
