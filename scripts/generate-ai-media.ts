/**
 * Generates the site's brand artwork with the Gemini image models: the homepage hero, one
 * illustration per Foundation program, one per public section, abstract blobs/textures for
 * section backgrounds and flat icon-style marks.
 *
 * Everything is original generated vector-style art in the EduSkill palette — no stock
 * photography and no pictures of real people. Files land in public/media/ai/ and are indexed in
 * public/media/ai/manifest.json (id → file, model, prompt) so the site can reference them and a
 * rerun is reproducible.
 *
 *   npx tsx scripts/generate-ai-media.ts --dry-run             # list what would be generated
 *   npx tsx scripts/generate-ai-media.ts                       # generate everything missing
 *   npx tsx scripts/generate-ai-media.ts --only=home-hero      # just one asset (comma separated)
 *   npx tsx scripts/generate-ai-media.ts --force               # regenerate files that exist
 *   npx tsx scripts/generate-ai-media.ts --model=gemini-3.1-flash-image --concurrency=3
 *
 * Needs GEMINI_API_KEY in .env (never committed). Gemini IMAGE models are a paid feature: on a
 * project without billing the API answers 429 "limit: 0" and this script stops with instructions
 * instead of retrying. Text-only Gemini models are unaffected by that quota.
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

type ModelName = keyof typeof MODELS;

const DEFAULT_MODEL: ModelName = "gemini-3-pro-image";
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
  "Style: flat modern vector illustration in a clean editorial style suited to a non-profit website. " +
  "Simple geometric shapes, clear silhouettes, generous negative space, flat fills with at most a soft " +
  "two-stop gradient between brand colours, optional thin uniform line accents, no visible brush texture.";

const PALETTE =
  "Colour: use only the EduSkill India Foundation palette — deep navy #12357A, darker navy #102F70, " +
  "vivid orange #E8520A as the single accent (about 10-15% of the artwork), soft lavender #E8EAF6, " +
  "off-white #F8F8FC and pure white. No other hues, no neon, no muddy shading.";

const PEOPLE =
  "People: young Indian learners and local trainers shown as capable, focused and dignified — a natural mix of " +
  "young women and men, contemporary everyday Indian clothing (kurta, salwar kameez with dupatta, shirt and " +
  "trousers, simple saree), varied heights and body types, simple friendly faces. Equipment is current and " +
  "working. Avoid poverty, pity or charity tropes; no torn clothing, dirt, begging or slum imagery; no religious " +
  "or caste markers; no foreign saviour or visitor figures; no folk-art or tribal-costume pastiche; not a " +
  "Western classroom cliche.";

const GUARD =
  "Do not render any text, letters, numerals, signage, watermarks, logos or brand marks. Not photorealistic, " +
  "not a 3D render, not a stock photo, no sketchy pencil texture, no decorative frame or border.";

function safeArea(aspect: Aspect): string {
  return `Format: composed for a ${aspect} crop with the subject centred and clear margins on all four sides.`;
}

/** Prompt for an illustration that contains people. */
function illustration(subject: string, composition: string, aspect: Aspect): string {
  return [subject, composition, STYLE, PALETTE, PEOPLE, GUARD, safeArea(aspect)].join(" ");
}

/** Prompt for an illustration with no people in it (maps, objects, scenes). */
function sceneOnly(subject: string, composition: string, aspect: Aspect): string {
  return [subject, composition, STYLE, PALETTE, GUARD, safeArea(aspect)].join(" ");
}

/** Prompt for an abstract background shape or texture on a transparent canvas. */
function abstractShape(subject: string, composition: string, aspect: Aspect): string {
  return [
    subject,
    composition,
    "Style: flat abstract vector background element, soft organic geometry, no subject matter, no people, no objects.",
    PALETTE,
    "Background: fully transparent PNG outside the shape — no white card, no backdrop, no drop shadow.",
    GUARD,
    `Format: ${aspect} canvas with the shape bleeding confidently into the frame.`,
  ].join(" ");
}

