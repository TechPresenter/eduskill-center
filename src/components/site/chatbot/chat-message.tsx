"use client";

import * as React from "react";
import { Check, Copy, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/site/markdown";
import { AssistantAvatar, BUBBLE_ASSISTANT, BUBBLE_USER, STREAM_CARET } from "./chat-theme";
import type { ChatCopy } from "./copy";
import type { ChatMessage } from "./types";

/**
 * Spacing overrides for `Markdown` inside a chat bubble. They carry `!` because `prose-content`
 * styles its children through nested rules of the same specificity, which would otherwise make the
 * winner depend on utility ordering; the site's own page copy is untouched.
 */
const BUBBLE_MARKDOWN =
  "text-[15px]! leading-6! [&_p]:mb-2! [&_p:last-child]:mb-0! [&_ul]:mb-2! [&_ol]:mb-2! [&_ul]:pl-5! [&_ol]:pl-5! [&_li]:mb-0.5! [&_h2]:mt-3! [&_h2]:mb-1! [&_h2]:text-base! [&_h3]:mt-3! [&_h3]:mb-1! [&_h3]:text-[15px]! [&_table]:my-2! [&_blockquote]:my-2!";

/**
 * Copy / Speak under a finished reply. Kept as one string both buttons share so the pair can never
 * drift apart, and written with `text-[12px]` rather than a type token on purpose: `cn()` files an
 * unrecognised `text-*` as a COLOUR, so `text-caption` would be deleted the moment the speak button
 * merges `text-orange` over it. `ring-focus` is new — these were the only controls in the widget
 * with no visible keyboard indicator.
 */
const ACTION_BTN =
  "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-muted ring-focus transition-colors duration-micro ease-soft hover:bg-lavender/60 hover:text-navy motion-reduce:transition-none max-sm:min-h-11";

/** Three quietly pulsing dots: shown from send until the first delta arrives. */
export function TypingIndicator({ label }: { label: string }) {
  return (
    // 6px dots on a tight row, not 8px on a wide one: inside the bubble this has to read as the
    // assistant thinking, and anything larger reads as a loading skeleton for the bubble itself.
    <span className="inline-flex items-center gap-1.5 py-1.5" role="status">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-navy/45 motion-reduce:animate-none" style={{ animationDelay: `${i * 160}ms` }} aria-hidden />
      ))}
    </span>
  );
}

/**
 * The greeting and every assistant reply share one bubble shell. The white card only reads as raised
 * because `chat-panel` paints the scroll area with `CONVERSATION_SURFACE`; both colours live in
 * `chat-theme` precisely so this file can never drift to white-on-white.
 */
function AssistantShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(BUBBLE_ASSISTANT, className)}>{children}</div>;
}

/**
 * The 28px avatar column, or the empty gutter that keeps a continuation bubble aligned under it.
 * 28px + `gap-2` = a 36px indent that must stay identical in both cases, otherwise consecutive
 * replies step sideways as the run grows.
 */
function AvatarGutter({ show }: { show: boolean }) {
  return show ? <AssistantAvatar size="sm" /> : <span className="w-7 shrink-0" aria-hidden />;
}

export function GreetingBubble({ text }: { text: string }) {
  return (
    // The intro turn is always badged: it is the first thing in the transcript, so it is by
    // definition the start of a run.
    <div className="flex items-start gap-2">
      <AvatarGutter show />
      <AssistantShell>
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </AssistantShell>
    </div>
  );
}

export interface ChatBubbleProps {
  message: ChatMessage;
  t: ChatCopy;
  /** Show the speak control (the Foundation enabled voice and the browser supports it). */
  voiceAvailable: boolean;
  speaking: boolean;
  onSpeak: () => void;
  onStopSpeaking: () => void;
  typingLabel: string;
  /**
   * Badge this reply with the assistant avatar. `chat-panel` passes
   * `messages[i - 1]?.role !== "assistant"`, so only the FIRST reply of a consecutive run is
   * labelled and a multi-bubble answer reads as one voice instead of three unrelated cards.
   * Optional and defaulting to `true` so a caller that does not care still gets the badge.
   */
  showAvatar?: boolean;
}

export function ChatBubble({ message, t, voiceAvailable, speaking, onSpeak, onStopSpeaking, typingLabel, showAvatar = true }: ChatBubbleProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
    } catch {
      /* clipboard blocked (insecure context or denied permission): leave the button silent */
    }
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className={BUBBLE_USER}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  const empty = message.content.length === 0;

  return (
    // The bubble and its action row are ONE column inside the avatar row, so Copy/Speak inherit the
    // same 36px indent as the bubble instead of sitting under the avatar. `min-w-0` lets a long
    // unbroken URL wrap rather than pushing the row wider than the panel.
    <div className="flex items-start gap-2">
      <AvatarGutter show={showAvatar} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <AssistantShell>
          {empty ? (
            <TypingIndicator label={typingLabel} />
          ) : streaming ? (
            // While deltas arrive the raw text is shown (that progressive reveal IS the typing
            // animation); it is re-rendered as Markdown once the reply is complete. The caret is
            // inside this same <p> so it trails the last word, and it vanishes with the branch.
            <p className="whitespace-pre-wrap break-words">
              {message.content}
              <span aria-hidden className={STREAM_CARET} />
            </p>
          ) : (
            <Markdown source={message.content} className={BUBBLE_MARKDOWN} />
          )}
        </AssistantShell>

        {!streaming && !empty && (
          <div className="flex items-center gap-0.5 ps-1">
            <button type="button" onClick={() => void copy()} aria-label={copied ? t.copied : t.copy} className={ACTION_BTN}>
              {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              <span>{copied ? t.copied : t.copyShort}</span>
            </button>
            {voiceAvailable && (
              <button
                type="button"
                onClick={speaking ? onStopSpeaking : onSpeak}
                aria-label={speaking ? t.stopSpeaking : t.speak}
                aria-pressed={speaking}
                // While it is speaking the control keeps the orange through hover too: the colour is
                // state here, not decoration, and `cn()` would otherwise leave `hover:text-navy` to
                // flip a playing button back to a resting one under the pointer.
                className={cn(ACTION_BTN, speaking && "text-orange hover:text-orange")}
              >
                {speaking ? <Square className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
