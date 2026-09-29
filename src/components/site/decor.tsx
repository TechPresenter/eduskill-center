/**
 * Public-site decorative layer — composable, server-rendered depth for marketing sections.
 *
 * The site used to be flat alternating `bg-white` / `bg-lavender` bands. These primitives layer
 * TRANSPARENT texture ON TOP of whatever colour a section already sets, so you never have to change
 * a section's background to give it depth.
 *
 * Everything here is:
 *   - a server component (no "use client", no JS shipped to the browser),
 *   - pure inline SVG + CSS gradients (no external images, no data-URIs),
 *   - `aria-hidden` + `pointer-events-none`,
 *   - clipped to its own box, so a decorative layer can never widen the page.
 *
 * House rules for the host section:
 *   <section className="relative overflow-hidden bg-white section-y">
 *     <SectionBg variant="mesh" />
 *     <div className="container-x relative z-10">…content…</div>
 *   </section>
 *
 * `relative` on the content wrapper is enough for `SectionBg` (it is rendered before the content, so
 * the content paints on top anyway). Add `z-10` as well whenever the section also ends with a
 * `SectionDivider`: that one is rendered LAST, so without it the shape would paint over the text.
 */
import type { LucideProps } from "lucide-react";
import { IconTile as UiIconTile, type IconTileSize as UiIconTileSize, type IconTileTone as UiIconTileTone } from "@/components/ui/list";
import { cn } from "@/lib/utils";
import { BLOB_PATHS, DIVIDER_PATHS, DotPattern, GridPattern, RingArt, WaveBands, type DecorTone, type DividerVariant } from "@/components/site/decor-art";

export type { DecorTone, DividerVariant };

/* ───────────────────────────── SectionBg ───────────────────────────── */

export type SectionBgVariant = "mesh" | "blobs" | "grid" | "dots" | "rings" | "waves" | "spotlight" | "swoosh";

/*
 * The washes below are written as literal rgba(), not `var(--color-…)`. Tailwind v4 prunes @theme
 * variables nothing uses, and an inline `style` is invisible to that scan — a token referenced only
 * from here can resolve to nothing. Each stop therefore carries the hex it encodes in a comment so
 * it can still be traced back to the token it came from.
 */

/**
 * Multi-stop radial washes. Every stop ends at `transparent`, so the section's own background
 * colour still shows through — these tint it, they do not replace it.
 *
 * All three logo hues are in the mix, in roughly the logo's own proportions (blue 52.5%, orange
 * 31.5%, green 15.9%): green is the smallest, lowest-opacity stop everywhere, which is what keeps it
 * reading as an accent rather than a fourth background colour.
 */
const MESH: Record<DecorTone, string> = {
  light: [
    "radial-gradient(42rem 28rem at 6% -12%, rgba(0,76,150,0.10), transparent 70%)" /* navy #004c96 */,
    "radial-gradient(34rem 24rem at 94% 2%, rgba(232,82,10,0.09), transparent 70%)" /* orange #e8520a */,
    "radial-gradient(48rem 30rem at 52% 114%, rgba(47,138,42,0.07), transparent 70%)" /* green #2f8a2a */,
  ].join(","),
  navy: [
    // White copy sits on these. Measured against the navy band: the navy-light stop composites to
    // #0b5aa9 (6.90:1 for white) and the green stop to #0c5c7a (7.43:1), so both clear AA on their own.
    "radial-gradient(40rem 26rem at 8% -10%, rgba(11,102,184,0.55), transparent 70%)" /* navy-light #0b66b8 */,
    "radial-gradient(32rem 22rem at 92% 0%, rgba(232,82,10,0.20), transparent 70%)" /* orange #e8520a */,
    "radial-gradient(28rem 20rem at 74% 110%, rgba(47,138,42,0.26), transparent 70%)" /* green #2f8a2a */,
    "radial-gradient(46rem 28rem at 26% 112%, rgba(1,48,95,0.70), transparent 70%)" /* navy-dark #01305f */,
  ].join(","),
};

/**
 * Soft glow rising behind a centred heading, with warm and green edges below it so the band reads as
 * brand rather than grey. The two lower stops are pulled apart left/right instead of stacked at 50%,
 * which is what gives the orange and the green room to be told apart.
 */
const SPOTLIGHT: Record<DecorTone, string> = {
  light: [
    "radial-gradient(44rem 26rem at 50% -8%, rgba(0,76,150,0.14), transparent 72%)" /* navy #004c96 */,
    "radial-gradient(26rem 16rem at 32% 106%, rgba(232,82,10,0.08), transparent 72%)" /* orange #e8520a */,
    "radial-gradient(26rem 16rem at 70% 106%, rgba(47,138,42,0.08), transparent 72%)" /* green #2f8a2a */,
  ].join(","),
  navy: [
    "radial-gradient(44rem 26rem at 50% -8%, rgba(232,82,10,0.22), transparent 72%)" /* orange #e8520a */,
    "radial-gradient(30rem 18rem at 26% 106%, rgba(11,102,184,0.55), transparent 72%)" /* navy-light #0b66b8 */,
    "radial-gradient(30rem 18rem at 74% 106%, rgba(47,138,42,0.30), transparent 72%)" /* green #2f8a2a */,
  ].join(","),
};

