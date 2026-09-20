import { z } from "zod";
import { apiHandler, parseBody } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  buildSystemPrompt,
  createChatStream,
  detectLanguage,
  getChatbotConfig,
  getKnowledgeSnapshot,
  type ChatMessage,
} from "@/server/chatbot";
import { getBranding } from "@/lib/settings";

/** The assistant reads live settings and streams; it must never be cached or pre-rendered. */
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;
const MAX_TOTAL_CHARS = 16_000;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Type a question first.").max(MAX_MESSAGE_CHARS, "That message is too long."),
});

const chatRequestSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1, "Type a question first.")
    .max(MAX_MESSAGES, "This conversation is too long. Please start a new chat.")
    .refine((m) => m[m.length - 1]?.role === "user", "The last message must be from the visitor.")
    .refine((m) => m.reduce((n, x) => n + x.content.length, 0) <= MAX_TOTAL_CHARS, "This conversation is too long. Please start a new chat."),
  lang: z.enum(["hi", "en"]).optional(),
});

function unavailable() {
  return new ApiError(503, "The assistant is not available right now.", "SERVICE_UNAVAILABLE");
}

/**
 * GET /api/public/chat → what the widget needs to render itself.
 * `enabled` is false when the Foundation switched the assistant off OR the server has no
 * OPENAI_API_KEY, so the widget hides instead of showing a broken panel.
 */
export const GET = apiHandler({ auth: "none", csrf: false, rateLimit: { limit: 60, windowSec: 60, name: "public-chat-config" } }, async () => {
  const config = await getChatbotConfig();
  return {
    enabled: config.available,
    greeting: { hi: config.greeting.hi, en: config.greeting.en },
    suggestions: config.suggestions.map((s) => ({ id: s.id, hi: s.hi, en: s.en })),
    voice: config.voice,
  };
});

/**
 * POST /api/public/chat → a server-sent-event stream of the assistant's reply.
 *
 * Rejections before the stream starts use the normal JSON envelope (422 / 429 / 503 / 500);
 * anything that goes wrong once streaming has begun arrives as a `{"error":…}` event.
 * The OpenAI key never leaves `src/server/chatbot.ts`.
 */
export const POST = apiHandler({ auth: "none" }, async ({ req, ip }) => {
  const config = await getChatbotConfig();
  if (!config.available) throw unavailable();

  // Per-IP limit from Admin → Settings → AI Assistant, enforced before the body is parsed or any
  // work is done. apiHandler's own `rateLimit` option cannot be used here: the limit is a setting.
  await enforceRateLimit(`public-chat:ip:${ip}`, config.maxMessagesPerHour, 3600);

  const body = await parseBody(req, chatRequestSchema);
  const messages: ChatMessage[] = body.messages.map((m) => ({ role: m.role, content: m.content }));
  const latest = messages[messages.length - 1]!.content;
  const { lang, romanisedHindi } = detectLanguage(latest, body.lang ?? null);

  // Built before the stream opens: a database failure here becomes a normal 500 envelope
  // rather than a half-open stream.
  const [knowledge, branding] = await Promise.all([getKnowledgeSnapshot(), getBranding()]);
  const systemPrompt = buildSystemPrompt({
    knowledge,
    lang,
    romanisedHindi,
    organisation: branding.siteName,
    extra: config.systemPromptExtra,
  });

  const stream = createChatStream({ model: config.model, systemPrompt, messages, lang, signal: req.signal });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      // Belt and braces for reverse proxies that buffer by default (nginx/Apache in front of /center).
      "X-Accel-Buffering": "no",
    },
  });
});
