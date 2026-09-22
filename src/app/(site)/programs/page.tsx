import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { getSection } from "@/lib/cms";
import { absoluteUrl } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { listPrograms } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { ProgramCard } from "@/components/site/program-card";
import { SectionBg } from "@/components/site/decor";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";

interface HeadingSection {
  label?: string;
  title: string;
  description?: string;
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSection<HeadingSection>("home.programs");
  const title = "Programs";
  const description = s.description ?? stripHighlight(s.title);
  return { title, description, alternates: { canonical: absoluteUrl("/programs") }, openGraph: { title, description, url: absoluteUrl("/programs"), type: "website" } };
}

export default async function ProgramsPage() {
  const [section, programs] = await Promise.all([getSection<HeadingSection>("home.programs"), listPrograms()]);

  return (
    <>
      <PageHero eyebrow={section.label} title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Programs" }]} />

      <section className="relative overflow-x-clip bg-surface section-y" aria-labelledby="programs-list-title">
        <SectionBg variant="blobs" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading
              id="programs-list-title"
              label="What we run"
              title="Every Programme We [[Offer]]"
              description="Each programme groups the courses that lead to one kind of livelihood. Open one to see its courses, who it is for and how to apply."
              align="center"
            />
          </Reveal>
          {programs.length === 0 ? (
            <EmptyState
              className="mx-auto mt-12 max-w-xl"
              title="Programmes are being published"
              description="Our programme list is being finalised. In the meantime you can browse the full course catalogue or ask our team what fits you."
              action={
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href="/courses" variant="navy">
                    Browse courses
                  </ButtonLink>
                  <ButtonLink href="/contact" variant="outline">
                    Ask our team
                  </ButtonLink>
                </div>
              }
            />
          ) : (
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
              {programs.map((p, i) => (
                <Reveal as="li" key={p.id} delay={Math.min(i, 6) * 50}>
                  <ProgramCard program={p} />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>

      {programs.length > 0 && (
        <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="programs-help-title">
          <SectionBg variant="grid" />
          <div className="container-x relative z-10">
            <div className="card rounded-card-lg mx-auto flex max-w-3xl flex-col items-center gap-5 p-8 text-center sm:p-10">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender text-navy">
                <Compass className="h-7 w-7" aria-hidden />
              </span>
              <h2 id="programs-help-title" className="text-h2 text-navy">
                Not sure which one is yours?
              </h2>
              <p className="max-w-xl text-body-lg text-muted">
                Tell us what you want to do for a living and where you live. We will point you at the programme, the course and the nearest centre that fit.
              </p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <ButtonLink href="/contact?type=ADMISSION" size="lg">
                  Ask our team
                </ButtonLink>
                <ButtonLink href="/training-centers" size="lg" variant="outline">
                  Find a centre
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      )}

      <CtaBand
        title="Not sure which program [[fits you]]?"
        description="Talk to our team or browse the course catalogue to find practical, job-ready training near you."
        primary={{ label: "Browse Courses", href: "/courses" }}
        secondary={{ label: "Contact Us", href: "/contact" }}
      />
    </>
  );
}
