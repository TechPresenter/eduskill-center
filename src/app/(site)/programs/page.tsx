import type { Metadata } from "next";
import { getSection } from "@/lib/cms";
import { absoluteUrl } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { listPrograms } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { ProgramCard } from "@/components/site/program-card";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";
import { EmptyState } from "@/components/ui/feedback";

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
      <section className="bg-lavender py-16 sm:py-20">
        <div className="container-x">
          {programs.length === 0 ? (
            <EmptyState title="Programs coming soon" description="Our programs are being published. Please check back shortly." />
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {programs.map((p, i) => (
                <Reveal as="li" key={p.id} delay={Math.min(i, 6) * 50}>
                  <ProgramCard program={p} />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>
      <CtaBand title="Not sure which program [[fits you]]?" description="Talk to our team or browse the course catalogue to find practical, job-ready training near you." primary={{ label: "Browse Courses", href: "/courses" }} secondary={{ label: "Contact Us", href: "/contact" }} />
    </>
  );
}
