import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IconTile } from "@/components/site/decor";
import { Media } from "@/components/site/safe-image";
import { cn } from "@/lib/utils";

/**
 * One program in a grid. The whole card is the link (44px+ by construction), the icon tile is the
 * shared `IconTile` rather than a hand-rolled square, and the card lift comes from `card-hover`.
 *
 * THE CARD FAMILY — program / course / centre / story cards repeat down the front page, so they
 * share one spine and differ only where the content does:
 *   shell     `card card-hover`, `flex h-full flex-col` so a row of them is one height
 *   title     `text-navy`, lightening to `text-navy-light` on hover (8.49 → 5.82, both AA)
 *   meta      a `size-4` `text-navy-light` icon beside `text-body-sm text-muted` text
 *   accent    orange = actions (buttons, the icon tile's hover fill) · green = the money and
 *             availability signals a visitor is shopping for (free, scholarship, seats)
 *   focus     `ring-focus` on the link, so a keyboard user sees the card, not just a hue shift
 * Orange TEXT is gone from the family: at 13.5px it measures 3.72:1 on white and fails AA, the
 * same reason globals.css moved prose links off it. Orange survives as fills, which clear 3:1.
 */
export function ProgramCard({ program }: { program: { slug: string; title: string; summary: string; icon: string | null; image?: string | null } }) {
  return (
    <Link href={`/programs/${program.slug}`} className="card card-hover ring-focus group flex h-full flex-col overflow-hidden">
      {/* With a picture the card opens on it (16:9, like the course cards) and the icon tile rides up
          over its bottom edge; without one it is the plain icon card it always was. Decorative: the
          title below names the programme. */}
      {program.image && (
        <div className="overflow-hidden rounded-t-card">
          <div className="transition-transform duration-element ease-soft group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
            <Media src={program.image} alt="" seed={program.slug} ratio="16x9" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col card-p">
        <IconTile
          icon={program.icon ?? "Sparkles"}
          size="lg"
          className={cn(
            "transition-colors duration-micro ease-soft group-hover:bg-orange group-hover:text-white group-hover:ring-orange motion-reduce:transition-none",
            program.image && "relative -mt-12 shadow-e2 ring-4 ring-white"
          )}
        />
        <h3 className="mt-5 text-h3 text-navy transition-colors duration-micro ease-soft group-hover:text-navy-light motion-reduce:transition-none">{program.title}</h3>
        <p className="mt-2 flex-1 text-body text-muted">{program.summary}</p>
        {/* Navy, not orange: 13.5px semibold orange is 3.72:1 on white. Navy is 8.49:1. */}
        <span className="mt-5 inline-flex items-center gap-1.5 text-body-sm font-semibold text-navy">
          Learn more
          <ArrowRight className="h-4 w-4 transition-transform duration-micro ease-soft group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
