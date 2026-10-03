import Link from "next/link";
import { ArrowRight, CheckCircle2, Coffee, Sparkles, Trophy } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { PageHero } from "@/components/site/page-hero";
import { cn } from "@/lib/utils";
import { RotatingWords } from "./rotating-words";

/**
 * Building blocks shared by the programme landing pages under /programs (School AI Workshop,
 * Digital Marketing Training): hero, ticker, jump links, hover tiles and bullets, tables and the
 * "other programmes" strip. Server components; the only client piece is RotatingWords.
 */

export type IconType = React.ComponentType<{ className?: string }>;

/** Hero band: title, rotating line, at-a-glance chips and the two calls to action. */
export function LandingHero({
  eyebrow,
  title,
  description,
  crumb,
  rotating,
  chips,
  primary,
  secondary,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** Last breadcrumb label. */
  crumb: string;
  rotating: string[];
  chips: string[];
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}) {
  return (
    <PageHero eyebrow={eyebrow} title={title} description={description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Programs", href: "/programs" }, { label: crumb }]}>
      <div className="space-y-5 lg:space-y-7">
        <p className="font-heading text-h3 text-white lg:text-h2">
          <RotatingWords words={rotating} wordClassName="text-orange-on-navy" />
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="At a glance">
          {chips.map((c) => (
            <li
              key={c}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-body-sm font-semibold text-white transition-colors duration-micro hover:border-orange-on-navy/60 hover:bg-white/15 motion-reduce:transition-none"
            >
              <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0 text-orange-on-navy" />
              {c}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={primary.href} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
            {primary.label}
          </ButtonLink>
          <ButtonLink href={secondary.href} size="lg" variant="white">
            {secondary.label}
          </ButtonLink>
        </div>
      </div>
    </PageHero>
  );
}

/** Moving orange strip of short phrases. Decorative: the phrases are read once from the sr-only copy. */
export function Ticker({ items, seconds = 32 }: { items: string[]; seconds?: number }) {
  return (
    <div className="relative overflow-x-clip bg-orange py-3 text-white">
      <p className="sr-only">{items.join(", ")}</p>
      <div aria-hidden className="flex w-max animate-marquee items-center" style={{ "--marquee-duration": `${seconds}s` } as React.CSSProperties}>
        {[0, 1].map((run) => (
          <div key={run} className="flex items-center">
            {[...items, ...items].map((t, i) => (
              <span key={`${run}-${i}`} className="flex items-center gap-4 px-4 font-heading text-xl font-bold whitespace-nowrap">
                {t}
                <Sparkles className="h-4 w-4 text-white/80" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "On this page" pill links; a swipeable row on phones. */
export function JumpLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="border-b border-line bg-white">
      <div className="container-x">
        <ul className="hscroll gap-2 py-3 lg:mx-0 lg:flex-wrap lg:px-0">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="ring-focus inline-flex min-h-11 items-center rounded-full border border-line px-4 text-body-sm font-semibold whitespace-nowrap text-navy transition-colors duration-micro hover:border-orange hover:bg-orange-light hover:text-orange motion-reduce:transition-none"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** Icon tile that tilts and grows a little when its card (`group`) is hovered. */
export function HoverIcon({ icon: Icon, className }: { icon: IconType; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-light text-orange transition-transform duration-element ease-soft group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:transform-none",
        className
      )}
    >
      <Icon className="h-6 w-6" />
    </span>
  );
}

/** A bullet line whose text slides right and turns orange on hover. */
export function HoverBullet({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <li className="group/item flex items-start gap-2.5">
      <CheckCircle2 aria-hidden className={cn("mt-1 h-4 w-4 shrink-0", light ? "text-green-on-navy" : "text-green")} />
      <span
        className={cn(
          "transition-[color,transform] duration-micro ease-soft group-hover/item:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/item:translate-x-0",
          light ? "text-white/90 group-hover/item:text-white" : "text-ink/85 group-hover/item:text-orange"
        )}
      >
        {children}
      </span>
    </li>
  );
}

/**
 * A two-column table in a card: navy header, zebra rows that tint on hover, and optional
 * break / closing rows. `firstAsPill` shows the first column as an orange pill (durations).
 */
export function SimpleTable({
  caption,
  head,
  rows,
  firstAsPill,
  firstIcon: FirstIcon,
  minWidth,
}: {
  caption: string;
  head: [string, string];
  rows: { cells: [string, string]; kind?: "break" | "closing" }[];
  firstAsPill?: boolean;
  firstIcon?: IconType;
  minWidth?: string;
}) {
  return (
    <div className="card relative mt-6 overflow-x-auto">
      <table className={cn("w-full border-collapse text-left", minWidth)}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-navy text-white">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 text-overline sm:px-6">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.cells.join("|")}
              className={cn(
                "group border-t border-line transition-colors duration-micro motion-reduce:transition-none",
                row.kind === "break" ? "bg-orange-light" : row.kind === "closing" ? "bg-green-light" : "odd:bg-white even:bg-surface hover:bg-lavender"
              )}
            >
              <td className="px-4 py-3 align-top whitespace-nowrap sm:px-6">
                {firstAsPill ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-light px-3 py-1 text-body-sm font-bold text-orange transition-colors duration-micro group-hover:bg-orange group-hover:text-white motion-reduce:transition-none">
                    {FirstIcon && <FirstIcon aria-hidden className="h-3.5 w-3.5" />}
                    {row.cells[0]}
                  </span>
                ) : (
                  <span className="text-body-sm font-bold text-navy tabular-nums">{row.cells[0]}</span>
                )}
              </td>
              <td className="px-4 py-3 text-body text-ink sm:px-6">
                <span className="inline-flex items-center gap-2">
                  {row.kind === "break" && <Coffee aria-hidden className="h-4 w-4 shrink-0 text-orange" />}
                  {row.kind === "closing" && <Trophy aria-hidden className="h-4 w-4 shrink-0 text-green-dark" />}
                  {row.cells[1]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pill links to the other programmes, at the foot of a landing page. */
export function OtherProgramsNav({ programs }: { programs: { id: string; slug: string; title: string; icon: string | null }[] }) {
  if (programs.length === 0) return null;
  return (
    <nav className="border-t border-line bg-white py-8" aria-labelledby="other-programs">
      <div className="container-x">
        <h2 id="other-programs" className="text-overline text-muted">
          Other programs
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {programs.map((p) => (
            <li key={p.id}>
              <Link
                href={`/programs/${p.slug}`}
                className="ring-focus group inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-body-sm font-semibold text-navy transition-colors duration-micro hover:border-orange hover:text-orange motion-reduce:transition-none"
              >
                <DynamicIcon name={p.icon ?? undefined} className="h-4 w-4 text-orange" aria-hidden />
                {p.title}
                <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-micro group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
