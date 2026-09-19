import { CountUp } from "@/components/site/count-up";
import { HeroPattern } from "@/components/site/page-hero";
import type { ImpactStatValue } from "@/server/public";
import { cn } from "@/lib/utils";

/** Navy band with big orange animated statistics. Renders nothing when there are no real values. */
export function ImpactBand({ stats, className }: { stats: ImpactStatValue[]; className?: string }) {
  if (stats.length === 0) return null;
  return (
    <section className={cn("relative overflow-hidden bg-navy text-white", className)} aria-label="Our impact in numbers">
      <HeroPattern />
      <div className="container-x relative py-14 sm:py-16">
        <ul className={cn("grid gap-8 text-center", stats.length >= 5 ? "grid-cols-2 md:grid-cols-5" : stats.length === 4 ? "grid-cols-2 md:grid-cols-4" : stats.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2")}>
          {stats.map((s) => (
            <li key={s.key} className="flex flex-col items-center">
              <span className="font-heading text-4xl font-extrabold tracking-tight text-orange tabular-nums sm:text-5xl">
                <CountUp value={s.value} suffix={s.suffix} />
              </span>
              <span className="mt-2 text-sm font-semibold text-white/80">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
