import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DynamicIcon } from "@/components/ui/icon";

export function ProgramCard({ program }: { program: { slug: string; title: string; summary: string; icon: string | null } }) {
  return (
    <Link href={`/programs/${program.slug}`} className="card card-hover group flex h-full flex-col p-6 focus-visible:ring-2">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-light text-orange transition-colors group-hover:bg-orange group-hover:text-white">
        <DynamicIcon name={program.icon ?? undefined} className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-5 text-lg font-bold text-navy">{program.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{program.summary}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-orange">
        Learn More <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
