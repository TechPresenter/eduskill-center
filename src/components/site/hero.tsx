import { ArrowRight, TrendingUp } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";
import { HeroPattern } from "@/components/site/page-hero";
import { HeroIllustration } from "@/components/site/hero-illustration";
import { HeroFinderCard } from "@/components/site/hero-finder-card";
import { HeroSlider, type HeroSlideData } from "@/components/site/hero-slider";
import { SafeImage } from "@/components/site/safe-image";
import { CountUp } from "@/components/site/count-up";
import type { ImpactStatValue } from "@/server/public";

export interface HeroSection {
  eyebrow?: string;
  title: string;
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

export function Hero({ section, impact }: { section: HeroSection; impact: ImpactStatValue[] }) {
  const badgeStat = section.badgeValueKey ? impact.find((s) => s.key === section.badgeValueKey) : undefined;

  const badge =
    badgeStat && section.badgeLabel ? (
      <div className="animate-fade-up absolute top-6 left-0 flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 text-navy shadow-float sm:-left-4" style={{ animationDelay: "250ms" }}>
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

  // The first slide is the section's own fields, so existing CMS content keeps rendering exactly as
  // before and the slider only appears once the Foundation adds a second slide in Admin → CMS.
  const extra = (section.slides ?? []).filter((s) => s && s.title?.trim());
  if (extra.length > 0) {
    const slides: HeroSlideData[] = [
      {
        eyebrow: section.eyebrow,
        title: section.title,
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
        <HeroSlider slides={slides} badge={badge} finderCard={<HeroFinderCard title={section.cardTitle || "Find a Training Center"} />} />
        <div className="h-8 lg:h-16" aria-hidden />
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-navy via-navy to-navy-dark text-white">
      <HeroPattern />
      <div className="container-x relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-12 lg:gap-8 lg:py-24">
        <div className="lg:col-span-6 animate-fade-up">
          {section.eyebrow && <p className="eyebrow mb-4 text-orange">{section.eyebrow}</p>}
          <h1 className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
            <Highlight text={section.title} />
          </h1>
          {section.subtitle && <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">{section.subtitle}</p>}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
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
            <ButtonLink href={section.tertiaryHref} variant="link" className="mt-5 text-white hover:text-orange" rightIcon={<ArrowRight className="h-4 w-4" />}>
              {section.tertiaryLabel}
            </ButtonLink>
          )}
        </div>

        <div className="relative lg:col-span-6">
          <div className="relative mx-auto max-w-lg lg:max-w-none">
            <div className="relative aspect-square overflow-hidden rounded-[2rem]">
              {section.imageUrl ? (
                <SafeImage src={section.imageUrl} alt={section.imageAlt || "EduSkill student"} priority sizes="(max-width: 1024px) 90vw, 600px" className="rounded-[2rem]" />
              ) : (
                <HeroIllustration className="h-full w-full" />
              )}
            </div>

            {badgeStat && section.badgeLabel && (
              <div className="absolute top-6 left-0 flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 text-navy shadow-float animate-fade-up sm:-left-4" style={{ animationDelay: "250ms" }}>
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
            )}

            <div className="relative mt-6 flex justify-center lg:absolute lg:right-0 lg:-bottom-6 lg:mt-0 lg:justify-end animate-fade-up" style={{ animationDelay: "150ms" }}>
              <HeroFinderCard title={section.cardTitle || "Find a Training Center"} />
            </div>
          </div>
        </div>
      </div>
      <div className="h-8 lg:h-16" aria-hidden />
    </section>
  );
}
