"use client";

import * as React from "react";
import { speechTag, type ChatLang } from "./types";

/**
 * Voice in and voice out through the browser's own Web Speech APIs — no paid service, no key, no
 * network call. Everything is feature-detected inside an effect, so the server render is identical
 * everywhere and a browser without the API (Firefox, most iOS browsers) simply never sees the control.
 */

/* ───────────── feature detection ───────────── */

const noopSubscribe = () => () => {};

/**
 * SSR-safe capability check (the same `useSyncExternalStore` shape as `useMediaQuery` in the repo):
 * the server and the first client render always say "not supported", so no markup can mismatch, and
 * the real answer is applied on the next render without a setState-in-effect.
 */
function useFeature(probe: () => boolean): boolean {
  return React.useSyncExternalStore(noopSubscribe, probe, () => false);
}

const hasSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window;

/* ───────────── output: speechSynthesis ───────────── */

/** Preferred voices per language: Indian first, then the closest well-supported neighbours. */
const PREFERRED_VOICES: Record<ChatLang, string[]> = {
  hi: ["hi-in", "hi"],
  en: ["en-in", "en-gb", "en-us", "en"],
};

function pickVoice(voices: SpeechSynthesisVoice[], lang: ChatLang): SpeechSynthesisVoice | null {
  for (const tag of PREFERRED_VOICES[lang]) {
    const match = voices.find((v) => (v.lang ?? "").replace(/_/g, "-").toLowerCase().startsWith(tag));
    if (match) return match;
  }
  // No Indian (or any) voice for this language: let the engine choose with the utterance's `lang`.
  return null;
}

export interface SpeechOutput {
  supported: boolean;
  /** Id of the message currently being read aloud, if any. */
  speakingId: string | null;
  speak: (id: string, text: string, lang: ChatLang) => void;
  stop: () => void;
}

export function useSpeechOutput(): SpeechOutput {
  const supported = useFeature(hasSynthesis);
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);
  const voicesRef = React.useRef<SpeechSynthesisVoice[]>([]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => {
      try {
        voicesRef.current = synth.getVoices() ?? [];
      } catch {
        voicesRef.current = [];
      }
    };
    load();
    // Chrome fills the voice list asynchronously.
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stop = React.useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setSpeakingId(null);
  }, []);

  const speak = React.useCallback(
    (id: string, text: string, lang: ChatLang) => {
      const body = text.trim();
      if (!body) return;
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(body);
        const voice = pickVoice(voicesRef.current, lang);
        if (voice) utterance.voice = voice;
        utterance.lang = voice?.lang || speechTag(lang);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
        utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));
        setSpeakingId(id);
        synth.speak(utterance);
      } catch {
        setSpeakingId(null);
      }
    },
    []
  );

  return { supported, speakingId, speak, stop };
}

/* ───────────── input: SpeechRecognition ───────────── */

/**
 * Minimal local shapes for the recognition API: it is not in `lib.dom`, and the webkit-prefixed
 * constructor never will be. Nothing here is a global declaration, so no other module is affected.
 */
interface RecognitionAlternative {
  transcript?: string;
}
interface RecognitionResult extends ArrayLike<RecognitionAlternative | undefined> {
  isFinal?: boolean;
}
interface RecognitionEvent {
  resultIndex?: number;
  results?: ArrayLike<RecognitionResult | undefined>;
}
interface RecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionInstance;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const hasRecognition = () => getRecognitionCtor() !== null;

export interface SpeechInput {
  supported: boolean;
  listening: boolean;
  start: (lang: ChatLang) => void;
  stop: () => void;
}

/**
 * Dictation for the composer. `onTranscript` receives the whole transcript so far (final text plus
 * the current interim guess) and whether it is final; the composer writes it into the input as it
 * arrives. Every call into the API is wrapped — a blocked microphone or an unsupported browser must
 * never throw into the render tree.
 */
export function useSpeechInput(onTranscript: (text: string, final: boolean) => void): SpeechInput {
  const supported = useFeature(hasRecognition);
  const [listening, setListening] = React.useState(false);
  const instanceRef = React.useRef<RecognitionInstance | null>(null);
  const finalRef = React.useRef("");
  const callbackRef = React.useRef(onTranscript);

  React.useEffect(() => {
    callbackRef.current = onTranscript;
  }, [onTranscript]);

  React.useEffect(() => {
    return () => {
      try {
        instanceRef.current?.abort();
      } catch {
        /* ignore */
      }
      instanceRef.current = null;
    };
  }, []);

  const stop = React.useCallback(() => {
    try {
      instanceRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = React.useCallback((lang: ChatLang) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    try {
      instanceRef.current?.abort();
    } catch {
      /* ignore */
    }
    let recognition: RecognitionInstance;
    try {
      recognition = new Ctor();
    } catch {
      return;
    }
    recognition.lang = speechTag(lang);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    finalRef.current = "";

    recognition.onresult = (event) => {
      const results = event.results;
      if (!results) return;
      let interim = "";
      for (let i = event.resultIndex ?? 0; i < results.length; i++) {
        const result = results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current += transcript;
        else interim += transcript;
      }
      const text = `${finalRef.current}${interim}`.replace(/\s+/g, " ").trim();
      callbackRef.current(text, interim.length === 0);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      instanceRef.current = null;
    };

    instanceRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      instanceRef.current = null;
    }
  }, []);

  return { supported, listening, start, stop };
}
