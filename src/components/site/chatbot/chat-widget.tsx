"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api-client";
import { useChat } from "./use-chat";
import { ChatLauncher } from "./chat-launcher";
import { CHAT_ENDPOINT, SEEN_STORAGE_KEY, VOICE_STORAGE_KEY, type ChatConfig } from "./types";

/**
 * The panel (and with it the speech code, the markdown renderer and the overlay hooks) is a separate
 * chunk: a visitor who never opens the assistant only pays for the launcher.
 */
const ChatPanel = dynamic(() => import("./chat-panel").then((m) => m.ChatPanel), { ssr: false });

/** Exit-animation budget, matching the overlay convention in the UI kit. */
const EXIT_MS = 200;

/** Keeps the panel mounted for its exit animation (mirrors `useOverlayPresence` without pulling in BottomSheet). */
function usePresence(open: boolean): { rendered: boolean; closing: boolean } {
  const [previous, setPrevious] = React.useState(open);
  const [closing, setClosing] = React.useState(false);
  if (open !== previous) {
    setPrevious(open);
    setClosing(!open);
  }
  React.useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setClosing(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);
  const isClosing = closing && !open;
  return { rendered: open || isClosing, closing: isClosing };
}

/** Remote config is untrusted input: accept only the shape the contract promises. */
function normalizeConfig(raw: unknown): ChatConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ChatConfig>;
  // `enabled:false` means the Foundation switched the assistant off or the server has no
  // OPENAI_API_KEY. The widget must render nothing at all rather than show a panel that cannot reply.
  if (value.enabled !== true) return null;
  const greeting = value.greeting && typeof value.greeting === "object" ? value.greeting : { hi: "", en: "" };
  const suggestions = Array.isArray(value.suggestions)
    ? value.suggestions
        .filter((s): s is ChatConfig["suggestions"][number] => !!s && typeof s === "object" && typeof s.id === "string")
        .slice(0, 8)
        .map((s) => ({ id: s.id, hi: typeof s.hi === "string" ? s.hi : "", en: typeof s.en === "string" ? s.en : "" }))
        .filter((s) => s.hi || s.en)
    : [];
  return {
    enabled: true,
    greeting: { hi: typeof greeting.hi === "string" ? greeting.hi : "", en: typeof greeting.en === "string" ? greeting.en : "" },
    suggestions,
    voice: value.voice === true,
  };
}

/** Reads a "1"/"0" flag from web storage, tolerating private mode, blocked storage and SSR. */
function readFlag(scope: "session" | "local", key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = (scope === "session" ? window.sessionStorage : window.localStorage).getItem(key);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(scope: "session" | "local", key: string, value: boolean): void {
  try {
    (scope === "session" ? window.sessionStorage : window.localStorage).setItem(key, value ? "1" : "0");
  } catch {
    /* storage blocked: the preference simply does not stick */
  }
}

export interface ChatWidgetProps {
  /** The Foundation's short name from DB branding; it names the assistant in the panel header. */
  name?: string;
}

/**
 * Public-site assistant. Mounted once in the `(site)` layout, so it follows the visitor across the
 * public pages (and never appears inside /student, /trainer or /admin).
 *
 * The conversation state lives here rather than in the panel: a reply keeps streaming while the
 * panel is closed, and closing it never throws the transcript away.
 */
export function ChatWidget({ name = "" }: ChatWidgetProps) {
  const [config, setConfig] = React.useState<ChatConfig | null>(null);
  const [open, setOpen] = React.useState(false);
  const [unreadReply, setUnreadReply] = React.useState(false);
  // Preferences are read during the first render (nothing is rendered until the config arrives, so
  // there is no server markup to mismatch) rather than written back from an effect.
  const [seen, setSeen] = React.useState(() => readFlag("session", SEEN_STORAGE_KEY, false));
  const [voiceOn, setVoiceOn] = React.useState(() => readFlag("local", VOICE_STORAGE_KEY, false));

  const chat = useChat();
  const launcherRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();
  const { rendered, closing } = usePresence(open);

  // Config on idle: the launcher must not compete with the page's own first paint.
  React.useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get<ChatConfig>(CHAT_ENDPOINT)
        .then((data) => {
          if (!cancelled) setConfig(normalizeConfig(data));
        })
        .catch(() => {
          // Disabled, unconfigured or unreachable: the assistant simply does not appear.
        });
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idle = 0;
    let timer = 0;
    if (typeof w.requestIdleCallback === "function") idle = w.requestIdleCallback(load, { timeout: 2000 });
    else timer = window.setTimeout(load, 600);
    return () => {
      cancelled = true;
      if (idle && typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // A reply that finishes while the panel is closed is a real reason to show the dot.
  const replyCount = chat.messages.filter((m) => m.role === "assistant" && m.status === "done").length;
  const previousReplies = React.useRef(replyCount);
  React.useEffect(() => {
    if (replyCount > previousReplies.current && !open) setUnreadReply(true);
    previousReplies.current = replyCount;
  }, [replyCount, open]);

  // Keyboard route back into the assistant after a close (Escape, the X, a backdrop tap).
  //
  // This keys on `rendered`, not on `open`: the panel lingers for its 200ms exit animation, so when
  // `open` flips the focus is still on an element inside the panel and a `document.body` check would
  // be false. The browser only drops focus to <body> when that element is finally removed, and by
  // then an `open`-keyed effect has long since run. Focus is left alone if anything else already
  // claimed it (the trap's own returnFocus, or a link the visitor clicked to close the panel).
  const wasRendered = React.useRef(false);
  React.useEffect(() => {
    if (wasRendered.current && !rendered) {
      const active = document.activeElement;
      if (!active || active === document.body) launcherRef.current?.focus();
    }
    wasRendered.current = rendered;
  }, [rendered]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        setUnreadReply(false);
        setSeen(true);
        writeFlag("session", SEEN_STORAGE_KEY, true);
      }
      return next;
    });
  };

  const handleVoiceChange = (on: boolean) => {
    setVoiceOn(on);
    writeFlag("local", VOICE_STORAGE_KEY, on);
  };

  if (!config) return null;

  return (
    <>
      <ChatLauncher ref={launcherRef} open={open} onToggle={toggle} panelId={panelId} unread={!seen || unreadReply} pulse={!seen && !open} />
      {rendered && (
        <ChatPanel
          panelId={panelId}
          name={name}
          config={config}
          chat={chat}
          closing={closing}
          onClose={() => setOpen(false)}
          voiceOn={voiceOn}
          onVoiceChange={handleVoiceChange}
        />
      )}
    </>
  );
}
