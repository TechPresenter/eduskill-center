import { ArrowRight, TrendingUp } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { HeroPattern } from "@/components/site/page-hero";
import { HeroIllustration } from "@/components/site/hero-illustration";
import { HeroFinderCard } from "@/components/site/hero-finder-card";
import { HeroSlider, HeroTitle, type HeroSlideData } from "@/components/site/hero-slider";
import { SafeImage } from "@/components/site/safe-image";
import { CountUp } from "@/components/site/count-up";
import type { ImpactStatValue } from "@/server/public";

export interface HeroSection {
  eyebrow?: string;
  title: string;
  /** Optional short title for phones (≤ 2 lines). Falls back to the first line of `title`. */
  mobileTitle?: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  tertiaryLabel?: string;
  tertiaryHref?: string;
  imageUrl?: string;
  imageAlt?: string;
  badgeLabel?: string;
  badgeValueKey?: string;
  cardTitle?: string;
  /** Extra slides added in Admin → CMS. Empty means the hero renders as a single static banner. */
  slides?: HeroSlideData[];
}

/**
 * The homepage hero.
 *
 * Below lg it is an app's compact header: eyebrow, a two-line title at the h1 step, one line of support
 * and nothing else — the search bar and quick actions the page renders right under it overlap its
 * bottom edge, so the first phone screen is actionable. The artwork, badge, finder card and CTA
 * buttons are desktop-only (their jobs are the quick-action tiles on phones).
 *
 * From lg it is the website hero: copy on seven columns, artwork and the finder card on five, the
 * title at a size that keeps the seeded three CMS lines to three lines.
 */
export function Hero({ section, impact }: { section: HeroSection; impact: ImpactStatValue[] }) {
  const badgeStat = section.badgeValueKey ? impact.find((s) => s.key === section.badgeValueKey) : undefined;

  const badge =
    badgeStat && section.badgeLabel ? (
      <div className="animate-fade-up absolute top-6 -left-4 flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 text-navy shadow-float motion-reduce:animate-none" style={{ animationDelay: "250ms" }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-light text-orange">
          <TrendingUp className="h-5 w-5" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block font-heading text-xl font-extrabold text-navy">
            <CountUp value={badgeStat.value} suffix={badgeStat.suffix} />
          </span>
          <span className="block text-xs font-semibold text-muted">{section.badgeLabel}</span>
        </span>
      </div>
    ) : null;

  const finderCard = <HeroFinderCard title={section.cardTitle || "Find a Training Center"} />;

  // The first slide is the section's own fields, so existing CMS content keeps rendering exactly as
  // before and the slider only appears once the Foundation adds a second slide in Admin → CMS.
  const extra = (section.slides ?? []).filter((s) => s && s.title?.trim());
  if (extra.length > 0) {
    const slides: HeroSlideData[] = [
      {
        eyebrow: section.eyebrow,
        title: section.title,
        mobileTitle: section.mobileTitle,
        subtitle: section.subtitle,
        primaryLabel: section.primaryLabel,
        primaryHref: section.primaryHref,
        secondaryLabel: section.secondaryLabel,
        secondaryHref: section.secondaryHref,
        tertiaryLabel: section.tertiaryLabel,
        tertiaryHref: section.tertiaryHref,
        imageUrl: section.imageUrl,
        imageAlt: section.imageAlt,
      },
      ...extra,
    ];
    return (
      <section className="relative overflow-hidden bg-linear-to-br from-navy via-navy to-navy-dark text-white">
        <HeroPattern />
        <HeroSlider slides={slides} badge={badge} finderCard={finderCard} />
        <div className="hidden h-16 lg:block" aria-hidden />
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-navy via-navy to-navy-dark text-white">
      <HeroPattern />
      <div className="container-x relative grid items-center gap-8 pt-6 pb-14 sm:pt-10 sm:pb-16 lg:grid-cols-12 lg:py-24">
        <div className="animate-fade-up motion-reduce:animate-none lg:col-span-7">
          {section.eyebrow && <p className="eyebrow mb-2 text-orange lg:mb-4">{section.eyebrow}</p>}
          <HeroTitle title={section.title} mobileTitle={section.mobileTitle} />
          {section.subtitle && <p className="mt-2 line-clamp-3 max-w-xl text-body-sm text-white/80 sm:text-body lg:mt-6 lg:line-clamp-none lg:text-body-lg">{section.subtitle}</p>}
          <div className="mt-8 hidden gap-3 lg:flex lg:items-center">
            {section.primaryLabel && section.primaryHref && (
              <ButtonLink href={section.primaryHref} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {section.primaryLabel}
              </ButtonLink>
            )}
            {section.secondaryLabel && section.secondaryHref && (
              <ButtonLink href={section.secondaryHref} size="lg" variant="white">
                {section.secondaryLabel}
              </ButtonLink>
            )}
          </div>
          {section.tertiaryLabel && section.tertiaryHref && (
            <ButtonLink href={section.tertiaryHref} variant="link" className="mt-5 hidden text-white hover:text-orange lg:inline-flex" rightIcon={<ArrowRight className="h-4 w-4" />}>
              {section.tertiaryLabel}
            </ButtonLink>
          )}
        </div>

        <div className="relative hidden lg:col-span-5 lg:block">
          <div className="relative">
            <div className="relative aspect-square overflow-hidden rounded-2xl">
              {section.imageUrl ? (
                <SafeImage src={section.imageUrl} alt={section.imageAlt || "EduSkill student"} priority sizes="(max-width: 1024px) 1px, 520px" className="rounded-2xl" />
              ) : (
                <HeroIllustration className="h-full w-full" />
              )}
            </div>

            {badge}

            <div className="animate-fade-up absolute right-0 -bottom-6 flex justify-end motion-reduce:animate-none" style={{ animationDelay: "150ms" }}>
              {finderCard}
            </div>
          </div>
        </div>
      </div>
      <div className="hidden h-16 lg:block" aria-hidden />
    </section>
  );
}
