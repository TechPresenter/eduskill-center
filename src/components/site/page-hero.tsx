import { Highlight } from "@/components/ui/highlight";
import { Breadcrumbs } from "@/components/ui/misc";
import { SectionBg } from "@/components/site/decor";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom padding. The band is short on phones, so a page that pulls its first block up into
 * it (about: mission cards; training-centers: the search card; a centre page: its banner, all with a
 * negative top margin) would cover the description. When the NEXT section carries such a pull-up,
 * the band grows a "shoulder" for it; every other page keeps the slim 24px tail. CSS-only, no prop,
 * so no call site changes.
 */
const PULL_UP_SHOULDER = "max-lg:[&:has(+section[class*='_-mt-'],+section>div>[class*='_-mt-'])]:pb-14";

/**
 * Title band at the top of inner pages.
 *
 * Phones and tablets (below `lg`) get an app-style page header: a slim solid-navy band directly under
 * the app bar — title at the h2 step, one line of description, no breadcrumbs or eyebrow (the app
 * bar and tab bar do the wayfinding), no decoration layers — so the page's content starts in the
 * first screen instead of under a 40%-of-the-viewport banner. Children (hero buttons, meta rows, the
 * search form) still render, because they are written for a navy background.
 *
 * From `lg` up it is the full banner: gradient, dot grid, breadcrumbs, eyebrow, h1, full description.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumbs,
  children,
  align = "left",
  compact,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children?: React.ReactNode;
  align?: "left" | "center";
  compact?: boolean;
  className?: string;
}) {
  return (
    // `isolate` keeps the decorative layers in their own stacking context, and `overflow-x-clip`
    // contains them — a hero decoration must never be able to widen the document (and, unlike
    // overflow-hidden, clip never turns the band into a scroll container).
    <section
      className={cn(
        "relative isolate overflow-x-clip bg-navy pt-4 pb-6 text-white sm:pt-6 sm:pb-8 lg:bg-linear-to-br lg:from-navy lg:to-navy-dark lg:py-0",
        PULL_UP_SHOULDER,
        className
      )}
    >
      {/* Decoration is desktop-only: on a phone it is paint cost for a band that is ~100px tall. */}
      <SectionBg variant="mesh" tone="navy" className="hidden opacity-80 lg:block" />
      <HeroPattern className="hidden lg:block" />
      <div className={cn("container-x relative z-10", compact ? "lg:py-16" : "lg:py-24", align === "center" && "lg:text-center")}>
        {breadcrumbs && (
          <div className="hidden lg:block">
            <Breadcrumbs
              items={breadcrumbs}
              className={cn("mb-5 text-white/60 [&_a:hover]:text-white [&_span[aria-current]]:text-white/90", align === "center" && "justify-center")}
            />
          </div>
        )}
        {eyebrow && (
          <div className="hidden lg:block">
            <p className={cn("eyebrow mb-3 text-orange", align === "center" && "justify-center")}>{eyebrow}</p>
          </div>
        )}
        <h1 className={cn("max-w-4xl text-h2 text-balance text-white lg:text-h1", align === "center" && "lg:mx-auto")}>
          <Highlight text={title} />
        </h1>
        {description && (
          <p className={cn("mt-1 max-w-2xl text-body-sm text-white/75 max-lg:line-clamp-1 lg:mt-4 lg:text-body-lg lg:text-white/80", align === "center" && "lg:mx-auto")}>
            {description}
          </p>
        )}
        {children && <div className={cn("mt-4 lg:mt-8", align === "center" && "lg:flex lg:justify-center")}>{children}</div>}
      </div>
    </section>
  );
}

/**
 * Subtle dot-grid + glow decoration for navy sections.
 *
 * The glows are two radial gradients on one layer — no `blur()` filter, which a cheap Android GPU
 * has to rasterise at full size — and the layer clips ITSELF, so hosts never have to remember
 * `overflow-hidden` to avoid horizontal page scroll on a 360px phone.
 */
const HERO_GLOW = [
  "radial-gradient(24rem 24rem at calc(100% + 1rem) -2rem, rgb(232 82 10 / 0.2), transparent 70%)",
  "radial-gradient(26rem 26rem at -2rem calc(100% + 4rem), rgb(29 74 163 / 0.45), transparent 70%)",
].join(",");

export function HeroPattern({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* A CSS dot grid rather than an SVG <pattern>: no element id, so two heroes on one page (or a
          hidden phone/desktop twin) can never resolve to the other's pattern. */}
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 1.5px 1.5px, #fff 1.5px, transparent 0)", backgroundSize: "28px 28px" }} />
      <div className="absolute inset-0" style={{ backgroundImage: HERO_GLOW }} />
    </div>
  );
}
