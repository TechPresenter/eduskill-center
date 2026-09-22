import type { Metadata } from "next";
import { ArrowRight, Compass, Target } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getSection, getPage } from "@/lib/cms";
import { getBranding } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { getImpactStats } from "@/server/public";
import { coverageStats } from "@/server/centers";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { Markdown } from "@/components/site/markdown";
import { ImpactBand } from "@/components/site/impact-band";
import { CtaBand } from "@/components/site/cta-band";
import { SectionBg, IconTile } from "@/components/site/decor";
import { SectionHeading } from "@/components/site/section-heading";
import { CountUp } from "@/components/site/count-up";

interface AboutSection {
  heroTitle: string;
  heroDescription?: string;
  mission?: string;
  vision?: string;
  values?: { icon?: string; title: string; description?: string }[];
}

export async function generateMetadata(): Promise<Metadata> {
  const [section, branding] = await Promise.all([getSection<AboutSection>("about.page"), getBranding()]);
  const title = `About ${branding.siteName}`;
  const description = section.heroDescription ?? "";
  return { title: "About Us", description, alternates: { canonical: absoluteUrl("/about") }, openGraph: { title, description, url: absoluteUrl("/about"), type: "website" } };
}

export default async function AboutPage() {
  const [section, page, impact, coverage, branding] = await Promise.all([getSection<AboutSection>("about.page"), getPage("about"), getImpactStats(), coverageStats(), getBranding()]);
  const values = section.values ?? [];
  const coverageItems = [
    { label: "States", value: coverage.states },
    { label: "Districts", value: coverage.districts },
    { label: "Training Centers", value: coverage.centers },
    { label: "Volunteer Trainers", value: coverage.trainers },
  ].filter((c) => c.value > 0);
  const hasPurpose = Boolean(section.mission || section.vision);

  return (
    <>
      <PageHero eyebrow={`About ${branding.shortName}`} title={section.heroTitle} description={section.heroDescription} breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]} />

      {/*
       * Mission and vision overlap the hero by a card's shoulder. The pull-up lives on the section,
       * NOT inside the hero — the hero clips its own decoration, so a child would be sliced in half.
       */}
      {hasPurpose && (
        <section className="relative z-raised container-x -mt-10 grid gap-5 sm:-mt-14 md:grid-cols-2 md:gap-6" aria-label="Our purpose">
          {section.mission && (
            <Reveal className="card rounded-card-lg p-7 sm:p-8">
              <IconTile icon={Target} tone="orange" size="lg" />
              <h2 className="mt-5 text-h3 text-navy">Our mission</h2>
              <p className="mt-2 text-body text-muted">{section.mission}</p>
            </Reveal>
          )}
          {section.vision && (
            <Reveal delay={100} className="card rounded-card-lg p-7 sm:p-8">
              <IconTile icon={Compass} tone="navy" size="lg" />
              <h2 className="mt-5 text-h3 text-navy">Our vision</h2>
              <p className="mt-2 text-body text-muted">{section.vision}</p>
            </Reveal>
          )}
        </section>
      )}

      {values.length > 0 && (
        <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="about-values-title">
          <SectionBg variant="mesh" />
          <div className="container-x relative z-10">
            <Reveal>
              <SectionHeading id="about-values-title" label="Our values" title="What Guides [[Every Decision]]" align="center" />
            </Reveal>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((v, i) => (
                <Reveal as="li" key={`${v.title}-${i}`} delay={i * 70} className="card card-hover flex h-full flex-col items-center card-p text-center">
                  <IconTile icon={v.icon ?? "Sparkles"} tone="orange" size="lg" />
                  <h3 className="mt-4 text-h4 text-navy">{v.title}</h3>
                  {v.description && <p className="mt-2 text-body-sm text-muted">{v.description}</p>}
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {page && (
        <section className="relative overflow-x-clip bg-lavender section-y" aria-labelledby="about-story-title">
          <SectionBg variant="grid" />
          <div className="container-x relative z-10">
            <Reveal className="mx-auto max-w-3xl">
              <SectionHeading id="about-story-title" label="Our story" title={page.title} className="mb-8" />
              <div className="card rounded-card-lg p-6 sm:p-10">
                <Markdown source={page.content} />
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {coverageItems.length > 0 && (
        <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="about-reach-title">
          <SectionBg variant="dots" />
          <div className="container-x relative z-10">
            <Reveal>
              <SectionHeading
                id="about-reach-title"
                label="Where we work"
                title="A Growing Network [[Across India]]"
                description="Every number below is counted from active training centers and verified trainers on this platform — nothing here is a claim we cannot show you."
                align="center"
              />
            </Reveal>
            <ul className="mt-12 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
              {coverageItems.map((c, i) => (
                <Reveal as="li" key={c.label} delay={i * 70} className="card flex flex-col items-center card-p text-center">
                  <span className="font-heading text-4xl font-extrabold text-orange tabular-nums">
                    <CountUp value={c.value} />
                  </span>
                  <span aria-hidden className="mt-3 block h-px w-8 bg-line" />
                  <span className="mt-3 text-body-sm font-semibold text-muted">{c.label}</span>
                </Reveal>
              ))}
            </ul>
            <div className="mt-10 text-center">
              <ButtonLink href="/training-centers" variant="navy" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Find a training center
              </ButtonLink>
            </div>
          </div>
        </section>
      )}

      <ImpactBand stats={impact} />

      <CtaBand
        title="Join the [[EduSkill]] Movement"
        description="Learn a skill, volunteer as a trainer or support a student's journey – there is a place for everyone."
        primary={{ label: "Apply as a Student", href: "/register" }}
        secondary={{ label: "Become a Volunteer Trainer", href: "/become-a-trainer" }}
      />
    </>
  );
}