/**
 * The logo's blue-into-green sweep, drawn as two ribbons across the section.
 *
 * This is the one decoration on the site that says "EduSkill" rather than "some brand colours": the
 * mark's swoosh runs from its blue through to its green, and nothing else here reproduces that.
 *
 * Stroked open curves rather than filled shapes — a 130px round stroke holds an even weight along
 * the whole sweep, which a hand-written closed path never manages, and it means one path instead of
 * an outbound and a return edge. `preserveAspectRatio="none"` lets the ribbon span any section
 * shape; a soft gradient band is the one kind of art that survives being stretched.
 *
 * The opacities are the accessibility budget. On a navy band the lightest composite the ribbon can
 * produce is #1f6097 (5.97:1 for white), so body copy over it still clears AA without the host
 * having to dim the layer.
 */
function SwooshArt({ tone }: { tone: DecorTone }) {
  const id = `esk-swoosh-${tone}`;
  // On light the sweep is the logo's own blue → green. On navy the band is already blue, so the
  // ribbon starts at navy-light and travels further into green-on-navy (#9dc89b) — start it at
  // #004c96 there and it vanishes into its own background.
  const stops = tone === "navy" ? ["#0b66b8", "#2f8a2a", "#9dc89b"] : ["#004c96", "#0b66b8", "#2f8a2a"];
  return (
    <svg aria-hidden="true" viewBox="0 0 1440 620" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.52" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeLinecap="round">
        <path d="M-80 560 C 250 330 520 600 800 400 C 1040 228 1250 330 1520 130" strokeWidth="130" strokeOpacity={tone === "navy" ? 0.22 : 0.11} />
        <path d="M-80 704 C 280 474 560 734 860 524 C 1100 352 1280 430 1520 268" strokeWidth="62" strokeOpacity={tone === "navy" ? 0.16 : 0.07} />
      </g>
    </svg>
  );
}

/**
 * Decorative background layer for a public section.
 *
 * Variants — pick by what the section has to say, not at random; two neighbouring sections should
 * never share a variant:
 *   "mesh"      soft multi-stop brand wash — the safe default for any long content section
 *   "blobs"     large blurred organic navy/orange/green shapes — energetic; good behind card grids
 *   "grid"      faint line grid fading at the edges — structured; good for process/steps and tables
 *   "dots"      quiet dot matrix — the least noisy; good under photography, maps or dense text
 *   "rings"     concentric outlined circles bleeding off the corners — good for a single focal block
 *   "waves"     layered wave bands along the bottom edge — use on the section BEFORE a colour change
 *   "spotlight" one soft glow under a centred heading — good for CTA and testimonial bands
 *   "swoosh"    the logo's blue→green sweep — the loudest and most specific of these, so it belongs
 *               to the hero and at most one other block per page; repeated, it stops being the mark
 *
 * `tone="navy"` switches the line work and washes to the on-navy palette (white + orange + green).
 * Pass e.g. `className="opacity-70"` to dial any variant down further.
 */
export function SectionBg({ variant = "mesh", tone = "light", className }: { variant?: SectionBgVariant; tone?: DecorTone; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}>
      {variant === "mesh" && <div className="absolute inset-0" style={{ backgroundImage: MESH[tone] }} />}
      {variant === "spotlight" && <div className="absolute inset-0" style={{ backgroundImage: SPOTLIGHT[tone] }} />}
      {variant === "swoosh" && <SwooshArt tone={tone} />}
      {variant === "grid" && <GridPattern tone={tone} />}
      {variant === "dots" && <DotPattern tone={tone} />}
      {variant === "waves" && <WaveBands tone={tone} />}
      {variant === "blobs" && (
        <>
          <div className={cn("absolute -top-24 -right-16 h-64 w-64 rounded-[46%_54%_40%_60%/50%_44%_56%_50%] blur-2xl sm:h-80 sm:w-80", tone === "navy" ? "bg-orange/25" : "bg-orange/15")} />
          <div className={cn("absolute -bottom-28 -left-20 h-72 w-72 rounded-[58%_42%_56%_44%/42%_58%_42%_58%] blur-2xl sm:h-96 sm:w-96", tone === "navy" ? "bg-navy-light/50" : "bg-navy/10")} />
          {/* The third shape is the logo's green. It used to be a neutral lavender/white glow, which
              is exactly the hue the site was missing — and it is a blurred FILL, never a text bed,
              so THE GREEN RULE is satisfied. On navy it composites to #0c5b7b: 7.43:1 for white. */}
          <div className={cn("absolute top-1/3 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl sm:h-72 sm:w-72", tone === "navy" ? "bg-green/25" : "bg-green/12")} />
        </>
      )}
      {variant === "rings" && (
        <>
          <RingArt tone={tone} className="-top-40 -right-36 size-96 sm:-top-48 sm:-right-24 sm:size-144" />
          <RingArt tone={tone} rings={3} className="-bottom-32 -left-28 size-64 sm:size-80" />
        </>
      )}
    </div>
  );
}

