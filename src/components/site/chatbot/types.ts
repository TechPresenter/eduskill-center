/**
 * Shared types + constants for the public-site assistant widget.
 *
 * The wire contract (POST/GET `/api/public/chat`) is owned jointly with the route handler:
 *   POST body     → { messages: [{ role, content }], lang? }   (≤ 20 messages, ≤ 2000 chars each)
 *   POST response → SSE lines `data: {"delta":"…"}` / `data: {"done":true,"lang":"hi"|"en"}` /
 *                   `data: {"error":"…"}`, terminated by `data: [DONE]`.
 *   GET response  → the normal envelope wrapping {@link ChatConfig}.
 * Everything the visitor sees (greeting, quick questions, whether voice is offered) comes from the
 * GET call so nothing about the assistant is hard-coded in the bundle.
 */

/** The two languages the assistant answers in. The UI follows whichever the visitor used last. */
export type ChatLang = "hi" | "en";

export type ChatRole = "user" | "assistant";

/** A turn exactly as it goes over the wire. */
export interface ChatApiMessage {
  role: ChatRole;
  content: string;
}

/** A turn as the panel renders it. `streaming` means deltas are still arriving. */
export interface ChatMessage extends ChatApiMessage {
  id: string;
  status: "streaming" | "done";
  /** Language the server reported in its `done` event — picks the speech-synthesis voice. */
  lang?: ChatLang;
}

/** One quick question, pre-translated by the server. */
export interface ChatSuggestion {
  id: string;
  hi: string;
  en: string;
}

/** GET `/api/public/chat` payload. */
export interface ChatConfig {
  enabled: boolean;
  greeting: Record<ChatLang, string>;
  suggestions: ChatSuggestion[];
  /** Whether the Foundation wants spoken replies offered at all (the browser still has to support them). */
  voice: boolean;
}

/**
 * Failure buckets. The visitor never sees a server-authored string: the message is looked up in
 * {@link ChatCopy} so it is always in the language of the conversation and can never leak internals.
 */
export type ChatErrorKind = "network" | "rateLimit" | "unavailable" | "invalid" | "server";

/** Endpoint path (app-absolute; `withBasePath()` / the api client add the deployment sub-path). */
export const CHAT_ENDPOINT = "/api/public/chat";

/** Wire limits, mirrored from the route's Zod schema so the client never sends a request it knows is invalid. */
export const MAX_TURNS = 20;
export const MAX_MESSAGE_CHARS = 2000;

/** Conversation history — sessionStorage only, so it dies with the tab and never persists. */
export const HISTORY_STORAGE_KEY = "esk.chat.history.v1";
/** "The greeting has been opened in this tab" — drives the launcher's unread dot. */
export const SEEN_STORAGE_KEY = "esk.chat.seen.v1";
/** Spoken-replies preference — the one thing that is allowed to outlive the session. */
export const VOICE_STORAGE_KEY = "esk.chat.voice.v1";

const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN = /[A-Za-z]/;

/**
 * Best-effort language of a visitor turn: Devanagari wins, otherwise Latin letters mean English,
 * and anything else (digits, emoji, punctuation) leaves the current language alone.
 */
export function detectLang(text: string, current: ChatLang): ChatLang {
  if (DEVANAGARI.test(text)) return "hi";
  if (LATIN.test(text)) return "en";
  return current;
}

/** BCP-47 tag handed to the Web Speech APIs. */
export function speechTag(lang: ChatLang): string {
  return lang === "hi" ? "hi-IN" : "en-IN";
}
