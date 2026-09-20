"use client";

import * as React from "react";
import { withBasePath } from "@/lib/base-path";
import {
  CHAT_ENDPOINT,
  HISTORY_STORAGE_KEY,
  MAX_MESSAGE_CHARS,
  MAX_TURNS,
  detectLang,
  type ChatApiMessage,
  type ChatErrorKind,
  type ChatLang,
  type ChatMessage,
} from "./types";

/** Conversation status: `sending` = waiting for the first delta, `streaming` = deltas are arriving. */
export type ChatStatus = "idle" | "sending" | "streaming";

export interface ChatController {
  messages: ChatMessage[];
  lang: ChatLang;
  setLang: (lang: ChatLang) => void;
  status: ChatStatus;
  busy: boolean;
  error: ChatErrorKind | null;
  /** True while the failed turn can be retried (a validation failure cannot). */
  canRetry: boolean;
  send: (text: string) => void;
  retry: () => void;
  stop: () => void;
  clear: () => void;
}

interface StoredHistory {
  lang: ChatLang;
  messages: ChatApiMessage[];
}

let counter = 0;
const newId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

/* ───────────── session storage (never localStorage: the transcript dies with the tab) ───────────── */

function readHistory(): StoredHistory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { lang, messages } = parsed as Partial<StoredHistory>;
    if (!Array.isArray(messages)) return null;
    const clean = messages
      .filter((m): m is ChatApiMessage => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length > 0)
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
    return { lang: lang === "hi" ? "hi" : "en", messages: clean };
  } catch {
    return null;
  }
}

function writeHistory(lang: ChatLang, messages: ChatMessage[]) {
  try {
    if (messages.length === 0) {
      window.sessionStorage.removeItem(HISTORY_STORAGE_KEY);
      return;
    }
    const payload: StoredHistory = { lang, messages: messages.slice(-MAX_TURNS).map(({ role, content }) => ({ role, content })) };
    window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / blocked storage: the conversation simply does not survive a navigation */
  }
}

/* ───────────── SSE helpers ───────────── */

interface StreamEvent {
  delta?: unknown;
  done?: unknown;
  lang?: unknown;
  error?: unknown;
}

function statusToKind(status: number): ChatErrorKind {
  if (status === 429) return "rateLimit";
  if (status === 503) return "unavailable";
  if (status === 422 || status === 400) return "invalid";
  if (status >= 500) return "server";
  return "server";
}

/**
 * Conversation state for the public assistant.
 *
 * Lives in the always-mounted widget (not the lazily loaded panel) so a reply keeps streaming while
 * the panel is closed and the transcript survives closing it. History is mirrored to sessionStorage,
 * so an in-site navigation (which re-renders the layout's children but keeps this component mounted)
 * and a full page load both restore the same conversation.
 */