/* ──────────────────────────── SectionDivider ──────────────────────────── */

const DIVIDER_HEIGHT = {
  sm: "h-6 sm:h-8 lg:h-10",
  md: "h-10 sm:h-14 lg:h-20",
  lg: "h-14 sm:h-20 lg:h-28",
} as const;

/**
 * SVG shape divider for the seam between two sections.
 *
 * Put it as the LAST child of section A and colour it with section B's colour, either by setting the
 * text colour (`className="text-lavender"`, the shape inherits via `currentColor`) or with `fill`.
 * `flip` mirrors it and hangs it off the TOP of the section instead of the bottom.
 *
 *   wave  — soft double-curve, the friendliest transition
 *   slant — straight diagonal, sharper and more editorial
 *   curve — one wide arch that funnels the eye into the next heading
 *
 * It overlays the section's bottom edge, so give the section room: the divider is up to 7rem tall at
 * `height="lg"`, and the content wrapper wants `relative z-10` so short sections cannot be sliced.
 */
export function SectionDivider({
  variant = "wave",
  flip,
  fill,
  height = "md",
  className,
}: {
  variant?: DividerVariant;
  flip?: boolean;
  fill?: string;
  height?: keyof typeof DIVIDER_HEIGHT;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-0 w-full overflow-hidden leading-0", flip && "top-0 bottom-auto", className)}>
      <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className={cn("block w-full", DIVIDER_HEIGHT[height], flip && "-scale-y-100")} xmlns="http://www.w3.org/2000/svg">
        <path d={DIVIDER_PATHS[variant]} fill={fill ?? "currentColor"} />
      </svg>
    </div>
  );
}

/* ────────────────────────────── Accents ────────────────────────────── */

const ORB_TONE = {
  navy: "bg-navy/15",
  "navy-light": "bg-navy-light/25",
  orange: "bg-orange/20",
  /** The logo's third hue. A blurred fill, so THE GREEN RULE's "no text on flat green" never applies. */
  green: "bg-green/20",
  lavender: "bg-lavender/80",
  white: "bg-white/15",
} as const;

const ORB_SIZE = {
  sm: "h-24 w-24",
  md: "h-40 w-40",
  lg: "h-64 w-64",
  xl: "h-80 w-80 sm:h-96 sm:w-96",
} as const;

/**
 * A blurred circular glow. Drop it near a heading or behind a card cluster for a lift that costs
 * nothing. Positioning is yours: it renders `absolute`, so the parent needs
 * `relative overflow-hidden`. `float` opts into the shared 5s drift (neutralised by reduced motion).
 *
 *   <GlowOrb tone="orange" size="lg" className="-top-16 -right-10" />
 */
export function GlowOrb({
  tone = "orange",
  size = "md",
  float,
  className,
}: {
  tone?: keyof typeof ORB_TONE;
  size?: keyof typeof ORB_SIZE;
  float?: boolean;
  className?: string;
}) {
  return <span aria-hidden="true" className={cn("pointer-events-none absolute rounded-full blur-3xl", ORB_SIZE[size], ORB_TONE[tone], float && "animate-float motion-reduce:animate-none", className)} />;
}

/*
 * SVG `stop-color` cannot take a Tailwind class, so these are hex — and being hex, they are the one
 * place a retired palette survives a repaint unnoticed. `navy` was two shades of the old #12357A and
 * is now the logo blue; if the tokens move again, they have to move here too.
 */
const BLOB_FILL = {
  navy: ["#0b66b8", "#004c96"] /* navy-light → navy */,
  orange: ["#f2761f", "#e8520a"],
  /** green → green-dark. A decorative fill only: #2f8a2a is 4.38 on white, so nothing legible sits ON it. */
  green: ["#2f8a2a", "#1f6b1c"],
  /** The logo's own sweep, blue into green — the pairing that reads as EduSkill and not just "brand". */
  brand: ["#004c96", "#2f8a2a"],
  lavender: ["#e8eaf6", "#dbe3f5"],
  white: ["#ffffff", "#dbe3f5"],
} as const;

const BLOB_SIZE = {
  sm: "h-24 w-24",
  md: "h-40 w-40",
  lg: "h-56 w-56 sm:h-72 sm:w-72",
  xl: "h-72 w-72 sm:h-96 sm:w-96",
} as const;

