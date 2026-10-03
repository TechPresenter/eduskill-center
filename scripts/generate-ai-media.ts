/**
 * Generates the website's photographic artwork with an image model — OpenAI's gpt-image models
 * (default) or Google's Gemini image models ("Nano Banana", --provider=gemini):
 * one cover per live course, one picture per Foundation programme, cut-out figures for the hero
 * slides and the photo behind the default social-share card.
 *
 * Art direction: photorealistic editorial photography of Indian learners and teachers — the look
 * the site's hero and course cover already have — with the EduSkill palette (logo blue, orange,
 * green) carried by the scene itself. No text, logos or watermarks are ever generated: the real
 * logo and every word on a card come from the site, so nothing can be misspelt or off-brand.
 *
 * Files land in public/media/ai/ (and public/og-default.png) and are indexed in
 * public/media/ai/manifest.json (id → file, model, prompt) so a rerun is reproducible.
 * scripts/apply-ai-visuals.ts then points the courses, programmes and hero slides at them.
 *
 *   npx tsx scripts/generate-ai-media.ts --dry-run             # list what would be generated
 *   npx tsx scripts/generate-ai-media.ts                       # generate everything missing
 *   npx tsx scripts/generate-ai-media.ts --only=course-class-6 # just one asset (comma separated)
 *   npx tsx scripts/generate-ai-media.ts --force               # regenerate files that exist
 *   npx tsx scripts/generate-ai-media.ts --provider=gemini --model=gemini-3.1-flash-image --concurrency=3
 *
 * Needs OPENAI_API_KEY (openai) or GEMINI_API_KEY (gemini) in the environment or .env — never
 * committed. Gemini IMAGE models are a paid feature: on a project without billing the API answers
 * 429 "limit: 0" and this script stops with instructions instead of retrying.
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// ── Models ───────────────────────────────────────────────────────────────────

/**
 * Image-capable Gemini models. `aspectRatio`/`imageSize` say whether the model accepts those
 * `generationConfig.imageConfig` fields; every prompt also states the aspect in words, so a model
 * that ignores the field still composes for the right crop.
 */
const MODELS = {
  "gemini-3-pro-image": { aspectRatio: true, imageSize: true },
  "gemini-3.1-flash-image": { aspectRatio: true, imageSize: false },
  "gemini-3.1-flash-lite-image": { aspectRatio: true, imageSize: false },
  "gemini-2.5-flash-image": { aspectRatio: true, imageSize: false },
} as const satisfies Record<string, { aspectRatio: boolean; imageSize: boolean }>;

type GeminiModel = keyof typeof MODELS;

/** OpenAI image models (Images API). None of them returns 16:9, so the script crops afterwards. */
const OPENAI_MODELS = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"] as const;
type OpenAiModel = (typeof OPENAI_MODELS)[number];

type Provider = "openai" | "gemini";
type ModelName = GeminiModel | OpenAiModel;

const DEFAULT_PROVIDER: Provider = "openai";
/** gpt-image-2 at high quality for OpenAI; Nano Banana Pro for Gemini. */
const DEFAULT_MODEL: Record<Provider, ModelName> = { openai: "gpt-image-2", gemini: "gemini-3-pro-image" };
const OPENAI_URL = "https://api.openai.com/v1/images/generations";

function providerOf(model: ModelName): Provider {
  return (OPENAI_MODELS as readonly string[]).includes(model) ? "openai" : "gemini";
}
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ── Prompt building blocks ───────────────────────────────────────────────────
// Shared clauses keep every asset on-brand and on-style; only the subject changes per entry.

/** Aspect ratios the Gemini image models accept. */
type Aspect = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";

const ASPECT_RATIO: Record<Aspect, number> = {
  "1:1": 1,
  "2:3": 2 / 3,
  "3:2": 3 / 2,
  "3:4": 3 / 4,
  "4:3": 4 / 3,
  "4:5": 4 / 5,
  "5:4": 5 / 4,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "21:9": 21 / 9,
};

const STYLE =
  "Style: high-end photorealistic editorial photograph for a non-profit education website, as if shot on a full-frame " +
  "camera with a 35mm lens: soft natural daylight, true-to-life Indian skin tones, crisp focus on the people with a gently " +
  "blurred background, clean modern composition, warm and optimistic mood, professional colour grade.";

/** The site's tokens (src/app/globals.css): navy #004C96, orange #E8520A, green #2F8A2A, lavender #E8EAF6. */
const PALETTE =
  "Brand colour: the EduSkill India Foundation palette is carried naturally by the scene — deep logo blue #004C96 as the " +
  "main accent (a wall panel, a backpack, a notebook, a uniform or kurta detail), vivid orange #E8520A in one or two small " +
  "accents, fresh green #2F8A2A from plants or a small prop, set against clean white and soft lavender #E8EAF6 surfaces. " +
  "No neon and no other strong colours.";

const PEOPLE =
  "People: Indian learners and teachers shown as capable, focused and dignified — a natural mix of girls and boys or young " +
  "women and men, neat school uniforms or contemporary everyday Indian clothing (kurta, salwar kameez with dupatta, shirt " +
  "and trousers, simple saree), genuine relaxed expressions, natural hands. Rooms are bright, clean and modestly equipped " +
  "with current, working equipment. Avoid poverty, pity or charity tropes; no torn clothing, dirt or slum imagery; no " +
  "religious or caste markers; no foreign visitor figures; not a Western classroom cliche.";

const GUARD =
  "Do not render any readable text, letters, numerals, signage, logos, watermarks or brand marks anywhere — books, " +
  "screens, boards, charts and papers show only soft blurred or abstract content. No distorted faces or hands, no extra " +
  "fingers. Not an illustration, not a cartoon, not a 3D render, no frame or border.";

function safeArea(aspect: Aspect, extra = ""): string {
  return `Format: composed for a ${aspect} crop with clear margins on all four sides so nothing important is cut off when the image is cropped slightly.${extra ? ` ${extra}` : ""}`;
}

/** A photograph with people in it. */
function photo(subject: string, composition: string, aspect: Aspect): string {
  return [subject, composition, STYLE, PALETTE, PEOPLE, GUARD, safeArea(aspect)].join(" ");
}

/** Studio-key green for the hero cut-outs; the script removes it to leave a transparent PNG. */
const KEY_GREEN = "#00B140";

