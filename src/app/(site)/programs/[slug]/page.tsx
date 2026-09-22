import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DynamicIcon } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl, cn } from "@/lib/utils";
import { getProgram, listPrograms, listPublicCourses } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { Markdown, markdownExcerpt } from "@/components/site/markdown";
import { CourseCard } from "@/components/site/course-card";
import { Reveal } from "@/components/site/reveal";
import { Media } from "@/components/site/safe-image";
import { SectionBg, IconTile } from "@/components/site/decor";
import { SectionHeading } from "@/components/site/section-heading";
import { CtaBand } from "@/components/site/cta-band";
import { applyHref } from "@/components/site/apply-link";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) return { title: "Program not found" };
  const description = program.summary || markdownExcerpt(program.content);
  return {
    title: program.title,
    description,
    alternates: { canonical: absoluteUrl(`/programs/${program.slug}`) },
    openGraph: { title: program.title, description, url: absoluteUrl(`/programs/${program.slug}`), type: "article", images: program.image ? [{ url: program.image }] : undefined },
  };
}

export default async function ProgramDetailPage({ params }: Props) {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) notFound();
  const [courses, programs, user] = await Promise.all([listPublicCourses(), listPrograms(), getSessionUser().catch(() => null)]);
  const others = programs.filter((p) => p.id !== program.id).slice(0, 6);

  return (
    <>
      <PageHero eyebrow="Program" title={program.title} description={program.summary} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Programs", href: "/programs" }, { label: program.title }]}>
        <ButtonLink href={applyHref(user)} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
          Apply Now
        </ButtonLink>
      </PageHero>

      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <article className="lg:col-span-8">
            {/* Only when the programme actually has a photo. See the note in events/[slug]. */}
            {program.image && (
              <div className="rounded-card-lg shadow-e1">
                <Media src={program.image} alt={program.title} seed={program.slug} ratio="16x9" priority sizes="(max-width: 1024px) 100vw, 800px" />
              </div>
            )}
            <div className={cn("card rounded-card-lg p-6 sm:p-10", program.image && "mt-8")}>
              {program.content ? <Markdown source={program.content} /> : <p className="text-body-lg text-muted">{program.summary}</p>}
            </div>
          </article>

          <aside className="space-y-5 lg:col-span-4">
            {/* Sticky on desktop so the apply action follows a long read; static on phones. */}
            <div className="card rounded-card-lg card-p lg:sticky lg:top-24">
              <IconTile icon={program.icon ?? "Sparkles"} tone="orange" size="lg" />
              <h2 className="mt-4 text-h3 text-navy">Start with this program</h2>
              <p className="mt-2 text-body text-muted">Register, pick a course and a training centre near you. Scholarship support is assessed during your application.</p>
              <ButtonLink href={applyHref(user)} size="lg" fullWidth className="mt-5">
                Apply now
              </ButtonLink>
              <ButtonLink href="/training-centers" variant="outline" size="lg" fullWidth className="mt-2">
                Find a training centre
              </ButtonLink>
            </div>

            {others.length > 0 && (
              <nav className="card card-p" aria-labelledby="other-programs">
                <h2 id="other-programs" className="text-overline text-muted">
                  Other programs
                </h2>
                <ul className="mt-2 divide-y divide-line">
                  {others.map((p) => (
                    <li key={p.id}>
                      <Link href={`/programs/${p.slug}`} className="ring-focus group flex min-h-11 items-center gap-3 rounded-xs py-3 text-body font-semibold text-navy transition-colors duration-micro hover:text-orange motion-reduce:transition-none">
                        <DynamicIcon name={p.icon ?? undefined} className="h-4 w-4 shrink-0 text-orange" aria-hidden />
                        <span className="min-w-0 flex-1">{p.title}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform duration-micro group-hover:translate-x-0.5 group-hover:text-orange motion-reduce:transition-none" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </aside>
        </div>
      </section>

      {courses.length > 0 && (
        <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="program-courses-title">
          <SectionBg variant="dots" />
          <div className="container-x relative z-10">
            <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading id="program-courses-title" label="Courses" title="Courses You Can [[Join]]" className="max-w-2xl" />
              <ButtonLink href="/courses" variant="outline" className="shrink-0" rightIcon={<ArrowRight className="h-4 w-4" />}>
                All courses
              </ButtonLink>
            </Reveal>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {courses.slice(0, 6).map((c, i) => (
                <Reveal as="li" key={c.id} delay={Math.min(i, 5) * 60}>
                  <CourseCard course={c} applyHref={applyHref(user, { courseId: c.id })} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand
        title="Ready to take the [[first step]]?"
        description="Applications are reviewed by the Foundation and you will be guided at every stage."
        primary={{ label: "Apply Now", href: applyHref(user) }}
        secondary={{ label: "Talk to Us", href: "/contact" }}
      />
    </>
  );
}
