import { CountUp } from "@/components/site/count-up";
import { SectionBg } from "@/components/site/decor";
import type { ImpactStatValue } from "@/server/public";
import { cn } from "@/lib/utils";

/**
 * Navy band of big orange counters. Every value is read from the database by `getImpactStats()` —
 * there are no hard-coded statistics here, and when the Foundation has nothing to count yet the band
 * renders nothing at all rather than showing a row of zeroes.
 */
export function ImpactBand({ stats, className }: { stats: ImpactStatValue[]; className?: string }) {
  if (stats.length === 0) return null;
  const cols = stats.length >= 5 ? "grid-cols-2 md:grid-cols-5" : stats.length === 4 ? "grid-cols-2 md:grid-cols-4" : stats.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2";
  return (
    <section className={cn("relative overflow-x-clip bg-navy text-white section-y", className)} aria-label="Our impact in numbers">
      <SectionBg variant="spotlight" tone="navy" />
      <SectionBg variant="grid" tone="navy" className="opacity-50" />
      <div className="container-x relative z-10">
        <ul className={cn("grid gap-x-6 gap-y-10 text-center", cols)}>
          {stats.map((s) => (
            <li key={s.key} className="flex flex-col items-center">
              <span className="font-heading text-4xl font-extrabold tracking-tight text-orange tabular-nums sm:text-5xl">
                <CountUp value={s.value} suffix={s.suffix} />
              </span>
              {/* A hairline under each number turns five loose figures into one measured row. */}
              <span aria-hidden className="mt-4 block h-px w-10 bg-white/25" />
              <span className="mt-4 text-body font-semibold text-white/80">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
