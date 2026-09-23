import type { ChatErrorKind, ChatLang } from "./types";

/**
 * Every visible string of the widget in both languages. The assistant's own answers come from the
 * server; this file only covers the chrome (labels, states, errors) so a failure is always explained
 * in the language the visitor is already using.
 *
 * Launcher `aria-label`s stay English on purpose: the launcher exists before the conversation has a
 * language, and `aria-expanded` / `aria-controls` carry the state instead.
 */
export interface ChatCopy {
  /** Panel heading, built from the Foundation's own short name (DB-driven branding). */
  title: (name: string) => string;
  /**
   * Header status line shown while nothing is in flight. It is a presence claim about the service,
   * not a live connection check — the typing/streaming state replaces it the moment a reply starts.
   */
  statusIdle: string;
  close: string;
  clear: string;
  /** Short label beside the footer pill's icon (the full `clear` string stays the accessible name). */
  clearShort: string;
  languageLabel: string;
  logLabel: string;
  greetingFallback: string;
  /** Hero heading of the empty state, shown before the visitor has asked anything. */
  emptyTitle: string;
  /**
   * Exactly three capability chips. They are labels, not questions — the tappable prompts are the
   * suggestions from the server — and a fourth wraps the row on a 360px phone.
   */
  capabilities: string[];
  suggestionsLabel: string;
  placeholder: string;
  send: string;
  stop: string;
  typing: string;
  micStart: string;
  micStop: string;
  listening: string;
  copy: string;
  /** Short form shown next to the icon (the full string stays the accessible name). */
  copyShort: string;
  copied: string;
  speak: string;
  stopSpeaking: string;
  voiceOn: string;
  voiceOff: string;
  jumpToLatest: string;
  retry: string;
  disclaimer: string;
  charactersLeft: (n: number) => string;
  errors: Record<ChatErrorKind, string>;
}

const en: ChatCopy = {
  title: (name) => (name ? `${name} Assistant` : "Assistant"),
  statusIdle: "Online — quick replies",
  close: "Close chat",
  clear: "Clear chat",
  clearShort: "Clear",
  languageLabel: "Language",
  logLabel: "Conversation",
  greetingFallback: "Hello! Ask me about our courses, training centres, admissions or scholarships.",
  emptyTitle: "How can I help?",
  capabilities: ["Courses & fees", "Centres near you", "Admissions & scholarships"],
  suggestionsLabel: "Suggested questions",
  placeholder: "Type your question…",
  send: "Send message",
  stop: "Stop the reply",
  typing: "Assistant is typing",
  micStart: "Ask by voice",
  micStop: "Stop recording",
  listening: "Listening…",
  copy: "Copy reply",
  copyShort: "Copy",
  copied: "Copied",
  speak: "Play this reply",
  stopSpeaking: "Stop playback",
  voiceOn: "Turn spoken replies off",
  voiceOff: "Turn spoken replies on",
  jumpToLatest: "Go to the latest message",
  retry: "Try again",
  disclaimer: "AI assistant — please confirm important details with our team.",
  charactersLeft: (n) => `${n} characters left`,
  errors: {
    network: "The reply could not be loaded. Please check your connection and try again.",
    rateLimit: "You are sending messages too quickly. Please wait a moment and try again.",
    unavailable: "The assistant is unavailable right now. Please use the Contact page to reach our team.",
    invalid: "That message could not be sent. Please shorten it and try again.",
    server: "Something went wrong at our end. Please try again in a moment.",
  },
};

const hi: ChatCopy = {
  title: (name) => (name ? `${name} सहायक` : "सहायक"),
  statusIdle: "ऑनलाइन — तुरंत उत्तर",
  close: "चैट बंद करें",
  clear: "चैट साफ़ करें",
  clearShort: "साफ़ करें",
  languageLabel: "भाषा",
  logLabel: "बातचीत",
  greetingFallback: "नमस्ते! हमारे कोर्स, प्रशिक्षण केंद्र, प्रवेश या छात्रवृत्ति के बारे में पूछें।",
  emptyTitle: "मैं कैसे मदद करूँ?",
  capabilities: ["कोर्स और फ़ीस", "आस-पास के केंद्र", "प्रवेश और छात्रवृत्ति"],
  suggestionsLabel: "सुझाए गए प्रश्न",
  placeholder: "अपना प्रश्न लिखें…",
  send: "संदेश भेजें",
  stop: "उत्तर रोकें",
  typing: "सहायक लिख रहा है",
  micStart: "बोलकर पूछें",
  micStop: "रिकॉर्डिंग रोकें",
  listening: "सुन रहे हैं…",
  copy: "उत्तर कॉपी करें",
  copyShort: "कॉपी",
  copied: "कॉपी हो गया",
  speak: "यह उत्तर सुनें",
  stopSpeaking: "सुनना रोकें",
  voiceOn: "बोलकर उत्तर बंद करें",
  voiceOff: "बोलकर उत्तर चालू करें",
  jumpToLatest: "नवीनतम संदेश पर जाएँ",
  retry: "फिर से कोशिश करें",
  disclaimer: "एआई सहायक — ज़रूरी जानकारी हमारी टीम से ज़रूर पुष्टि करें।",
  charactersLeft: (n) => `${n} अक्षर शेष`,
  errors: {
    network: "उत्तर नहीं आ सका। कृपया अपना इंटरनेट जाँचें और फिर कोशिश करें।",
    rateLimit: "आप बहुत तेज़ी से संदेश भेज रहे हैं। कृपया थोड़ी देर रुककर फिर कोशिश करें।",
    unavailable: "सहायक अभी उपलब्ध नहीं है। कृपया संपर्क पृष्ठ से हमारी टीम से संपर्क करें।",
    invalid: "यह संदेश नहीं भेजा जा सका। कृपया इसे छोटा करके फिर भेजें।",
    server: "हमारी ओर से कुछ गड़बड़ हुई। कृपया थोड़ी देर बाद फिर कोशिश करें।",
  },
};

export const UI_COPY: Record<ChatLang, ChatCopy> = { en, hi };

/** English-only labels for the launcher, which exists before the conversation has a language. */
export const LAUNCHER_COPY = {
  open: "Open the chat assistant",
  close: "Close the chat assistant",
  unread: "New message",
  /**
   * Visible text of the desktop pill form of the launcher. It stays generic rather than naming the
   * Foundation because the branding `name` is a prop of ChatPanel, not of ChatLauncher.
   */
  label: "Ask a question",
} as const;