export function useChat(): ChatController {
  // Restored during the first render, not from an effect: the widget renders nothing until its
  // config arrives, so there is no markup for a mismatch, and no cascading re-render on mount.
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => (readHistory()?.messages ?? []).map((m) => ({ ...m, id: newId(), status: "done" as const })));
  const [lang, setLang] = React.useState<ChatLang>(() => readHistory()?.lang ?? "en");
  const [status, setStatus] = React.useState<ChatStatus>("idle");
  const [error, setError] = React.useState<ChatErrorKind | null>(null);
  const [canRetry, setCanRetry] = React.useState(false);

  const messagesRef = React.useRef<ChatMessage[]>([]);
  const langRef = React.useRef<ChatLang>("en");
  const abortRef = React.useRef<AbortController | null>(null);

  messagesRef.current = messages;
  langRef.current = lang;

  // Mirror to sessionStorage only when nothing is in flight, so a fast stream does not write on every frame.
  React.useEffect(() => {
    if (status !== "idle") return;
    writeHistory(lang, messages);
  }, [messages, lang, status]);

  // Never leave a request running after the widget unmounts.
  React.useEffect(() => () => abortRef.current?.abort(), []);

  const run = React.useCallback(async (history: ChatMessage[], replyLang: ChatLang) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const assistantId = newId();
    setError(null);
    setCanRetry(false);
    setStatus("sending");
    setMessages([...history, { id: assistantId, role: "assistant", content: "", status: "streaming" }]);

    // Deltas can arrive faster than React should re-render; coalesce them before painting.
    let buffer = "";
    let frame = 0;
    let timer = 0;
    const unschedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
      frame = 0;
      timer = 0;
    };
    const flush = () => {
      unschedule();
      if (!buffer) return;
      const chunk = buffer;
      buffer = "";
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)));
    };
    const push = (delta: string) => {
      buffer += delta;
      // An animation frame keeps the repaint aligned with the compositor, but rAF does not fire at
      // all while a tab is backgrounded or occluded (and is throttled in some embedded webviews).
      // Without the timer the whole reply would then land in one jump at the end instead of
      // streaming, so whichever fires first flushes and cancels the other.
      if (!frame) frame = window.requestAnimationFrame(flush);
      if (!timer) timer = window.setTimeout(flush, 100);
    };
    const settle = (patch: Partial<ChatMessage>) => {
      unschedule();
      flush();
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: "done", ...patch } : m)));
    };

    // A holder (not plain `let`) because both the stream parser and the catch block write to it:
    // property writes survive the control-flow narrowing that would otherwise fight the closures.
    const out: { failure: ChatErrorKind | null; lang: ChatLang | undefined } = { failure: null, lang: undefined };

    try {
      const res = await fetch(withBasePath(CHAT_ENDPOINT), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          messages: history.slice(-MAX_TURNS).map(({ role, content }) => ({ role, content: content.slice(0, MAX_MESSAGE_CHARS) })),
          lang: replyLang,
        }),
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // Rejections arrive before the stream starts, as the normal `{ success:false, error }` envelope.
        try {
          await res.json();
        } catch {
          /* the body is not required to make sense of the status */
        }
        out.failure = res.ok ? "server" : statusToKind(res.status);
      } else {
        setStatus("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        let finished = false;

        const handleLine = (rawLine: string) => {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) return;
          const payload = line.slice(5).trim();
          if (!payload) return;
          if (payload === "[DONE]") {
            finished = true;
            return;
          }
          let event: StreamEvent;
          try {
            event = JSON.parse(payload) as StreamEvent;
          } catch {
            return;
          }
          if (typeof event.delta === "string" && event.delta) push(event.delta);
          if (typeof event.error === "string" && event.error) out.failure = "server";
          if (event.done === true) {
            finished = true;
            if (event.lang === "hi" || event.lang === "en") out.lang = event.lang;
          }
        };

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          let nl = text.indexOf("\n");
          while (nl >= 0) {
            handleLine(text.slice(0, nl));
            text = text.slice(nl + 1);
            nl = text.indexOf("\n");
          }
        }
        if (text) handleLine(text);
        if (!finished && !out.failure) out.failure = "network";
      }
    } catch (err) {
      // An abort is the visitor pressing Stop — keep whatever arrived and say nothing.
      if (!(err instanceof DOMException && err.name === "AbortError")) out.failure = "network";
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }

    settle(out.lang ? { lang: out.lang } : {});
    setStatus("idle");

    if (out.failure) {
      setError(out.failure);
      setCanRetry(out.failure !== "invalid" && out.failure !== "unavailable");
      // Drop an assistant turn that never produced a word, so a retry starts from the visitor's question.
      setMessages((prev) => prev.filter((m) => !(m.id === assistantId && m.content.length === 0)));
    }
  }, []);

  const send = React.useCallback(
    (text: string) => {
      const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!content || abortRef.current) return;
      const nextLang = detectLang(content, langRef.current);
      setLang(nextLang);
      const turn: ChatMessage = { id: newId(), role: "user", content, status: "done" };
      const history: ChatMessage[] = [...messagesRef.current.filter((m) => m.content.length > 0), turn].slice(-MAX_TURNS);
      void run(history, nextLang);
    },
    [run]
  );

  const retry = React.useCallback(() => {
    if (abortRef.current) return;
    // Re-send the transcript up to and including the last visitor turn.
    const history = [...messagesRef.current];
    while (history.length > 0 && history[history.length - 1]!.role === "assistant") history.pop();
    if (history.length === 0) return;
    void run(history, langRef.current);
  }, [run]);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clear = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setCanRetry(false);
    setStatus("idle");
    try {
      window.sessionStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { messages, lang, setLang, status, busy: status !== "idle", error, canRetry, send, retry, stop, clear };
}