/**
 * An organic gradient shape — more character than a `GlowOrb`, still fully decorative. Three shapes
 * (`shape={1|2|3}`) so repeated use on one page does not read as a stamp. `opacity` defaults low
 * enough to sit behind text; raise it only outside text areas.
 *
 * `tone="brand"` is the logo's blue→green sweep in blob form — the quiet way to get the mark's
 * gradient onto a page that already has a `SectionBg variant="swoosh"` elsewhere.
 *
 *   <Blob tone="navy" shape={2} size="lg" className="-bottom-10 -left-12" />
 */
export function Blob({
  tone = "navy",
  shape = 1,
  size = "md",
  opacity,
  soft = true,
  float,
  className,
}: {
  tone?: keyof typeof BLOB_FILL;
  shape?: 1 | 2 | 3;
  size?: keyof typeof BLOB_SIZE;
  opacity?: number;
  /** Blur the shape (default) — turn off for a crisp graphic edge. */
  soft?: boolean;
  float?: boolean;
  className?: string;
}) {
  const [from, to] = BLOB_FILL[tone];
  const id = `esk-blob-${tone}-${shape}`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      className={cn("pointer-events-none absolute", BLOB_SIZE[size], soft && "blur-xl", float && "animate-float motion-reduce:animate-none", className)}
      style={{ opacity: opacity ?? (tone === "lavender" || tone === "white" ? 0.7 : 0.18) }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d={BLOB_PATHS[shape - 1]} fill={`url(#${id})`} />
    </svg>
  );
}

/* ────────────────────────────── IconTile ────────────────────────────── */

/*
 * The site's IconTile IS the app's IconTile (src/components/ui/list.tsx) — one icon container for the
 * whole product. This wrapper only keeps the public site's historical API: its size steps sit one
 * step larger than the portal's (sm 40 · md 48 · lg 56) and its "navy" tone is the solid brand tile.
 */
const SITE_TILE_TONE = {
  navy: "navy-solid",
  orange: "orange",
  /** Soft green tile — see SITE_TILE_OVERRIDE for why it borrows lavender's slot. */
  green: "lavender",
  /** Solid green mark, the green counterpart of `navy`. */
  "green-solid": "navy-solid",
  lavender: "lavender",
  /** On navy sections. */
  white: "white",
  /** Quietest option: outline only. */
  outline: "outline",
} as const satisfies Record<string, UiIconTileTone>;

/*
 * Green is a PUBLIC-SITE brand hue, not a product status, so `ui/list.tsx`'s IconTile has no green
 * tone and this wrapper must not grow one there — a `green` status tone would be read as `success`
 * all over the admin. Instead the two green tiles borrow the nearest existing tone's slot and
 * repaint it through `className`: IconTile passes `className` after its own tone classes, and
 * tailwind-merge drops the bg/text they replace. The caller's `className` still lands last, so a
 * call site can override either of them.
 *
 * `green` is the soft tile: green-dark on green-light measures 5.89, legible even at the sm step.
 * `green-solid` is the emphasised mark, and the one place a flat `bg-green` is right — a white
 * lucide glyph is a GRAPHIC, which needs 3:1, and 4.38 clears that comfortably. A LABEL on flat
 * green would not, which is what THE GREEN RULE is about.
 */
const SITE_TILE_OVERRIDE: Partial<Record<keyof typeof SITE_TILE_TONE, string>> = {
  green: "bg-green-light text-green-dark",
  "green-solid": "bg-green text-white",
};

const SITE_TILE_SIZE = { sm: "md", md: "lg", lg: "xl" } as const satisfies Record<string, UiIconTileSize>;

/**
 * Rounded-square tinted tile holding an icon — the standard mark for feature rows, step lists and
 * "why us" cards. `icon` takes a lucide component, a lucide name from the CMS catalog or a short
 * emoji. Decorative by default; pass `label` when the tile alone conveys the meaning.
 *
 * Tones: `navy` and `green-solid` are the two solid marks, `orange`, `green` and `lavender` the soft
 * tints, `white` for navy sections, `outline` the quietest. A row of tiles that alternates all three
 * brand hues is how the logo's proportions show up in a feature grid.
 */
export function IconTile({
  icon,
  tone = "orange",
  size = "md",
  label,
  className,
}: {
  icon: React.ComponentType<LucideProps> | string;
  tone?: keyof typeof SITE_TILE_TONE;
  size?: keyof typeof SITE_TILE_SIZE;
  label?: string;
  className?: string;
}) {
  return <UiIconTile icon={icon} tone={SITE_TILE_TONE[tone]} size={SITE_TILE_SIZE[size]} label={label} className={cn(SITE_TILE_OVERRIDE[tone], className)} />;
}