/** One person, photographed against a flat chroma-key green so they can be cut out cleanly. */
function cutout(subject: string, pose: string, aspect: Aspect): string {
  return [
    subject,
    pose,
    STYLE.replace("crisp focus on the people with a gently blurred background, ", ""),
    PEOPLE,
    `Background: a perfectly flat, evenly lit chroma-key green (${KEY_GREEN}) studio backdrop filling the whole frame — no ` +
      "shadows on it, no floor, no gradient, no props touching the edge. Nothing green on the person: clothing, books and " +
      "props avoid every shade of green so the background can be removed cleanly. Soft even lighting with no green spill " +
      "on the skin or hair.",
    GUARD,
    `Format: ${aspect} portrait canvas, the person centred and seen from the knees up, with an even margin of green above ` +
      "the head and on both sides; the bottom edge may cut through the legs.",
  ].join(" ");
}

/** The OpenAI canvas closest to an aspect; the result is cropped to the exact ratio afterwards. */
function openAiSize(aspect: Aspect): "1536x1024" | "1024x1536" | "1024x1024" {
  const r = ASPECT_RATIO[aspect];
  return r > 1.05 ? "1536x1024" : r < 0.95 ? "1024x1536" : "1024x1024";
}

// ── Asset manifest ───────────────────────────────────────────────────────────

type AssetKind = "course" | "program" | "hero" | "social";

interface AssetSpec {
  /** Stable id, also the `--only=` selector and the manifest key. */
  id: string;
  kind: AssetKind;
  /** Output path relative to public/. The extension decides the format (.webp or .png). */
  file: string;
  aspect: Aspect;
  /** Target width in px; the returned image is downscaled to this if larger, never upscaled. */
  width: number;
  /** True when the art is meant to sit on a page background with its own alpha. */
  transparent: boolean;
  /** "chroma" removes the KEY_GREEN backdrop and trims the figure to its bounding box. */
  postprocess?: "chroma";
  prompt: string;
}

/** Course covers: 16:9 like every course card and the course page (`media media-16x9`). */
function course(slug: string, subject: string, composition = "Composition: the group sits slightly right of centre with calm space on the left; eye-level, natural depth."): AssetSpec {
  return { id: `course-${slug}`, kind: "course", file: `media/ai/courses/${slug}.webp`, aspect: "16:9", width: 1600, transparent: false, prompt: photo(subject, composition, "16:9") };
}

/** Programme pictures: 16:9 for the programme page, the programme cards and social previews. */
function program(slug: string, subject: string, composition = "Composition: the main people slightly right of centre, a clear readable scene, eye-level, natural depth."): AssetSpec {
  return { id: `program-${slug}`, kind: "program", file: `media/ai/programs/${slug}.webp`, aspect: "16:9", width: 1600, transparent: false, prompt: photo(subject, composition, "16:9") };
}

/** Hero slide figures: transparent PNGs that stand on the hero's baseline like /image-eduskill.png. */
function heroFigure(id: string, subject: string, pose: string): AssetSpec {
  return { id: `hero-${id}`, kind: "hero", file: `media/ai/hero/${id}.png`, aspect: "4:5", width: 1100, transparent: true, postprocess: "chroma", prompt: cutout(subject, pose, "4:5") };
}

/** Age phrase for a school class (Class N is roughly N+5 years old). */
const age = (classNumber: number) => `${classNumber + 5}-year-old`;

/**
 * Every asset the site needs. Course ids follow the live course slugs (/courses/<slug>), programme
 * ids the live programme slugs (/programs/<slug>).
 */
