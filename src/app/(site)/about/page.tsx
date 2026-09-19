import type { Metadata } from "next";
import { ArrowRight, Compass, Target } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
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

  return (
    <>
      <PageHero eyebrow={`About ${branding.shortName}`} title={section.heroTitle} description={section.heroDescription} breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]} />

      {(section.mission || section.vision) && (
        <section className="container-x -mt-10 relative z-10 grid gap-6 md:grid-cols-2">
          {section.mission && (
            <Reveal className="card rounded-card-lg p-7 sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-light text-orange">
                <Target className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-extrabold text-navy">Our Mission</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{section.mission}</p>
            </Reveal>
          )}
          {section.vision && (
            <Reveal delay={100} className="card rounded-card-lg p-7 sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-white">
                <Compass className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl font-extrabold text-navy">Our Vision</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{section.vision}</p>
            </Reveal>
          )}
        </section>
      )}

      {values.length > 0 && (
        <section className="bg-white py-16 sm:py-20" aria-labelledby="about-values-title">
          <div className="container-x">
            <Reveal>
              <SectionHeading id="about-values-title" label="Our Values" title="What Guides [[Every Decision]]" align="center" />
            </Reveal>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((v, i) => (
                <Reveal as="li" key={i} delay={i * 70} className="card card-hover p-6 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-light text-orange">
                    <DynamicIcon name={v.icon} className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-navy">{v.title}</h3>
                  {v.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.description}</p>}
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {page && (
        <section className="bg-lavender py-16 sm:py-20" aria-labelledby="about-story-title">
          <div className="container-x">
            <div className="mx-auto max-w-3xl">
              <Reveal>
                <p className="eyebrow mb-3">Our Story</p>
                <h2 id="about-story-title" className="section-title mb-8">
                  {page.title}
                </h2>
                <div className="card rounded-card-lg p-6 sm:p-10">
                  <Markdown source={page.content} />
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {coverageItems.length > 0 && (
        <section className="bg-white py-16 sm:py-20" aria-labelledby="about-reach-title">
          <div className="container-x">
            <Reveal>
              <SectionHeading id="about-reach-title" label="Where We Work" title="A Growing Network [[Across India]]" description="Every number below is counted from active training centers and verified trainers on this platform." align="center" />
            </Reveal>
            <ul className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-4">
              {coverageItems.map((c, i) => (
                <Reveal as="li" key={c.label} delay={i * 70} className="card p-6 text-center">
                  <span className="block font-heading text-4xl font-extrabold text-orange tabular-nums">
                    <CountUp value={c.value} />
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-muted">{c.label}</span>
                </Reveal>
              ))}
            </ul>
            <div className="mt-8 text-center">
              <ButtonLink href="/training-centers" variant="navy" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Find a training center
              </ButtonLink>
            </div>
          </div>
        </section>
      )}

      <ImpactBand stats={impact} />

      <CtaBand title="Join the [[EduSkill]] Movement" description="Learn a skill, volunteer as a trainer or support a student's journey – there is a place for everyone." primary={{ label: "Apply as a Student", href: "/register" }} secondary={{ label: "Become a Volunteer Trainer", href: "/become-a-trainer" }} />
    </>
  );
}
