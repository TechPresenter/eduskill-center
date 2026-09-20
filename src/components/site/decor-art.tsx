/**
 * Raw inline-SVG art for the public-site decorative layer.
 *
 * Pages should not import from here — they compose the primitives exported by `./decor.tsx`
 * (`SectionBg`, `SectionDivider`, `Blob`, `GlowOrb`, `IconTile`). This module only holds the shapes,
 * patterns and path data so `decor.tsx` stays readable.
 *
 * Everything here is pure inline SVG: no external image files, no data-URIs, no client JS.
 */
import { cn } from "@/lib/utils";

/**
 * Which ink the line work uses.
 *   "light" — for sections painted white / lavender / surface (navy + orange line work)
 *   "navy"  — for sections painted navy / navy gradient (white + orange line work)
 */
export type DecorTone = "light" | "navy";

const NAVY = "#12357a";
const WHITE = "#ffffff";

/** Line/dot colour for a tone. */
export function inkFor(tone: DecorTone) {
  return tone === "navy" ? WHITE : NAVY;
}

/**
 * SVG ids are derived from the props rather than a random/`useId` value so the markup is stable
 * between server and client. Two identical layers on one page emit identical `<defs>` under the same
 * id, which is harmless; different tones/sizes get different ids.
 */
function idFor(name: string, ...parts: (string | number)[]) {
  return ["esk", name, ...parts].join("-");
}

/** Faint square line grid that fades out towards the section edges. Good behind text-heavy sections. */
export function GridPattern({ tone = "light", size = 32, opacity }: { tone?: DecorTone; size?: number; opacity?: number }) {
  const id = idFor("grid", tone, size);
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <path d={`M ${size} 0 L 0 0 L 0 ${size}`} fill="none" stroke={inkFor(tone)} strokeWidth="1" />
        </pattern>
        <radialGradient id={`${id}-fade`}>
          <stop offset="0.2" stopColor={WHITE} stopOpacity="1" />
          <stop offset="1" stopColor={WHITE} stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} mask={`url(#${id}-mask)`} opacity={opacity ?? (tone === "navy" ? 0.16 : 0.13)} />
    </svg>
  );
}

/** Subtle dot matrix, also edge-faded. Quieter than the grid — use under cards and media. */
export function DotPattern({ tone = "light", size = 24, opacity }: { tone?: DecorTone; size?: number; opacity?: number }) {
  const id = idFor("dots", tone, size);
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <circle cx={size / 2} cy={size / 2} r="1.5" fill={inkFor(tone)} />
        </pattern>
        <radialGradient id={`${id}-fade`}>
          <stop offset="0.25" stopColor={WHITE} stopOpacity="1" />
          <stop offset="1" stopColor={WHITE} stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} mask={`url(#${id}-mask)`} opacity={opacity ?? (tone === "navy" ? 0.3 : 0.22)} />
    </svg>
  );
}

/** Concentric outlined circles meant to bleed off a corner — position with `className`. */
export function RingArt({ tone = "light", rings = 5, className }: { tone?: DecorTone; rings?: number; className?: string }) {
  const ink = inkFor(tone);
  const base = tone === "navy" ? 0.26 : 0.16;
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" fill="none" className={cn("absolute", className)} xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: rings }).map((_, i) => (
        <circle key={i} cx="200" cy="200" r={44 + i * 36} stroke={ink} strokeWidth="1.5" strokeOpacity={Math.max(0.05, base - i * 0.025)} />
      ))}
      <circle cx="200" cy="200" r="16" fill="#e8520a" fillOpacity={tone === "navy" ? 0.85 : 0.4} />
    </svg>
  );
}

/** Three stacked wave bands anchored to an edge — softens the seam between two sections. */
export function WaveBands({ tone = "light", className }: { tone?: DecorTone; className?: string }) {
  const bands =
    tone === "navy"
      ? [
          { d: "M0 150 C 240 108 430 192 720 160 C 1000 130 1180 90 1440 128 L1440 221 L0 221 Z", fill: WHITE, opacity: 0.06 },
          { d: "M0 180 C 260 140 460 210 760 186 C 1030 164 1220 126 1440 168 L1440 221 L0 221 Z", fill: "#e8520a", opacity: 0.1 },
          { d: "M0 205 C 300 176 520 222 820 205 C 1090 190 1250 168 1440 196 L1440 221 L0 221 Z", fill: WHITE, opacity: 0.1 },
        ]
      : [
          { d: "M0 150 C 240 108 430 192 720 160 C 1000 130 1180 90 1440 128 L1440 221 L0 221 Z", fill: NAVY, opacity: 0.05 },
          { d: "M0 180 C 260 140 460 210 760 186 C 1030 164 1220 126 1440 168 L1440 221 L0 221 Z", fill: "#e8520a", opacity: 0.07 },
          { d: "M0 205 C 300 176 520 222 820 205 C 1090 190 1250 168 1440 196 L1440 221 L0 221 Z", fill: NAVY, opacity: 0.08 },
        ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 220"
      preserveAspectRatio="none"
      className={cn("absolute inset-x-0 bottom-0 h-40 w-full sm:h-52 lg:h-64", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {bands.map((b, i) => (
        <path key={i} d={b.d} fill={b.fill} fillOpacity={b.opacity} />
      ))}
    </svg>
  );
}

/** Organic closed shapes used by `<Blob>`; drawn on a 0–200 square viewBox. */
export const BLOB_PATHS = [
  "M100 8 C142 8 177 34 187 74 C197 116 178 159 142 180 C106 201 57 196 31 166 C5 136 2 88 22 54 C42 20 60 8 100 8 Z",
  "M62 14 C108 -2 165 18 183 62 C201 107 186 160 148 182 C110 204 53 194 27 158 C1 122 4 66 26 40 C40 24 46 20 62 14 Z",
  "M104 10 C152 4 191 44 193 92 C195 142 158 187 110 193 C62 199 17 166 7 120 C-3 74 24 30 60 16 C74 11 90 12 104 10 Z",
] as const;

/**
 * Shape dividers for the seam between two sections. The path fills the BOTTOM of the box, so the
 * divider goes at the end of section A and is filled with section B's colour.
 */
export const DIVIDER_PATHS = {
  /** Soft double-curve — the friendliest transition; good between light sections. */
  wave: "M0 44 C 190 96 350 4 720 26 C 1090 48 1255 98 1440 46 L1440 101 L0 101 Z",
  /** Straight diagonal — sharper, editorial; good under a navy band. */
  slant: "M0 101 L1440 0 L1440 101 Z",
  /** Single wide arch — centres attention on the next section's heading. */
  curve: "M0 101 C 420 6 1020 6 1440 101 Z",
} as const;

export type DividerVariant = keyof typeof DIVIDER_PATHS;