export const AI_ASSETS: readonly AssetSpec[] = [
  // ── Courses: Normal Education Centres (Class 1–4) ──────────────────────────
  course("class-1", `Class 1 at a bright community Normal Education Centre: three ${age(1)} children sitting on a clean mat learn their first letters and numbers with colourful wooden blocks, while a young woman teacher kneels beside them and points to a block, everyone smiling.`),
  course("class-2", `Class 2: four ${age(2)} children share large colourful picture books on a low table, one child pointing at a picture while the others lean in curiously; their young teacher listens with a warm smile.`),
  course("class-3", `Class 3: ${age(3)} children practise addition with a colourful wooden abacus and number cards at a low table; one girl eagerly raises her hand to answer.`),
  course("class-4", `Class 4 environmental studies: ${age(4)} children plant seedlings in small pots by a sunny window and sketch leaves in their notebooks, their teacher helping one child water a pot.`),
  // ── Courses: School Education (Class 5–10) ─────────────────────────────────
  course("class-5", `Class 5: ${age(5)} students in neat blue school uniforms gather round a classroom globe; one girl points to India while two classmates watch, a world map softly blurred behind them.`),
  course("class-6", `Class 6: ${age(6)} students build a simple science model of the solar system at their desk, a young woman teacher guiding them, all three students focused and smiling.`),
  course("class-7", `Class 7: ${age(7)} students learn computer basics together on a laptop in a tidy computer corner, one student at the keyboard and two others leaning in to help.`),
  course("class-8", `Class 8: ${age(8)} students wearing safety goggles do a hands-on science experiment with test tubes and coloured liquids in a clean school laboratory.`),
  course("class-9", `Class 9: ${age(9)} students solve a mathematics problem together at a whiteboard covered in abstract, unreadable working; one student explains while two others follow attentively.`),
  course("class-10", `Class 10: ${age(10)} students in a calm, focused board-exam study group at a library table with notebooks, highlighters and textbooks, determined and confident.`),
  // ── Courses: Senior Secondary (Class 11–12) ────────────────────────────────
  course("class-11", `Class 11 science stream: ${age(11)} students measure with a simple pendulum and an electric circuit kit in a modern physics lab, one taking notes, their teacher nearby.`),
  course("class-12", `Class 12: ${age(12)} senior students plan their next step after school in a bright study room, one with a laptop, two with books, looking ahead with quiet confidence.`),
  // ── Courses: Competitive Exam Training ─────────────────────────────────────
  course(
    "competitive-exam-training",
    "Competitive exam training: young adults aged 18 to 24 take a timed practice test at individual desks in a modern training centre, filling bubble answer sheets with no readable text, a large wall clock softly visible, a mentor walking between the rows."
  ),

  // ── Programmes ─────────────────────────────────────────────────────────────
  program(
    "eduskill-shiksha-mission",
    "Project EduSkill Shiksha Mission: a community Normal Education Centre in a clean panchayat building; a local woman teacher in a simple cotton saree teaches children of Class 1 to 4 sitting on mats with slates and books, bright morning light through the windows."
  ),
  program(
    "ai-workshop-training",
    "A school AI training and awareness workshop: a young trainer at a large smart board showing a glowing abstract network diagram, school students of Class 8 to 10 with laptops raising their hands with excitement, a modern school seminar room."
  ),
  program(
    "computer-skill-development-training",
    "Computer and skill development training: young women and men learning office software on desktop computers in a modern computer lab, a trainer helping one learner at her screen."
  ),
  program(
    "digital-literacy",
    "Digital literacy: a young volunteer patiently shows a middle-aged woman how to use a smartphone, both smiling, at a community centre table with a second pair learning in the background."
  ),
  program("computer-education", "Computer education: students practise typing and data entry on keyboards in a bright computer lab, hands on the keys, one student checking her work."),
  program(
    "skill-development",
    "Skill development: young women and men in a certified short skills course assemble simple electronic circuit boards at a clean workbench under a trainer's guidance."
  ),
  program(
    "vocational-training",
    "Vocational training: in a bright workshop a young man practises electrical wiring on a training board while, slightly behind him, a young woman works at a sewing machine; both focused and skilled."
  ),
  program(
    "career-development",
    "Career development: a confident young woman in smart formal wear practises a mock job interview with a friendly mentor across a table, other learners rehearsing in pairs in the background."
  ),
  program(
    "entrepreneurship",
    "Entrepreneurship: a proud young woman micro-entrepreneur at her small, neat shop counter manages orders on her smartphone, shelves of packaged goods softly blurred behind her."
  ),
  program(
    "women-empowerment",
    "Women empowerment: a women-led training batch — several women of different ages learning together with a woman trainer, laptops and a sewing machine on the tables, supportive and confident."
  ),
  program(
    "youth-empowerment",
    "Youth empowerment: young people aged 16 to 25 in a leadership workshop, gathered round a table covered with sticky notes with no readable writing, one young man presenting an idea while the others listen."
  ),
  program(
    "digital-marketing-training",
    "Digital marketing training: young women and men at laptops in a bright modern training room plan a social media campaign, one designing a colourful poster on screen and another filming a short video on a smartphone on a small tripod, a trainer pointing at a large display of abstract charts with no readable text."
  ),
  program(
    "rural-skill-development",
    "Rural skill development: rural youth learn to install a solar panel on a training frame at a block-level centre, green fields and a clear sky behind them, a trainer pointing to the panel."
  ),
  program(
    "other-foundation-programs",
    "Community programmes: Foundation volunteers in plain blue shirts talk with parents and children at a community awareness and scholarship information session under a bright canopy."
  ),

  // ── Hero slide figures ─────────────────────────────────────────────────────
  heroFigure(
    "shiksha-student",
    "A cheerful 9-year-old Indian schoolgirl in a neat navy-blue school uniform with an orange ribbon, holding two books and a small slate against her chest.",
    "Standing pose turned three-quarters towards the left of the frame, bright natural smile, looking at the camera."
  ),
  heroFigure(
    "centre-teacher",
    "A young Indian woman community teacher in her late twenties wearing a simple deep-blue cotton kurta with an orange dupatta, holding an open book in one hand.",
    "Standing pose turned three-quarters towards the left of the frame, gesturing warmly with her free hand as if welcoming students, confident friendly smile."
  ),

  // ── Social share card photo (composed with the real logo into og-default.png) ─
  {
    id: "social-og-photo",
    kind: "social",
    file: "media/ai/social/og-photo.webp",
    aspect: "16:9",
    width: 1600,
    transparent: false,
    prompt: photo(
      "Three Indian learners in a bright training centre — a teenage girl holding a laptop, a teenage boy holding books and a young woman trainer — standing together, smiling at the camera.",
      "Composition: the three people fill the right half of the frame; the left half is a calm, softly blurred bright interior with no detail, ready for text to be placed over it.",
      "16:9"
    ),
  },
];

// ── Failure kinds ────────────────────────────────────────────────────────────

type FatalKind = "billing" | "quota" | "auth" | "model" | "request" | "config";

/** An error that stops the whole run — retrying inside this process cannot help. */
class FatalError extends Error {
  readonly kind: FatalKind;
  readonly lines: readonly string[];

  constructor(kind: FatalKind, headline: string, lines: readonly string[] = []) {
    super(headline);
    this.name = "FatalError";
    this.kind = kind;
    this.lines = lines;
  }

  /** The single, self-contained message the CLI prints. */
  report(): string {
    const rule = "-".repeat(78);
    return [rule, this.message, "", ...this.lines, rule].join("\n");
  }
}

/** An error for one asset: the rest of the run continues. */
class AssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetError";
  }
}

const BILLING_LINES = [
  'The API answered 429 RESOURCE_EXHAUSTED with "limit: 0", which means the Google Cloud project',
  "behind GEMINI_API_KEY has NO image-generation quota at all — this is not a case of sending",
  "requests too quickly, so retrying cannot help and this script deliberately did not try.",
  "Gemini image models are a paid feature; the free tier does not include them.",
  "",
  "To fix it, enable billing on the project that owns the key, then re-run this script unchanged:",
  "  1. https://aistudio.google.com/apikey            — see which project the API key belongs to",
  "  2. https://console.cloud.google.com/billing      — link a billing account to that project",
  "  3. https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas",
  "                                                   — confirm the image model quota is above 0",
  "  4. https://ai.google.dev/gemini-api/docs/pricing — image generation pricing",
  "",
  "No files were written. Text-only Gemini models are unaffected by this quota.",
];

// ── Gemini HTTP plumbing ─────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Everything useful out of a Gemini error envelope. */
interface ApiError {
  message: string;
  status: string;
  /** Quota ids from the QuotaFailure detail, e.g. GenerateRequestsPerMinutePerProjectPerModel-FreeTier. */
  quotaIds: string[];
  /** Seconds from the RetryInfo detail, if any. */
  retryDelaySeconds: number | null;
}

