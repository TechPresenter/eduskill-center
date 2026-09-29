import { CountUp } from "@/components/site/count-up";
import { SectionBg } from "@/components/site/decor";
import type { ImpactStatValue } from "@/server/public";
import { cn } from "@/lib/utils";

/**
 * Navy band of big orange counters. Every value is read from the database by `getImpactStats()` —
 * there are no hard-coded statistics here, and when the Foundation has nothing to count yet the band
 * renders nothing at all rather than showing a row of zeroes.
 *
 * This is the band where the logo's third colour earns its keep. The Foundation's own numbers are the
 * one place the mark's blue→green sweep says something (this is us, and this is how far we have got),
 * so the wash under them is `swoosh` rather than the generic `spotlight` — and on /about, where the
 * impact band and the CTA band sit back to back, it is also what stops two navy bands reading as one
 * long one. Green arrives here as a FILL, never as text, which is what THE GREEN RULE asks for.
 */
export function ImpactBand({ stats, className }: { stats: ImpactStatValue[]; className?: string }) {
  if (stats.length === 0) return null;
  const cols = stats.length >= 5 ? "grid-cols-2 md:grid-cols-5" : stats.length === 4 ? "grid-cols-2 md:grid-cols-4" : stats.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2";
  return (
    <section className={cn("relative overflow-x-clip bg-navy text-white section-y", className)} aria-label="Our impact in numbers">
      {/*
        opacity-70 is the contrast budget, not a taste dial. At full strength the ribbon's green end
        (#9dc89b at 0.22 over navy) composites to #226797, which drops the white/80 labels to 4.47:1 —
        a hair under AA. Dialled to 70% the lightest point the band can reach is #185f97: labels 4.96:1
        AA, figures 3.61:1 (large text, 36/48px 800, so the 3:1 floor applies). Re-measure before
        raising it. The grid stays underneath for the ruled-row structure the hairlines below echo.
      */}
      <SectionBg variant="swoosh" tone="navy" className="opacity-70" />
      <SectionBg variant="grid" tone="navy" className="opacity-50" />
      <div className="container-x relative z-10">
        <ul className={cn("grid gap-x-6 gap-y-10 text-center", cols)}>
          {stats.map((s) => (
            <li key={s.key} className="flex flex-col items-center">
              {/* The figures are the one accent on this band, so they have to be the accent that
                  survives navy: plain text-orange measures 2.28:1 on the logo blue (it was already
                  failing at 3.11:1 on the old navy), text-orange-on-navy 4.56:1. */}
              <span className="font-heading text-4xl font-extrabold tracking-tight text-orange-on-navy tabular-nums sm:text-5xl">
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
