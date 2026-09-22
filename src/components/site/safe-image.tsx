import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Fills its (relatively positioned) parent with an image. Same-origin uploads and https
 * URLs go through next/image; anything else falls back to a plain <img>.
 *
 * Intended parent: `<div class="media media-16x9">` (or `media-4x3` / `media-1x1`), which already
 * supplies position, overflow, the inherited radius and `object-fit: cover` — so one photograph
 * crops identically in a list card and on a detail page.
 */
export function SafeImage({ src, alt, className, sizes = "(max-width: 768px) 100vw, 50vw", priority }: { src: string; alt: string; className?: string; sizes?: string; priority?: boolean }) {
  const optimizable = src.startsWith("/") || src.startsWith("https://");
  if (optimizable) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("absolute inset-0 h-full w-full object-cover", className)} loading={priority ? "eager" : "lazy"} />;
}

/* ─────────────────────────── Branded placeholder art ─────────────────────────── */

/**
 * Stable 32-bit hash of a seed string. Deterministic across server and client renders, so the same
 * course or centre always draws the same pattern instead of flickering between navigations.
 */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Four geometric compositions drawn from the brand's own shapes. No photography, no grey box. */
const PLACEHOLDER_VARIANTS = 4;

/**
 * The empty state for every image slot on the public site.
 *
 * Most records genuinely have no photograph, so this is the common case and it has to look
 * deliberate: navy and lavender geometry with an optional mark, rendered as inline SVG. It costs no
 * network request (so it cannot 404 under the `/center` sub-path), reserves exactly the same
 * aspect-ratio box as a real photo, and never shifts the layout when one is added later.
 *
 * `media` gives `> svg` object-cover, so `preserveAspectRatio="slice"` lets one artwork sit
 * correctly in a 16/9, 4/3 or 1/1 frame.
 */
export function MediaPlaceholder({ seed, mark, tone = "lavender", className }: { seed: string; mark?: string; tone?: "lavender" | "navy"; className?: string }) {
  const h = hashSeed(seed);
  const variant = h % PLACEHOLDER_VARIANTS;
  const dark = tone === "navy";
  const base = dark ? "#12357a" : "#e8eaf6";
  const ink = dark ? "#ffffff" : "#12357a";
  const accent = "#e8520a";
  const uid = `ph${(h % 100000).toString(36)}`;

  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" focusable="false" className={cn("select-none", className)}>
      <defs>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={base} />
          <stop offset="100%" stopColor={dark ? "#102f70" : "#f3f4fb"} />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <rect width="320" height="180" />
        </clipPath>
      </defs>
      <rect width="320" height="180" fill={`url(#${uid}g)`} />
      <g clipPath={`url(#${uid}c)`} fill="none" stroke={ink} strokeOpacity={dark ? 0.22 : 0.16} strokeWidth="1.5">
        {variant === 0 && (
          <>
            <circle cx="262" cy="34" r="30" />
            <circle cx="262" cy="34" r="52" />
            <circle cx="262" cy="34" r="74" />
            <path d="M-10 150 Q 80 108 168 146 T 340 128" />
          </>
        )}
        {variant === 1 && (
          <>
            <path d="M40 180 L40 96 L96 62 L152 96 L152 180" />
            <path d="M176 180 L176 74 L232 40 L288 74 L288 180" />
            <path d="M0 132 H320" />
          </>
        )}
        {variant === 2 && (
          <>
            <path d="M-20 60 L120 -20 M10 100 L150 20 M40 140 L180 60 M70 180 L210 100" />
            <circle cx="236" cy="118" r="44" />
            <circle cx="236" cy="118" r="22" />
          </>
        )}
        {variant === 3 && (
          <>
            <rect x="34" y="34" width="86" height="86" rx="16" />
            <rect x="140" y="62" width="86" height="86" rx="16" />
            <rect x="228" y="16" width="70" height="70" rx="14" />
          </>
        )}
      </g>
      {/* One orange accent: the brand's key colour, used once so it still means something. */}
      <g fill={accent} fillOpacity={dark ? 0.95 : 0.9}>
        {variant === 0 && <circle cx="58" cy="52" r="9" />}
        {variant === 1 && <rect x="176" y="150" width="112" height="6" rx="3" />}
        {variant === 2 && <circle cx="236" cy="118" r="7" />}
        {variant === 3 && <rect x="34" y="140" width="86" height="6" rx="3" />}
      </g>
      {mark && (
        <text x="160" y="104" textAnchor="middle" fontSize="46" fontWeight="800" fill={ink} fillOpacity={dark ? 0.9 : 0.34} letterSpacing="1" className="font-heading">
          {mark.slice(0, 3).toUpperCase()}
        </text>
      )}
    </svg>
  );
}

/**
 * One media frame for the whole public site: a real photograph when the record has one, the branded
 * placeholder when it does not, in the same aspect-ratio box either way.
 *
 * `ratio` names the role, never the layout: `16x9` for wide covers, `4x3` for portrait cards,
 * `1x1` for avatars and logos. Callers pass nothing else about shape.
 */
export function Media({
  src,
  alt,
  seed,
  mark,
  ratio = "16x9",
  tone,
  sizes,
  priority,
  className,
  children,
}: {
  src?: string | null;
  alt: string;
  /** Stable identity (slug, id or code) so the placeholder pattern never changes between renders. */
  seed: string;
  /** Short initials drawn into the placeholder. Omit for a purely geometric one. */
  mark?: string;
  ratio?: "16x9" | "4x3" | "1x1";
  tone?: "lavender" | "navy";
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Overlay content (badges, a gradient scrim) positioned against the frame. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("media", ratio === "16x9" && "media-16x9", ratio === "4x3" && "media-4x3", ratio === "1x1" && "media-1x1", className)}>
      {src ? <SafeImage src={src} alt={alt} sizes={sizes} priority={priority} /> : <MediaPlaceholder seed={seed} mark={mark} tone={tone} />}
      {children}
    </div>
  );
}