function parseApiError(bodyText: string): ApiError {
  let error: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (isRecord(parsed) && isRecord(parsed.error)) error = parsed.error;
  } catch {
    // Non-JSON body (a proxy or gateway page): fall through and report the raw text.
  }
  const quotaIds: string[] = [];
  let retryDelaySeconds: number | null = null;
  for (const detail of asArray(error.details)) {
    if (!isRecord(detail)) continue;
    for (const violation of asArray(detail.violations)) {
      if (isRecord(violation) && typeof violation.quotaId === "string") quotaIds.push(violation.quotaId);
    }
    const delay = str(detail.retryDelay);
    if (delay) {
      const seconds = Number.parseFloat(delay.replace(/s$/, ""));
      if (Number.isFinite(seconds)) retryDelaySeconds = seconds;
    }
  }
  return {
    message: str(error.message) || bodyText.slice(0, 400).trim() || "(no error message)",
    status: str(error.status),
    quotaIds,
    retryDelaySeconds,
  };
}

/** True when the quota the project blew is zero — i.e. it has no image quota at all. */
function isZeroQuota(message: string): boolean {
  return /limit:\s*0(?![\d.])/.test(message);
}

/**
 * A 429 can mean two very different things and only the body says which.
 *
 * "limit: 0" is a hard no — the project has no image quota — yet that very same response still
 * carries a per-minute quota violation, a RetryInfo and a "Please retry in 13.58s" sentence, so a
 * naive retry loop hammers the API forever. Zero quota is therefore tested first and never retried.
 */
function classifyQuota(err: ApiError): { retry: false } | { retry: true; afterSeconds: number | null } {
  if (isZeroQuota(err.message)) return { retry: false };
  const perMinute = err.quotaIds.some((id) => /PerMinute/i.test(id)) || /per\s*minute/i.test(err.message);
  const perDay = err.quotaIds.some((id) => /PerDay/i.test(id)) || /per\s*day/i.test(err.message);
  if (perMinute && !perDay) return { retry: true, afterSeconds: err.retryDelaySeconds };
  return { retry: false };
}

function oneLine(message: string, max = 400): string {
  return message.replace(/\s+/g, " ").trim().slice(0, max);
}