/** Prompt for a single flat pictogram mark. */
function iconMark(subject: string): string {
  return [
    `A single centred icon-style pictogram: ${subject}.`,
    "Style: flat 2D vector pictogram, thick uniform strokes with rounded caps and joins, geometric and symmetrical, " +
      "readable at 48px, one idea only, no scene, no facial features, no perspective, no gradient, no shadow, " +
      "no enclosing circle or badge.",
    "Colour: deep navy #12357A shapes with exactly one vivid orange #E8520A accent detail. No other colours.",
    "Background: fully transparent PNG with even padding around the mark, roughly 10% of the canvas on each side.",
    GUARD,
    "Format: 1:1 square canvas.",
  ].join(" ");
}

// ── Asset manifest ───────────────────────────────────────────────────────────

type AssetKind = "hero" | "program" | "section" | "blob" | "icon";

interface AssetSpec {
  /** Stable id, also the `--only=` selector and the manifest key. */
  id: string;
  kind: AssetKind;
  /** Output path relative to public/. */
  file: string;
  aspect: Aspect;
  /** Target width in px; the returned image is downscaled to this if larger, never upscaled. */
  width: number;
  /** True when the art is meant to sit on a page background with its own alpha. */
  transparent: boolean;
  prompt: string;
}

function program(slug: string, subject: string, composition: string): AssetSpec {
  return {
    id: `program-${slug}`,
    kind: "program",
    file: `media/ai/programs/${slug}.png`,
    aspect: "4:3",
    width: 1200,
    transparent: false,
    prompt: illustration(subject, composition, "4:3"),
  };
}

function section(id: string, aspect: Aspect, width: number, prompt: string, transparent = false): AssetSpec {
  return { id: `section-${id}`, kind: "section", file: `media/ai/sections/${id}.png`, aspect, width, transparent, prompt };
}

function blob(id: string, aspect: Aspect, width: number, subject: string, composition: string): AssetSpec {
  return {
    id: `blob-${id}`,
    kind: "blob",
    file: `media/ai/blobs/${id}.png`,
    aspect,
    width,
    transparent: true,
    prompt: abstractShape(subject, composition, aspect),
  };
}

function icon(id: string, subject: string): AssetSpec {
  return { id: `icon-${id}`, kind: "icon", file: `media/ai/icons/${id}.png`, aspect: "1:1", width: 512, transparent: true, prompt: iconMark(subject) };
}

/**
 * Every asset the site needs. Program ids follow the seeded program slugs
 * (prisma/seed-data/content.ts → PROGRAMS); section ids follow the public sections registered in
 * src/lib/cms/sections.ts → CMS_SECTIONS.
 */
