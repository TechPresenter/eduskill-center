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

export type SectionBgVariant = "mesh" | "blobs" | "grid" | "dots" | "rings" | "waves" | "spotlight";

/**
 * Multi-stop radial washes. Every stop ends at `transparent`, so the section's own background
 * colour still shows through — these tint it, they do not replace it.
 */
const MESH: Record<DecorTone, string> = {
  light: [
    "radial-gradient(42rem 28rem at 6% -12%, rgba(18,53,122,0.10), transparent 70%)",
    "radial-gradient(34rem 24rem at 94% 2%, rgba(232,82,10,0.09), transparent 70%)",
    "radial-gradient(48rem 30rem at 52% 114%, rgba(18,53,122,0.07), transparent 70%)",
  ].join(","),
  navy: [
    "radial-gradient(40rem 26rem at 8% -10%, rgba(29,74,163,0.55), transparent 70%)",
    "radial-gradient(32rem 22rem at 92% 0%, rgba(232,82,10,0.20), transparent 70%)",
    "radial-gradient(46rem 28rem at 50% 112%, rgba(16,47,112,0.70), transparent 70%)",
  ].join(","),
};

/** Single soft glow rising behind a centred heading, with a warm edge so it reads as brand, not grey. */
const SPOTLIGHT: Record<DecorTone, string> = {
  light: ["radial-gradient(44rem 26rem at 50% -8%, rgba(18,53,122,0.14), transparent 72%)", "radial-gradient(26rem 16rem at 50% 106%, rgba(232,82,10,0.08), transparent 72%)"].join(","),
  navy: ["radial-gradient(44rem 26rem at 50% -8%, rgba(232,82,10,0.22), transparent 72%)", "radial-gradient(30rem 18rem at 50% 106%, rgba(29,74,163,0.55), transparent 72%)"].join(","),
};

/**
 * Decorative background layer for a public section.
 *
 * Variants — pick by what the section has to say, not at random; two neighbouring sections should
 * never share a variant:
 *   "mesh"      soft multi-stop brand wash — the safe default for any long content section
 *   "blobs"     large blurred organic navy/orange/lavender shapes — energetic; good behind card grids
 *   "grid"      faint line grid fading at the edges — structured; good for process/steps and tables
 *   "dots"      quiet dot matrix — the least noisy; good under photography, maps or dense text
 *   "rings"     concentric outlined circles bleeding off the corners — good for a single focal block
 *   "waves"     layered wave bands along the bottom edge — use on the section BEFORE a colour change
 *   "spotlight" one soft glow under a centred heading — good for CTA and testimonial bands
 *
 * `tone="navy"` switches the line work and washes to the on-navy palette (white + orange).
 * Pass e.g. `className="opacity-70"` to dial any variant down further.
 */
export function SectionBg({ variant = "mesh", tone = "light", className }: { variant?: SectionBgVariant; tone?: DecorTone; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}>
      {variant === "mesh" && <div className="absolute inset-0" style={{ backgroundImage: MESH[tone] }} />}
      {variant === "spotlight" && <div className="absolute inset-0" style={{ backgroundImage: SPOTLIGHT[tone] }} />}
      {variant === "grid" && <GridPattern tone={tone} />}
      {variant === "dots" && <DotPattern tone={tone} />}
      {variant === "waves" && <WaveBands tone={tone} />}
      {variant === "blobs" && (
        <>
          <div className={cn("absolute -top-24 -right-16 h-64 w-64 rounded-[46%_54%_40%_60%/50%_44%_56%_50%] blur-2xl sm:h-80 sm:w-80", tone === "navy" ? "bg-orange/25" : "bg-orange/15")} />
          <div className={cn("absolute -bottom-28 -left-20 h-72 w-72 rounded-[58%_42%_56%_44%/42%_58%_42%_58%] blur-2xl sm:h-96 sm:w-96", tone === "navy" ? "bg-navy-light/50" : "bg-navy/10")} />
          <div className={cn("absolute top-1/3 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl sm:h-72 sm:w-72", tone === "navy" ? "bg-white/10" : "bg-navy-soft/60")} />
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

const BLOB_FILL = {
  navy: ["#1d4aa3", "#12357a"],
  orange: ["#f2761f", "#e8520a"],
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
  lavender: "lavender",
  /** On navy sections. */
  white: "white",
  /** Quietest option: outline only. */
  outline: "outline",
} as const satisfies Record<string, UiIconTileTone>;

const SITE_TILE_SIZE = { sm: "md", md: "lg", lg: "xl" } as const satisfies Record<string, UiIconTileSize>;

/**
 * Rounded-square tinted tile holding an icon — the standard mark for feature rows, step lists and
 * "why us" cards. `icon` takes a lucide component, a lucide name from the CMS catalog or a short
 * emoji. Decorative by default; pass `label` when the tile alone conveys the meaning.
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
  return <UiIconTile icon={icon} tone={SITE_TILE_TONE[tone]} size={SITE_TILE_SIZE[size]} label={label} className={className} />;
}