function quotaFatal(model: string, err: ApiError): FatalError {
  if (isZeroQuota(err.message)) {
    return new FatalError("billing", `Gemini image generation is not available to this API key (model ${model}).`, BILLING_LINES);
  }
  return new FatalError("quota", `Gemini quota exhausted for ${model}.`, [
    "The API answered 429 RESOURCE_EXHAUSTED and the exhausted quota is not a per-minute rate limit,",
    "so waiting a few seconds cannot clear it. Check the project's quota, then re-run:",
    "  https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas",
    "",
    `API message: ${oneLine(err.message)}`,
    "",
    "Images already written were kept — a re-run continues where this stopped.",
  ]);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface RequestContext {
  apiKey: string;
  model: ModelName;
  attempts: number;
  log: (line: string) => void;
}

const OPENAI_BILLING_LINES = [
  "The OpenAI API refused for billing or quota reasons, so retrying cannot help.",
  "  https://platform.openai.com/settings/organization/billing — add credit or raise the limit",
  "  https://platform.openai.com/settings/organization/limits  — check the usage limits",
  "",
  "Images already written were kept — a re-run continues where this stopped.",
];

/** POSTs one prompt to the OpenAI Images API and returns the decoded image bytes. */
async function requestOpenAiImage(spec: AssetSpec, ctx: RequestContext): Promise<{ data: Buffer; mimeType: string }> {
  const body = JSON.stringify({ model: ctx.model, prompt: spec.prompt, size: openAiSize(spec.aspect), quality: "high", output_format: "png", n: 1 });
  for (let attempt = 1; ; attempt++) {
    const backoff = Math.min(60_000, 3_000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500);
    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${ctx.apiKey}` },
        body,
        signal: AbortSignal.timeout(300_000),
      });
    } catch (cause) {
      if (attempt >= ctx.attempts) throw new AssetError(`network error: ${cause instanceof Error ? cause.message : String(cause)}`);
      ctx.log(`  ${spec.id}: network error, retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt}/${ctx.attempts})`);
      await sleep(backoff);
      continue;
    }
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON (a proxy page): reported below.
    }
    if (res.ok) {
      const first = isRecord(parsed) ? asArray(parsed.data)[0] : null;
      const b64 = isRecord(first) ? str(first.b64_json) : "";
      if (!b64) throw new AssetError("the response contained no image");
      return { data: Buffer.from(b64, "base64"), mimeType: "image/png" };
    }
    const err = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : {};
    const message = oneLine(str(err.message) || text, 300);
    const code = str(err.code);
    if (res.status === 401) throw new FatalError("auth", "OpenAI rejected the API key (HTTP 401).", ["OPENAI_API_KEY is missing, revoked or mistyped.", "", `API message: ${message}`]);
    // Only an exhausted balance is final; an ordinary rate-limit message also mentions "billing".
    if (res.status === 429 && (code === "insufficient_quota" || /insufficient_quota|exceeded your current quota|no credits remaining/i.test(message))) {
      throw new FatalError("billing", "OpenAI: no credit or quota left for image generation.", OPENAI_BILLING_LINES);
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= ctx.attempts) throw new AssetError(`HTTP ${res.status} after ${ctx.attempts} attempts: ${message}`);
      const header = Number.parseFloat(res.headers.get("retry-after") ?? "");
      const waitMs = Math.min(90_000, Math.max(Number.isFinite(header) ? header * 1000 : 0, backoff));
      ctx.log(`  ${spec.id}: HTTP ${res.status}, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${ctx.attempts})`);
      await sleep(waitMs);
      continue;
    }
    // A safety-system refusal concerns this prompt only; anything else at 400 is a request-shape problem.
    if (res.status === 400 && /moderation|safety|content_policy/i.test(`${code} ${message}`)) throw new AssetError(`refused by the safety system: ${message}`);
    if (res.status === 404) throw new FatalError("model", `OpenAI has no image model named "${ctx.model}".`, [`Known: ${OPENAI_MODELS.join(", ")}`]);
    if (res.status === 400) throw new FatalError("request", `OpenAI rejected the request (HTTP 400) for ${ctx.model}.`, [`API message: ${message}`]);
    throw new AssetError(`HTTP ${res.status}: ${message}`);
  }
}

/** POSTs one prompt and returns the decoded image bytes, retrying only where retrying can help. */
async function requestImage(spec: AssetSpec, ctx: RequestContext): Promise<{ data: Buffer; mimeType: string }> {
  if (providerOf(ctx.model) === "openai") return requestOpenAiImage(spec, ctx);
  const caps = MODELS[ctx.model as GeminiModel];
  const imageConfig: Record<string, string> = {};
  if (caps.aspectRatio) imageConfig.aspectRatio = spec.aspect;
  if (caps.imageSize) imageConfig.imageSize = spec.width >= 1600 ? "2K" : "1K";

  const body = JSON.stringify({
    contents: [{ parts: [{ text: spec.prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
    },
  });

  for (let attempt = 1; ; attempt++) {
    const backoff = Math.min(60_000, 2_000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${ctx.model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": ctx.apiKey },
        body,
      });
    } catch (cause) {
      // Network-level failure: worth another go.
      if (attempt >= ctx.attempts) throw new AssetError(`network error: ${cause instanceof Error ? cause.message : String(cause)}`);
      ctx.log(`  ${spec.id}: network error, retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt}/${ctx.attempts})`);
      await sleep(backoff);
      continue;
    }

    if (res.ok) return readImage(await res.text(), spec);

    const text = await res.text();
    const err = parseApiError(text);

    if (res.status === 429) {
      const verdict = classifyQuota(err);
      if (!verdict.retry) throw quotaFatal(ctx.model, err);
      const header = Number.parseFloat(res.headers.get("retry-after") ?? "");
      const serverMs = Math.max(Number.isFinite(header) ? header * 1000 : 0, (verdict.afterSeconds ?? 0) * 1000);
      const waitMs = Math.min(60_000, Math.max(serverMs, backoff));
      if (attempt >= ctx.attempts) throw new AssetError(`rate limited after ${ctx.attempts} attempts: ${oneLine(err.message, 200)}`);
      ctx.log(`  ${spec.id}: per-minute rate limit, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${ctx.attempts})`);
      await sleep(waitMs);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new FatalError("auth", `Gemini rejected the API key (HTTP ${res.status}).`, [
        "GEMINI_API_KEY is missing, expired, restricted to other APIs, or belongs to a project where the",
        "Generative Language API is disabled. The header must be `x-goog-api-key`; bearer auth returns 401.",
        "  https://aistudio.google.com/apikey",
        "",
        `API message: ${oneLine(err.message, 300)}`,
      ]);
    }

    if (res.status === 404) {
      throw new FatalError("model", `Gemini has no model named "${ctx.model}" for generateContent.`, [
        `Known Gemini image models: ${Object.keys(MODELS).join(", ")}`,
        "Pick one with --model=<name>.",
      ]);
    }

    if (res.status >= 500) {
      if (attempt >= ctx.attempts) throw new AssetError(`server error ${res.status} after ${ctx.attempts} attempts`);
      ctx.log(`  ${spec.id}: HTTP ${res.status}, retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt}/${ctx.attempts})`);
      await sleep(backoff);
      continue;
    }

    if (res.status === 400) {
      throw new FatalError("request", `Gemini rejected the request (HTTP 400) for ${ctx.model}.`, [
        "This is a request-shape problem rather than a transient one, so the run stopped instead of",
        "repeating it for every asset.",
        "",
        `API message: ${oneLine(err.message)}`,
      ]);
    }

    throw new AssetError(`HTTP ${res.status}${err.status ? ` ${err.status}` : ""}: ${oneLine(err.message, 200)}`);
  }
}

/** Pulls the inline base64 image out of a successful generateContent response. */
function readImage(bodyText: string, spec: AssetSpec): { data: Buffer; mimeType: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new AssetError("response was not JSON");
  }
  if (!isRecord(parsed)) throw new AssetError("response was not an object");

  const candidate = asArray(parsed.candidates)[0];
  if (!isRecord(candidate)) {
    const blocked = isRecord(parsed.promptFeedback) ? str(parsed.promptFeedback.blockReason) : "";
    throw new AssetError(blocked ? `prompt blocked (${blocked})` : "response contained no candidates");
  }
  const finish = str(candidate.finishReason);
  const content = isRecord(candidate.content) ? candidate.content : {};
  for (const part of asArray(content.parts)) {
    if (!isRecord(part) || !isRecord(part.inlineData)) continue;
    const data = str(part.inlineData.data);
    if (!data) continue;
    return { data: Buffer.from(data, "base64"), mimeType: str(part.inlineData.mimeType) || "image/png" };
  }
  throw new AssetError(
    finish && finish !== "STOP"
      ? `no image in the response for ${spec.id} (finishReason ${finish})`
      : `no image in the response for ${spec.id} (the model replied with text only)`
  );
}

// ── Writing files ────────────────────────────────────────────────────────────

/** What actually landed on disk, as opposed to what the spec asked for. */
interface WrittenImage {
  bytes: number;
  width: number;
  height: number;
  hasAlpha: boolean;
}

/** Green-spill thresholds for the chroma key: at or below LOW the pixel is the figure, at or above HIGH the backdrop. */
const KEY_LOW = 28;
const KEY_HIGH = 96;

/**
 * Removes the flat KEY_GREEN backdrop: alpha follows how much greener a pixel is than its red and
 * blue (a soft ramp between KEY_LOW and KEY_HIGH keeps hair and edges smooth), green spill is pulled
 * out of the edge pixels, and the result is trimmed to the figure's bounding box.
 */
export async function removeKeyGreen(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let o = 0; o < data.length; o += 4) {
    const r = data[o]!;
    const g = data[o + 1]!;
    const b = data[o + 2]!;
    const other = Math.max(r, b);
    const spill = g - other;
    const alpha = spill >= KEY_HIGH ? 0 : spill <= KEY_LOW ? 255 : Math.round((255 * (KEY_HIGH - spill)) / (KEY_HIGH - KEY_LOW));
    if (alpha > 0 && spill > 0) data[o + 1] = other; // despill: no green fringe on hair or skin
    data[o + 3] = Math.min(data[o + 3]!, alpha);
  }
  const keyed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return sharp(keyed).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 }).png().toBuffer();
}

/**
 * Normalises to the target width — WebP for photographs, PNG where the file needs alpha — and writes
 * atomically: a temp file in the destination directory, renamed only once the bytes are safely on
 * disk, so an interrupted run can never leave a half-written image that a later run would skip as
 * "already there".
 */
async function writeImage(buffer: Buffer, absFile: string, spec: AssetSpec): Promise<WrittenImage> {
  await fs.mkdir(path.dirname(absFile), { recursive: true });
  let source = spec.postprocess === "chroma" ? await removeKeyGreen(buffer) : buffer;
  if (spec.postprocess !== "chroma") {
    // Models return their own canvas (OpenAI has no 16:9): crop the centre to the exact ratio.
    const m = await sharp(source).metadata();
    const want = ASPECT_RATIO[spec.aspect];
    if (m.width && m.height && Math.abs(m.width / m.height - want) / want > 0.02) {
      const wider = m.width / m.height > want;
      const w = wider ? Math.round(m.height * want) : m.width;
      const h = wider ? m.height : Math.round(m.width / want);
      source = await sharp(source).resize(w, h, { fit: "cover", position: "centre" }).png().toBuffer();
    }
  }
  const image = sharp(source);
  const meta = await image.metadata().catch(() => {
    throw new AssetError("the returned bytes were not a decodable image");
  });
  if (!meta.width || !meta.height) throw new AssetError("the returned image had no dimensions");
  if (meta.width > spec.width) image.resize({ width: spec.width, withoutEnlargement: true });
  // resolveWithObject so the manifest can record the geometry that is really on disk: a model may
  // return a smaller image than requested (never upscaled) or ignore the aspect hint entirely.
  const out = absFile.endsWith(".webp")
    ? await image.webp({ quality: 82, effort: 5 }).toBuffer({ resolveWithObject: true })
    : await image.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });

  const tmp = `${absFile}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, out.data);
    await fs.rename(tmp, absFile);
  } catch (cause) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw cause;
  }
  return { bytes: out.data.byteLength, width: out.info.width, height: out.info.height, hasAlpha: out.info.channels === 4 };
}

