import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IconTile } from "@/components/site/decor";

/**
 * One program in a grid. The whole card is the link (44px+ by construction), the icon tile is the
 * shared `IconTile` rather than a hand-rolled square, and the arrow is the only thing that moves on
 * hover — the card lift comes from `card-hover`.
 */
export function ProgramCard({ program }: { program: { slug: string; title: string; summary: string; icon: string | null } }) {
  return (
    <Link href={`/programs/${program.slug}`} className="card card-hover ring-focus group flex h-full flex-col card-p">
      <IconTile
        icon={program.icon ?? "Sparkles"}
        size="lg"
        className="transition-colors duration-micro ease-soft group-hover:bg-orange group-hover:text-white group-hover:ring-orange motion-reduce:transition-none"
      />
      <h3 className="mt-5 text-h3 text-navy">{program.title}</h3>
      <p className="mt-2 flex-1 text-body text-muted">{program.summary}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-body-sm font-semibold text-orange">
        Learn more
        <ArrowRight className="h-4 w-4 transition-transform duration-micro ease-soft group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
      </span>
    </Link>
  );
}
