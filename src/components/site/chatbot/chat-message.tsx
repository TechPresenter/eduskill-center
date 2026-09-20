"use client";

import * as React from "react";
import { Check, Copy, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/site/markdown";
import type { ChatCopy } from "./copy";
import type { ChatMessage } from "./types";

/**
 * Spacing overrides for `Markdown` inside a chat bubble. They carry `!` because `prose-content`
 * styles its children through nested rules of the same specificity, which would otherwise make the
 * winner depend on utility ordering; the site's own page copy is untouched.
 */
const BUBBLE_MARKDOWN =
  "text-[15px]! leading-6! [&_p]:mb-2! [&_p:last-child]:mb-0! [&_ul]:mb-2! [&_ol]:mb-2! [&_ul]:pl-5! [&_ol]:pl-5! [&_li]:mb-0.5! [&_h2]:mt-3! [&_h2]:mb-1! [&_h2]:text-base! [&_h3]:mt-3! [&_h3]:mb-1! [&_h3]:text-[15px]! [&_table]:my-2! [&_blockquote]:my-2!";

/** Three quietly pulsing dots: shown from send until the first delta arrives. */
export function TypingIndicator({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 py-1" role="status">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-navy/35 motion-reduce:animate-none" style={{ animationDelay: `${i * 160}ms` }} aria-hidden />
      ))}
    </span>
  );
}

/** The greeting and every assistant reply share one bubble shell. */
function AssistantShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-lavender/60 px-3.5 py-2.5 text-[15px] leading-6 text-ink", className)}>{children}</div>;
}

export function GreetingBubble({ text }: { text: string }) {
  return (
    <div className="flex">
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
}

export function ChatBubble({ message, t, voiceAvailable, speaking, onSpeak, onStopSpeaking, typingLabel }: ChatBubbleProps) {
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
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-navy px-3.5 py-2.5 text-[15px] leading-6 text-white">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  const empty = message.content.length === 0;

  return (
    <div className="flex flex-col items-start gap-1">
      <AssistantShell>
        {empty ? (
          <TypingIndicator label={typingLabel} />
        ) : streaming ? (
          // While deltas arrive the raw text is shown (that progressive reveal IS the typing
          // animation); it is re-rendered as Markdown once the reply is complete.
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <Markdown source={message.content} className={BUBBLE_MARKDOWN} />
        )}
      </AssistantShell>

      {!streaming && !empty && (
        <div className="flex items-center gap-0.5 ps-1">
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={copied ? t.copied : t.copy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-muted transition-colors hover:bg-surface hover:text-navy max-sm:min-h-11"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            <span>{copied ? t.copied : t.copyShort}</span>
          </button>
          {voiceAvailable && (
            <button
              type="button"
              onClick={speaking ? onStopSpeaking : onSpeak}
              aria-label={speaking ? t.stopSpeaking : t.speak}
              aria-pressed={speaking}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold transition-colors hover:bg-surface max-sm:min-h-11",
                speaking ? "text-orange" : "text-muted hover:text-navy"
              )}
            >
              {speaking ? <Square className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