// ── Side-car manifest ────────────────────────────────────────────────────────

interface ManifestEntry {
  id: string;
  kind: AssetKind;
  /** Public URL of the image. */
  file: string;
  /** The aspect the prompt asked for; the model is not guaranteed to have honoured it. */
  aspect: Aspect;
  /** The real pixel geometry of the file on disk — safe to feed straight to next/image. */
  width: number;
  height: number;
  /** True when a transparent background was requested. */
  transparent: boolean;
  /** True when the file really carries an alpha channel — `transparent` is only the request. */
  hasAlpha: boolean;
  model: string;
  prompt: string;
  bytes: number;
  generatedAt: string;
}

interface Manifest {
  generatedAt: string;
  assets: Record<string, ManifestEntry>;
}

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const MANIFEST_FILE = path.join(PUBLIC_DIR, "media", "ai", "manifest.json");

function publicUrl(relToPublic: string): string {
  return "/" + relToPublic.split(path.sep).join("/").replace(/^\/+/, "");
}

function heightFor(spec: AssetSpec): number {
  return Math.round(spec.width / ASPECT_RATIO[spec.aspect]);
}

async function readManifest(): Promise<Manifest> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(MANIFEST_FILE, "utf8"));
    if (isRecord(parsed) && isRecord(parsed.assets)) {
      return { generatedAt: str(parsed.generatedAt), assets: parsed.assets as Record<string, ManifestEntry> };
    }
  } catch {
    // No manifest yet, or an unreadable one: start a fresh index rather than fail the run.
  }
  return { generatedAt: "", assets: {} };
}

async function writeManifest(manifest: Manifest): Promise<void> {
  await fs.mkdir(path.dirname(MANIFEST_FILE), { recursive: true });
  // Keep manifest order identical to AI_ASSETS so reruns produce a minimal diff.
  const ordered: Record<string, ManifestEntry> = {};
  for (const spec of AI_ASSETS) {
    const entry = manifest.assets[spec.id];
    if (entry) ordered[spec.id] = entry;
  }
  const body = JSON.stringify({ generatedAt: new Date().toISOString(), assets: ordered }, null, 2) + "\n";
  const tmp = `${MANIFEST_FILE}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, body);
    await fs.rename(tmp, MANIFEST_FILE);
  } catch (cause) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw cause;
  }
}

// ── Social share card ────────────────────────────────────────────────────────

const OG_PHOTO = path.join(PUBLIC_DIR, "media", "ai", "social", "og-photo.webp");
const OG_FILE = path.join(PUBLIC_DIR, "og-default.png");
const OG_W = 1200;
const OG_H = 630;

/** XML-escapes a string for an SVG text node. */
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Builds public/og-default.png (the 1200×630 card shown when a page is shared) from the generated
 * photo: a navy panel fading in from the left carries the REAL logo (public/logo-mark.png) and the
 * Foundation's name and lines as SVG text, so no generated lettering ever reaches the card.
 */
export async function composeOgCard(opts: { out?: string; photo?: string; log?: (line: string) => void } = {}): Promise<boolean> {
  const log = opts.log ?? (() => undefined);
  const photoFile = opts.photo ?? OG_PHOTO;
  if (!(await exists(photoFile))) {
    log(`og card: ${publicUrl(path.relative(PUBLIC_DIR, photoFile))} not found — generate social-og-photo first.`);
    return false;
  }
  const font = "Segoe UI, Inter, Arial, Helvetica, sans-serif";
  const svg = `<svg width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#01305f" stop-opacity="0.97"/>
      <stop offset="0.46" stop-color="#004c96" stop-opacity="0.9"/>
      <stop offset="0.7" stop-color="#004c96" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#fade)"/>
  <rect y="${OG_H - 18}" width="${OG_W}" height="18" fill="#e8520a"/>
  <text x="72" y="312" font-family="${font}" font-weight="800" font-size="58" fill="#ffffff">EduSkill <tspan fill="#f4ae8c">India</tspan></text>
  <text x="72" y="380" font-family="${font}" font-weight="800" font-size="58" fill="#ffffff">Foundation</text>
  <text x="72" y="442" font-family="${font}" font-size="25" fill="#ffffff" fill-opacity="0.9">${xml("Empowering India's youth through")}</text>
  <text x="72" y="476" font-family="${font}" font-size="25" fill="#ffffff" fill-opacity="0.9">${xml("skills, education & opportunity")}</text>
  <text x="72" y="556" font-family="${font}" font-weight="700" font-size="15" letter-spacing="2.5" fill="#f4ae8c">${xml("EMPOWERING COMMUNITIES • SPREADING HOPE • CREATING CHANGE")}</text>
</svg>`;
  const logo = await sharp(path.join(PUBLIC_DIR, "logo-mark.png")).resize(124, 124, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  // A white rounded tile behind the mark, so the logo's own colours read on the navy panel.
  const tile = Buffer.from(`<svg width="148" height="148" xmlns="http://www.w3.org/2000/svg"><rect width="148" height="148" rx="28" fill="#ffffff"/></svg>`);
  const card = await sharp(photoFile)
    .resize(OG_W, OG_H, { fit: "cover", position: "right" })
    .composite([
      { input: Buffer.from(svg), left: 0, top: 0 },
      { input: tile, left: 72, top: 92 },
      { input: logo, left: 84, top: 104 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  const out = opts.out ?? OG_FILE;
  const tmp = `${out}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, card);
  await fs.rename(tmp, out);
  log(`og card → ${out.startsWith(PUBLIC_DIR) ? publicUrl(path.relative(PUBLIC_DIR, out)) : out} (${Math.round(card.byteLength / 1024)} KB)`);
  return true;
}