export const AI_ASSETS: readonly AssetSpec[] = [
  // ── Hero ───────────────────────────────────────────────────────────────────
  {
    id: "home-hero",
    kind: "hero",
    file: "media/ai/hero/home-hero.png",
    aspect: "3:2",
    width: 1800,
    transparent: false,
    prompt: illustration(
      "The homepage hero illustration for an Indian skill-development foundation: four young learners around a shared " +
        "table in a bright block-level training centre, one at an open laptop, one writing in a notebook, one holding a " +
        "smartphone, and a young woman trainer standing beside them explaining something with an open hand.",
      "Composition: horizontal, learners grouped slightly right of centre, calm off-white and lavender room with a large " +
        "window, a few flat potted plants, deep navy as the dominant structural colour and orange reserved for one chair, " +
        "the trainer's dupatta and one small accent shape; the left third stays quiet and uncluttered so a headline can sit over it.",
      "3:2"
    ),
  },
  {
    id: "home-hero-portrait",
    kind: "hero",
    file: "media/ai/hero/home-hero-portrait.png",
    aspect: "4:5",
    width: 1080,
    transparent: false,
    prompt: illustration(
      "Phone-shaped hero illustration for an Indian skill-development foundation: a single young woman learner seated at a " +
        "laptop in a bright training centre, looking up with quiet confidence, a trainer's hand pointing at her screen from " +
        "the edge of the frame.",
      "Composition: vertical, subject centred and cropped at the waist, simple lavender wall behind her, deep navy furniture, " +
        "one orange accent on her kurta sleeve, plenty of clean space at the top of the frame.",
      "4:5"
    ),
  },

  // ── One illustration per Foundation program ─────────────────────────────────
  program(
    "digital-literacy",
    "Digital literacy training: two adult first-time learners sharing one laptop while a young trainer guides the trackpad, " +
      "with a large friendly interface panel floating behind them built from simple flat shapes instead of text.",
    "Composition: three-quarter view, learners on the left, floating interface panel on the right, lavender backdrop."
  ),
  program(
    "computer-education",
    "Computer education class: a short row of desktop computers on a clean navy desk with two learners typing and a trainer " +
      "checking progress over a shoulder, flat abstract spreadsheet and folder shapes floating above the screens.",
    "Composition: side-on view of the desk, repeated monitors giving rhythm, orange used only on one keyboard accent and one floating shape."
  ),
  program(
    "skill-development",
    "Certified short-course skill development: a young man and a young woman in simple navy workshop aprons holding a " +
      "measuring tool and a tablet, with an abstract flat certificate and rosette rising between them.",
    "Composition: symmetrical pair turned towards each other, certificate shape centred, off-white floor and lavender wall."
  ),
  program(
    "vocational-training",
    "Vocational trades training: a workbench scene with a young woman stitching at a working sewing machine, a young man " +
      "testing a small electrical circuit board, and hand tools arranged neatly on a navy pegboard.",
    "Composition: two working stations side by side, tools drawn as clean flat silhouettes, orange on one spool of thread and one cable."
  ),
  program(
    "career-development",
    "Career readiness coaching: a young woman practising an interview across a small table from a calm mentor, an abstract " +
      "flat speech bubble and checklist floating above them, and a folded resume drawn as a plain blank sheet.",
    "Composition: two seated figures in profile, mentor on the right, lavender panel behind, orange on the mentor's chair."
  ),
  program(
    "entrepreneurship",
    "Micro-enterprise training: a young woman standing proudly behind a small tidy shop counter with stacked goods drawn as " +
      "simple flat blocks, and a young man beside her holding a phone showing an abstract rising chart shape.",
    "Composition: shopfront framed by a navy awning, warm off-white ground, orange on the awning stripe and the chart line."
  ),
  program(
    "women-empowerment",
    "A women-led training batch: five young women of different ages seated in a relaxed semicircle with notebooks and a " +
      "laptop, one standing to speak while the others listen, and a woman trainer among them as an equal.",
    "Composition: gentle arc of figures seen from slightly above, lavender floor circle beneath them, orange on two dupattas."
  ),
  program(
    "youth-empowerment",
    "Youth leadership and life-skills session: four students of about eighteen sitting on simple stools in a circle in an open " +
      "community hall, one sketching a plan on a blank flat flip chart, all of them leaning in.",
    "Composition: circle seen from a slight three-quarter angle, tall navy windows behind, orange on the flip-chart legs."
  ),
  program(
    "rural-skill-development",
    "Rural and agri-allied skills at a block-level centre: a young woman checking a rooftop solar panel with a handheld meter " +
      "while a young man kneels beside a drip-irrigation line, with young crop rows behind them.",
    "Composition: wide horizontal landscape, low horizon, flat fields in navy and lavender tones, a single orange sun disc high right."
  ),
  program(
    "other-foundation-programs",
    "A community awareness and scholarship drive: three volunteers at a simple outdoor table helping two young people fill in " +
      "blank flat forms, with a small group of simplified figures waiting patiently in an orderly line.",
    "Composition: horizontal, table on the left, queue receding to the right, navy canopy overhead, one orange bunting triangle."
  ),

  // ── Section illustrations ──────────────────────────────────────────────────
  section(
    "about-intro",
    "4:3",
    1200,
    illustration(
      "An 'about the Foundation' vignette: a small training centre building drawn as a clean flat block with an open door, a " +
        "trainer welcoming two learners in, and three abstract cards floating beside the building for learning, community and work.",
      "Composition: building left of centre, floating cards stacked to the right, lavender sky, orange on the door frame only.",
      "4:3"
    )
  ),
  section(
    "center-finder",
    "4:3",
    1200,
    sceneOnly(
      "A deliberately simplified decorative locator graphic of India, dotted with a scattering of rounded location pins " +
        "gathered into small clusters, and a flat magnifying glass overlapping its lower right.",
      "Composition: the country drawn as one solid navy silhouette with no internal borders or state lines, lavender halo " +
        "behind it, pins in white with orange tips, magnifying glass as an orange outline.",
      "4:3"
    )
  ),
  section(
    "admission-process",
    "16:9",
    1600,
    sceneOnly(
      "A four-step admission journey shown as four connected rounded cards along a gentle path: a blank form sheet, a " +
        "document-check clipboard, a payment card beside an abstract coin stack, and an ID card with a rosette.",
      "Composition: horizontal left-to-right path, evenly spaced cards, dashed navy connector line, each card off-white on " +
        "lavender with one orange detail.",
      "16:9"
    )
  ),
  section(
    "fees-scholarship",
    "4:3",
    1200,
    illustration(
      "Fee support and scholarships: a young woman learner receiving a simple folded scholarship letter across a counter from " +
        "a Foundation staff member, with an abstract flat coin stack and a shield-shaped support badge beside them.",
      "Composition: two figures across a navy counter, badge and coins floating lower right, off-white backdrop, orange on the letter seal.",
      "4:3"
    )
  ),
  section(
    "why-eduskill",
    "4:3",
    1200,
    sceneOnly(
      "Four qualities of the Foundation as a neat flat collage: a shield with a tick for verified centres, a rounded " +
        "certificate with a rosette, a cluster of location pins for nationwide reach, and two overlapping speech bubbles for " +
        "local-language support.",
      "Composition: loose two-by-two arrangement on a lavender field, each object off-white and navy with a single orange " +
        "accent and a soft round shadow beneath it.",
      "4:3"
    )
  ),
  section(
    "impact",
    "16:9",
    1600,
    sceneOnly(
      "An abstract impact banner: a rising arrangement of rounded bars and dots suggesting growth, overlaid on a very " +
        "simplified navy silhouette of India, with a ring of small dots orbiting the tallest bar.",
      "Composition: horizontal, artwork weighted to the right so figures can sit on the left, no axes, no labels, no scale " +
        "marks, orange only on the tallest bar and the orbiting dots.",
      "16:9"
    )
  ),
  section(
    "success-stories",
    "4:3",
    1200,
    illustration(
      "Alumni success: three separate rounded portrait cards, each holding a different young Indian graduate from the " +
        "shoulders up — one in a workshop apron, one in office clothes, one in a shop coat — each card carrying a small flat rosette.",
      "Composition: three overlapping cards fanned across the frame, off-white cards on a lavender field, orange on the rosettes only.",
      "4:3"
    )
  ),
  section(
    "cta-band",
    "21:9",
    1920,
    illustration(
      "A wide call-to-action band: a confident young learner stepping forward with a notebook on the right of the frame, an " +
        "open doorway shape of light behind her, and soft abstract arcs sweeping to the left.",
      "Composition: ultra-wide, figure anchored in the right third, the left two-thirds intentionally almost empty deep navy " +
        "for a headline, arcs in low-opacity lavender with one orange arc.",
      "21:9"
    )
  ),
  section(
    "about-page",
    "16:9",
    1600,
    illustration(
      "The Foundation's way of working as one connected picture: a block-level centre building, a volunteer trainer walking " +
        "towards it, two learners arriving by bicycle, and a simplified route line linking three small centre markers along the top.",
      "Composition: horizontal storytelling strip, building right of centre, figures mid-ground, marker line along the upper " +
        "edge, lavender sky, orange on the bicycle frame and one marker.",
      "16:9"
    )
  ),
  section(
    "become-trainer",
    "4:3",
    1200,
    illustration(
      "Becoming a volunteer trainer: a young man trainer beside a simple flat whiteboard of abstract diagram shapes, turning to " +
        "greet an approaching applicant who carries a folder, with an ID card on a lanyard floating beside them.",
      "Composition: trainer on the left, applicant entering from the right, whiteboard behind, off-white room, orange on the lanyard.",
      "4:3"
    )
  ),
  section(
    "scholarship-page",
    "4:3",
    1200,
    illustration(
      "Scholarship support: a young woman learner at a desk with an open book and a laptop, and an abstract flat " +
        "shield-and-rosette support emblem rising behind her shoulder in a soft lavender glow.",
      "Composition: single seated figure left of centre, emblem upper right, deep navy desk, orange on the rosette ribbon.",
      "4:3"
    )
  ),
  section(
    "donate",
    "4:3",
    1200,
    sceneOnly(
      "Giving to the Foundation: two cupped hands drawn as clean flat shapes lifting a small rounded heart, with an abstract " +
        "coin stack and a simple certificate beside them showing where a donation goes.",
      "Composition: hands centred and low, heart above them, supporting objects flanking the base, lavender radial backdrop, heart in orange.",
      "4:3"
    )
  ),
  section(
    "footer-pattern",
    "21:9",
    1920,
    abstractShape(
      "A wide decorative footer pattern: a field of small rounded dots and thin arcs thinning out towards the top of the frame, " +
        "with two large soft overlapping blobs anchored in the bottom corners.",
      "Composition: ultra-wide, density concentrated along the bottom edge so page content stays legible above it, low contrast " +
        "throughout, at most one orange arc.",
      "21:9"
    ),
    // abstractShape() asks for a transparent canvas, so this section overlays the navy footer.
    true
  ),

  // ── Abstract blobs and textures ────────────────────────────────────────────
  blob(
    "navy-soft",
    "1:1",
    1200,
    "A single large soft organic blob with gently uneven rounded edges.",
    "Composition: the blob fills most of the canvas, deep navy #12357A core easing into darker navy #102F70 at one edge, faint lavender rim light."
  ),
  blob(
    "orange-soft",
    "1:1",
    1200,
    "A single medium soft organic blob with a relaxed, slightly asymmetric outline.",
    "Composition: blob centred with a clear transparent margin, vivid orange #E8520A core fading to a paler tint at the lower edge."
  ),
  blob(
    "lavender-soft",
    "1:1",
    1200,
    "A very soft, low-contrast organic blob meant to sit behind a card as a quiet backdrop.",
    "Composition: wide flat blob, soft lavender #E8EAF6 throughout with an off-white #F8F8FC centre, almost no internal detail."
  ),
  blob(
    "dots-lavender",
    "1:1",
    1200,
    "A seamless-looking dot texture: a regular grid of small evenly spaced circles.",
    "Composition: even coverage edge to edge, uniform dot size, soft lavender #E8EAF6 dots only, no clustering, no gradient, no vignette."
  ),
  blob(
    "grid-navy",
    "1:1",
    1200,
    "A fine technical grid texture of thin straight horizontal and vertical lines.",
    "Composition: even coverage edge to edge, hairline deep navy #12357A strokes at low opacity, perfectly regular spacing, no perspective."
  ),
  blob(
    "wave-divider",
    "21:9",
    1920,
    "A single smooth wave divider band with one long crest and one long trough.",
    "Composition: ultra-wide, the wave spans the full width and fills the lower half, deep navy #12357A with a thin orange #E8520A crest line."
  ),

  // ── Icon-style marks ───────────────────────────────────────────────────────
  icon("training-center", "a simple building with a wide doorway and a pitched roof, standing for a local training centre"),
  icon("volunteer-trainer", "a standing person shape beside an upright teaching board"),
  icon("certificate", "a rounded document with a rosette and two ribbon tails"),
  icon("scholarship", "an open book with a small shield resting on it"),
  icon("batch-calendar", "a calendar page with a grid of squares and one highlighted day"),
  icon("placement", "a simple briefcase with a small upward arrow leaving its top edge"),
  icon("digital-skills", "an open laptop seen head-on with a rounded cursor arrow on the screen"),
  icon("community", "three overlapping rounded person shapes standing shoulder to shoulder"),
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

/** POSTs one prompt and returns the decoded image bytes, retrying only where retrying can help. */
async function requestImage(spec: AssetSpec, ctx: RequestContext): Promise<{ data: Buffer; mimeType: string }> {
  const caps = MODELS[ctx.model];
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
        `Known image models: ${Object.keys(MODELS).join(", ")}`,
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

/**
 * Normalises to PNG at the target width and writes atomically: a temp file in the destination
 * directory, renamed only once the bytes are safely on disk, so an interrupted run can never leave
 * a half-written image that a later run would skip as "already there".
 */
async function writeImage(buffer: Buffer, absFile: string, spec: AssetSpec): Promise<WrittenImage> {
  await fs.mkdir(path.dirname(absFile), { recursive: true });
  const image = sharp(buffer);
  const meta = await image.metadata().catch(() => {
    throw new AssetError("the returned bytes were not a decodable image");
  });
  if (!meta.width || !meta.height) throw new AssetError("the returned image had no dimensions");
  if (meta.width > spec.width) image.resize({ width: spec.width, withoutEnlargement: true });
  // resolveWithObject so the manifest can record the geometry that is really on disk: a model may
  // return a smaller image than requested (never upscaled) or ignore the aspect hint entirely.
  const png = await image.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });

  const tmp = `${absFile}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, png.data);
    await fs.rename(tmp, absFile);
  } catch (cause) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw cause;
  }
  return { bytes: png.data.byteLength, width: png.info.width, height: png.info.height, hasAlpha: png.info.channels === 4 };
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
  /** True when the PNG really carries an alpha channel — `transparent` is only the request. */
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

// ── Runner ───────────────────────────────────────────────────────────────────

export interface GenerateAiMediaOptions {
  /** Only these asset ids (see AI_ASSETS). Empty or omitted means all of them. */
  only?: readonly string[];
  /** Image model to use. Default: gemini-3-pro-image. */
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
  const model = opts.model ?? DEFAULT_MODEL;
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

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new FatalError("config", "GEMINI_API_KEY is not set.", [
      "Add it to .env (gitignored) as GEMINI_API_KEY=… and re-run.",
      "Keys are issued at https://aistudio.google.com/apikey.",
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
          model,
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
  --model=<name>      ${Object.keys(MODELS).join(" | ")}
                      (default ${DEFAULT_MODEL})
  --force             regenerate assets whose file already exists
  --dry-run           print the plan without calling the API or writing anything
  --concurrency=<n>   parallel requests (default 2, max 8)
  --attempts=<n>      attempts per asset including the first (default 4)
  --quiet             no per-asset logging
  --help              this message`;

function parseArgs(argv: readonly string[]): GenerateAiMediaOptions & { help?: boolean } {
  const opts: GenerateAiMediaOptions & { help?: boolean } = {};
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
      case "--quiet":
        opts.quiet = true;
        break;
      case "--only": {
        // An empty --only= must not quietly widen to "everything": each image costs money, so a
        // typo or an unset shell variable would otherwise buy all 39.
        const ids = value.split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.length === 0) {
          throw new FatalError("config", "--only= needs at least one asset id.", ["Run with --dry-run to list every id, or omit --only to generate everything."]);
        }
        opts.only = ids;
        break;
      }
      case "--model":
        if (!Object.prototype.hasOwnProperty.call(MODELS, value)) {
          throw new FatalError("config", `Unknown --model=${value}`, [`Known image models: ${Object.keys(MODELS).join(", ")}`]);
        }
        opts.model = value as ModelName;
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
    const result = await generateAiMedia(opts);
    if (result.failed.length > 0) process.exitCode = 1;
  })().catch((e: unknown) => {
    // `process.exitCode`, not `process.exit()`: sharp's libvips threads are already loaded here and
    // tearing the loop down mid-flight trips a libuv assertion on Windows that hides this message.
    console.error(e instanceof FatalError ? e.report() : e);
    process.exitCode = 1;
  });
}
