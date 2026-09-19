import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DynamicIcon } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/utils";
import { getProgram, listPrograms, listPublicCourses } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { Markdown, markdownExcerpt } from "@/components/site/markdown";
import { CourseCard } from "@/components/site/course-card";
import { Reveal } from "@/components/site/reveal";
import { SafeImage } from "@/components/site/safe-image";
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

      <section className="container-x grid gap-10 py-14 lg:grid-cols-12 lg:py-20">
        <article className="lg:col-span-8">
          {program.image && (
            <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-card-lg bg-lavender">
              <SafeImage src={program.image} alt={program.title} sizes="(max-width: 1024px) 100vw, 800px" />
            </div>
          )}
          {program.content ? <Markdown source={program.content} /> : <p className="text-muted">{program.summary}</p>}
        </article>
        <aside className="space-y-6 lg:col-span-4">
          <div className="card p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-light text-orange">
              <DynamicIcon name={program.icon ?? undefined} className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-extrabold text-navy">Start with this program</h2>
            <p className="mt-1.5 text-sm text-muted">Register, pick a course and a training center near you. Scholarship support is assessed during your application.</p>
            <ButtonLink href={applyHref(user)} fullWidth className="mt-5">
              Apply Now
            </ButtonLink>
            <ButtonLink href="/training-centers" variant="outline" fullWidth className="mt-2">
              Find a Training Center
            </ButtonLink>
          </div>
          {others.length > 0 && (
            <nav className="card p-6" aria-labelledby="other-programs">
              <h2 id="other-programs" className="text-sm font-bold tracking-wide text-muted uppercase">
                Other programs
              </h2>
              <ul className="mt-3 divide-y divide-line">
                {others.map((p) => (
                  <li key={p.id}>
                    <Link href={`/programs/${p.slug}`} className="flex items-center gap-3 py-2.5 text-sm font-semibold text-navy hover:text-orange">
                      <DynamicIcon name={p.icon ?? undefined} className="h-4 w-4 text-orange" aria-hidden />
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
      </section>

      {courses.length > 0 && (
        <section className="bg-lavender py-16 sm:py-20" aria-labelledby="program-courses-title">
          <div className="container-x">
            <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-3">Courses</p>
                <h2 id="program-courses-title" className="section-title">
                  Courses you can join
                </h2>
              </div>
              <ButtonLink href="/courses" variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />}>
                All courses
              </ButtonLink>
            </Reveal>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.slice(0, 6).map((c, i) => (
                <Reveal as="li" key={c.id} delay={Math.min(i, 5) * 60}>
                  <CourseCard course={c} applyHref={applyHref(user, { courseId: c.id })} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand title="Ready to take the [[first step]]?" description="Applications are reviewed by the Foundation and you will be guided at every stage." primary={{ label: "Apply Now", href: applyHref(user) }} secondary={{ label: "Talk to Us", href: "/contact" }} />
    </>
  );
}
