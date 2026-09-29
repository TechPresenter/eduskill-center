import Link from "next/link";
import type { LucideProps } from "lucide-react";
import { IconTile, type IconTileTone } from "@/components/ui/list";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  href: string;
  icon: React.ComponentType<LucideProps>;
  tone: IconTileTone;
}

/**
 * What a tile is FOR, in the logo's three hues. The Foundation's mark is 52.5% blue, 31.5% orange and
 * 15.9% green, and this grid is the one place on the phone home screen where all three meet — so the
 * six tiles must read as one family, not as six unrelated tints picked a tile at a time.
 *
 * The page keeps saying what each tile means through `tone`; this map is what turns that meaning into
 * a brand hue, so the colour carries information instead of decoration:
 *
 *   blue   look it up — the Foundation's catalogue and records   navy / info / lavender / outline
 *   orange go and do — the tiles that send you somewhere          orange / warning / danger
 *   green  support and benefit — scholarship, aid                 success / muted / neutral
 *   solid  the ONE action the page emphasises, in solid brand blue  navy-solid / white
 *
 * The six the home page ships come out as Courses and Verify Certificate in blue, Apply Now solid,
 * Find a Centre and Become a Trainer in orange, Scholarship in green — three blue to two orange to
 * one green, the logo's own ratio, arrived at from meaning rather than from counting pixels.
 */
type BrandHue = "blue" | "orange" | "green" | "solid";

const ACTION_HUE: Record<IconTileTone, BrandHue> = {
  navy: "blue",
  info: "blue",
  lavender: "blue",
  outline: "blue",
  "navy-solid": "solid",
  white: "solid",
  orange: "orange",
  warning: "orange",
  danger: "orange",
  success: "green",
  muted: "green",
  neutral: "green",
};

/**
 * Measured on the tile's own background:
 *   blue    navy on navy-soft            6.68 AA
 *   orange  orange on orange-light       3.24 — a 24px lucide glyph is a graphic, above the 3:1 floor,
 *           and orange TEXT never appears here: the label underneath is ink on white at 16.27
 *   green   green-dark on green-light     5.89 AA — green-dark because this is the readable green
 *   solid   white on navy                 8.49 AAA
 *
 * Passed as `className` rather than `tone=`: IconTile has no green, and two of its tones carry a
 * hairline ring that would make one tile in the row look boxed. The default tone's classes merge away.
 */
const TILE_CLASS: Record<BrandHue, string> = {
  blue: "bg-navy-soft text-navy",
  orange: "bg-orange-light text-orange",
  green: "bg-green-light text-green-dark",
  solid: "bg-navy text-white",
};

/**
 * The heart of the phone home screen: the main jobs one tap away, as tinted icon tiles with short
 * labels — three per row on phones, one row of six from `sm`. Every tile is a full-size link (well over
 * 44px), pressed with the shared colour-only `press` state (no transform, so nothing here can become a
 * containing block for the header's fixed sheets).
 */
export function QuickActions({ actions, className }: { actions: QuickAction[]; className?: string }) {
  if (actions.length === 0) return null;
  return (
    <nav aria-label="Quick actions" className={cn("card p-2", className)}>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-6">
        {actions.map((a) => (
          <li key={a.href + a.label}>
            <Link href={a.href} className="press ring-focus-inset flex h-full min-h-24 flex-col items-center gap-2 rounded-lg px-1 pt-3 pb-2.5 text-center">
              <IconTile icon={a.icon} size="lg" className={TILE_CLASS[ACTION_HUE[a.tone]]} />
              <span className="text-body-sm leading-tight font-semibold text-ink">{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