// ── Re-index ─────────────────────────────────────────────────────────────────

/**
 * Adds a manifest entry for every asset whose file is on disk but missing from the manifest — for
 * runs that were interrupted (the manifest is written once, at the end of a run) or that ran in
 * parallel. Reads the real geometry from the file; touches no API.
 */
export async function reindexManifest(opts: { model?: string; log?: (line: string) => void } = {}): Promise<number> {
  const log = opts.log ?? (() => undefined);
  const manifest = await readManifest();
  let added = 0;
  for (const spec of AI_ASSETS) {
    const abs = path.join(PUBLIC_DIR, spec.file);
    if (manifest.assets[spec.id] || !(await exists(abs))) continue;
    const meta = await sharp(abs).metadata();
    const stat = await fs.stat(abs);
    manifest.assets[spec.id] = {
      id: spec.id,
      kind: spec.kind,
      file: publicUrl(spec.file),
      aspect: spec.aspect,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      transparent: spec.transparent,
      hasAlpha: !!meta.hasAlpha,
      model: opts.model ?? `${DEFAULT_PROVIDER}:${DEFAULT_MODEL[DEFAULT_PROVIDER]}`,
      prompt: spec.prompt,
      bytes: stat.size,
      generatedAt: stat.mtime.toISOString(),
    };
    added++;
    log(`  indexed ${spec.id} → ${publicUrl(spec.file)}`);
  }
  if (added) await writeManifest(manifest);
  log(`${added} entr${added === 1 ? "y" : "ies"} added to the manifest.`);
  return added;
}

// ── Runner ───────────────────────────────────────────────────────────────────

export interface GenerateAiMediaOptions {
  /** Only these asset ids (see AI_ASSETS). Empty or omitted means all of them. */
  only?: readonly string[];
  /** Image provider. Default: openai. Ignored when `model` names one. */
  provider?: Provider;
  /** Image model to use. Default: gpt-image-2 (openai) / gemini-3-pro-image (gemini). */
  model?: ModelName;
  /** Regenerate assets whose file already exists. */
  force?: boolean;
  /** Print the plan and touch neither the API nor the disk. */
  dryRun?: boolean;
  /** Parallel requests. Default 2 — image models have tight per-minute limits. */
  concurrency?: number;
  /** Attempts per asset, including the first. Default 4. */
  attempts?: number;
  /** Suppress per-asset logging. */
  quiet?: boolean;
}

export interface GenerateAiMediaResult {
  generated: string[];
  skipped: string[];
  failed: { id: string; reason: string }[];
  /** How many assets the run intended to generate. */
  planned: number;
}

function resolveSelection(only: readonly string[] | undefined): AssetSpec[] {
  const ids = (only ?? []).map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return [...AI_ASSETS];
  const byId = new Map(AI_ASSETS.map((a) => [a.id, a]));
  const picked: AssetSpec[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    const spec = byId.get(id);
    if (spec) picked.push(spec);
    else unknown.push(id);
  }
  if (unknown.length > 0) {
    throw new FatalError("config", `Unknown asset id(s): ${unknown.join(", ")}`, ["Run with --dry-run to list every id."]);
  }
  return picked;
}

