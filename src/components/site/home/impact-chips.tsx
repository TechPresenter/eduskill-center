import { cn } from "@/lib/utils";

export interface ImpactChip {
  key: string;
  value: number;
  suffix?: string;
  label: string;
}

const fmt = new Intl.NumberFormat("en-IN");

/**
 * The phone home screen's impact row: small stat chips in one swipeable line instead of a full navy
 * band. Only real, positive numbers are ever passed in (the caller filters out zeroes), and the heading
 * says "so far" so a young Foundation's honest small numbers never read as a broken statistic.
 */
export function ImpactChips({ chips, className }: { chips: ImpactChip[]; className?: string }) {
  const shown = chips.filter((c) => Number.isFinite(c.value) && c.value > 0);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="home-reach-title" className={className}>
      <h2 id="home-reach-title" className="px-1 text-overline text-muted">
        Our reach so far
      </h2>
      <ul className={cn("hscroll mt-2 gap-2 py-1")}>
        {shown.map((c) => (
          <li key={c.key} className="flex min-h-11 items-baseline gap-1.5 rounded-full border border-line bg-white px-4 py-2 shadow-e1">
            <span className="font-heading text-h4 text-navy tabular-nums">
              {fmt.format(c.value)}
              {c.suffix}
            </span>
            <span className="text-body-sm whitespace-nowrap text-muted">{c.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
