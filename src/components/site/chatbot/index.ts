/**
 * Public-site AI assistant.
 *
 * Mount `<ChatWidget />` once, in `src/app/(site)/layout.tsx`. Everything else in this folder is an
 * implementation detail: the panel, the speech hooks and the conversation state are pulled in by the
 * widget (the panel lazily), and nothing here is used by the student, trainer or admin portals.
 */
export { ChatWidget, type ChatWidgetProps } from "./chat-widget";
export type { ChatConfig, ChatLang, ChatMessage, ChatSuggestion } from "./types";