async function exists(file: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

/**
 * Generates every selected asset. Resolves with a per-asset summary; rejects with a FatalError when
 * the run cannot usefully continue (no image quota, rejected key, unknown model).
 */
export async function generateAiMedia(opts: GenerateAiMediaOptions = {}): Promise<GenerateAiMediaResult> {
  const provider = opts.model ? providerOf(opts.model) : (opts.provider ?? DEFAULT_PROVIDER);
  const model = opts.model ?? DEFAULT_MODEL[provider];
  const dryRun = opts.dryRun ?? false;
  const force = opts.force ?? false;
  const concurrency = Math.max(1, Math.min(8, Math.trunc(opts.concurrency ?? 2)));
  const attempts = Math.max(1, Math.min(10, Math.trunc(opts.attempts ?? 4)));
  const log = (line: string) => {
    if (!opts.quiet) console.log(line);
  };

  const selected = resolveSelection(opts.only);
  const result: GenerateAiMediaResult = { generated: [], skipped: [], failed: [], planned: 0 };

  // Work out what is missing before touching the API, so --dry-run and the real run agree.
  const pending: AssetSpec[] = [];
  for (const spec of selected) {
    if (!force && (await exists(path.join(PUBLIC_DIR, spec.file)))) {
      result.skipped.push(spec.id);
      continue;
    }
    pending.push(spec);
  }
  result.planned = pending.length;

  if (dryRun) {
    log(
      `plan: ${pending.length} asset(s) to generate, ${result.skipped.length} already on disk ` +
        `(model ${model}, concurrency ${concurrency}${force ? ", --force" : ""})`
    );
    let kind = "";
    for (const spec of pending) {
      if (spec.kind !== kind) {
        kind = spec.kind;
        log(`\n${kind}`);
      }
      log(`  ${spec.id.padEnd(34)} ${`${spec.width}x${heightFor(spec)}`.padEnd(10)} ${spec.aspect.padEnd(5)} ${publicUrl(spec.file)}`);
      log(`  ${" ".repeat(34)} ${oneLine(spec.prompt, 100)}…`);
    }
    if (result.skipped.length > 0) log(`\nskipped, file already exists (use --force): ${result.skipped.join(", ")}`);
    log(`\ndry run: no API call made, nothing written. A real run records the full prompts in ${publicUrl(path.relative(PUBLIC_DIR, MANIFEST_FILE))}.`);
    return result;
  }

  const keyName = provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
  const apiKey = process.env[keyName]?.trim();
  if (!apiKey) {
    throw new FatalError("config", `${keyName} is not set.`, [
      `Add it to .env (gitignored) as ${keyName}=… or pass it in the environment, and re-run.`,
    ]);
  }

  if (pending.length === 0) {
    log(`nothing to do: all ${result.skipped.length} selected asset(s) already exist (use --force to regenerate).`);
    return result;
  }

  log(`generating ${pending.length} asset(s) with ${model} (concurrency ${concurrency})`);
  const manifest = await readManifest();
  const ctx: RequestContext = { apiKey, model, attempts, log };
  const queue = [...pending];
  let fatal: FatalError | null = null;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (fatal) return; // Another worker hit a wall: stop pulling new work.
      const spec = queue.shift();
      if (!spec) return;
      try {
        const image = await requestImage(spec, ctx);
        const written = await writeImage(image.data, path.join(PUBLIC_DIR, spec.file), spec);
        manifest.assets[spec.id] = {
          id: spec.id,
          kind: spec.kind,
          file: publicUrl(spec.file),
          aspect: spec.aspect,
          width: written.width,
          height: written.height,
          transparent: spec.transparent,
          hasAlpha: written.hasAlpha,
          model: `${provider}:${model}`,
          prompt: spec.prompt,
          bytes: written.bytes,
          generatedAt: new Date().toISOString(),
        };
        result.generated.push(spec.id);
        const flat = spec.transparent && !written.hasAlpha ? ", opaque — asked for transparency" : "";
        log(`  ${spec.id} → ${publicUrl(spec.file)} (${written.width}x${written.height}, ${Math.round(written.bytes / 1024)} KB${flat})`);
      } catch (e: unknown) {
        if (e instanceof FatalError) {
          fatal ??= e;
          return;
        }
        const reason = e instanceof Error ? e.message : String(e);
        result.failed.push({ id: spec.id, reason });
        log(`  ${spec.id}: FAILED — ${reason}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));

  // Index whatever did land before re-throwing, so a partial run is still usable.
  if (result.generated.length > 0) await writeManifest(manifest);
  if (result.generated.includes("social-og-photo")) await composeOgCard({ log });
  if (fatal) throw fatal;

  log(
    `\n${result.generated.length} image(s) written, ${result.skipped.length} skipped, ${result.failed.length} failed.` +
      (result.generated.length > 0 ? ` Manifest: ${publicUrl(path.relative(PUBLIC_DIR, MANIFEST_FILE))}` : "")
  );
  return result;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const USAGE = `Usage: npx tsx scripts/generate-ai-media.ts [options]

  --only=<id,id>      generate just these asset ids
  --provider=<name>   openai | gemini (default ${DEFAULT_PROVIDER})
  --model=<name>      ${[...OPENAI_MODELS, ...Object.keys(MODELS)].join(" | ")}
                      (default ${DEFAULT_MODEL.openai} / ${DEFAULT_MODEL.gemini})
  --force             regenerate assets whose file already exists
  --dry-run           print the plan without calling the API or writing anything
  --concurrency=<n>   parallel requests (default 2, max 8)
  --attempts=<n>      attempts per asset including the first (default 4)
  --quiet             no per-asset logging
  --compose-og        only rebuild public/og-default.png from the existing og photo (no API call)
  --reindex           add manifest entries for images already on disk (no API call)
  --help              this message`;

function parseArgs(argv: readonly string[]): GenerateAiMediaOptions & { help?: boolean; composeOg?: boolean; reindex?: boolean } {
  const opts: GenerateAiMediaOptions & { help?: boolean; composeOg?: boolean; reindex?: boolean } = {};
  for (const arg of argv) {
    const eq = arg.indexOf("=");
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const value = eq === -1 ? "" : arg.slice(eq + 1);
    switch (flag) {
      case "--help":
      case "-h":
        opts.help = true;
        break;
      case "--force":
        opts.force = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--compose-og":
        opts.composeOg = true;
        break;
      case "--reindex":
        opts.reindex = true;
        break;
      case "--quiet":
        opts.quiet = true;
        break;
      case "--only": {
        // An empty --only= must not quietly widen to "everything": each image costs money, so a
        // typo or an unset shell variable would otherwise buy all of them.
        const ids = value.split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.length === 0) {
          throw new FatalError("config", "--only= needs at least one asset id.", ["Run with --dry-run to list every id, or omit --only to generate everything."]);
        }
        opts.only = ids;
        break;
      }
      case "--model":
        if (!Object.prototype.hasOwnProperty.call(MODELS, value) && !(OPENAI_MODELS as readonly string[]).includes(value)) {
          throw new FatalError("config", `Unknown --model=${value}`, [`Known image models: ${[...OPENAI_MODELS, ...Object.keys(MODELS)].join(", ")}`]);
        }
        opts.model = value as ModelName;
        break;
      case "--provider":
        if (value !== "openai" && value !== "gemini") throw new FatalError("config", `Unknown --provider=${value}`, ["Use openai or gemini."]);
        opts.provider = value;
        break;
      case "--concurrency":
      case "--attempts": {
        const n = Number.parseInt(value, 10);
        if (!Number.isFinite(n) || n < 1) throw new FatalError("config", `${flag} needs a positive number.`, [USAGE]);
        if (flag === "--concurrency") opts.concurrency = n;
        else opts.attempts = n;
        break;
      }
      default:
        throw new FatalError("config", `Unknown option: ${arg}`, [USAGE]);
    }
  }
  return opts;
}

/** CLI entry: runs only when this file is executed directly, not when something imports it. */
if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "generate-ai-media.ts"))) {
  (async () => {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      console.log(USAGE);
      return;
    }
    if (opts.reindex) {
      await reindexManifest({ log: console.log });
      return;
    }
    if (opts.composeOg) {
      if (!(await composeOgCard({ log: console.log }))) process.exitCode = 1;
      return;
    }
    const result = await generateAiMedia(opts);
    if (result.failed.length > 0) process.exitCode = 1;
  })().catch((e: unknown) => {
    // `process.exitCode`, not `process.exit()`: sharp's libvips threads are already loaded here and
    // tearing the loop down mid-flight trips a libuv assertion on Windows that hides this message.
    console.error(e instanceof FatalError ? e.report() : e);
    process.exitCode = 1;
  });
}
