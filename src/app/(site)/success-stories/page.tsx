import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSection } from "@/lib/cms";
import { absoluteUrl, cn } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { listSuccessStories } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { StoryCard } from "@/components/site/story-card";
import { SectionBg } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";

interface HeadingSection {
  label?: string;
  title: string;
  description?: string;
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** One filter pill. 44px tall on every device — these are the page's main control. */
const CHIP = "ring-focus inline-flex min-h-11 items-center rounded-full border px-5 text-body-sm font-semibold transition-colors duration-micro ease-soft motion-reduce:transition-none";
const CHIP_ON = "border-navy bg-navy text-white";
const CHIP_OFF = "border-line bg-white text-navy hover:border-navy/40 hover:bg-lavender";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSection<HeadingSection>("home.stories");
  const title = "Success Stories";
  const description = s.description ?? stripHighlight(s.title);
  return { title, description, alternates: { canonical: absoluteUrl("/success-stories") }, openGraph: { title, description, url: absoluteUrl("/success-stories"), type: "website" } };
}

export default async function SuccessStoriesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const courseSlug = typeof sp.course === "string" ? sp.course : undefined;
  const [section, stories, courses] = await Promise.all([
    getSection<HeadingSection>("home.stories"),
    listSuccessStories({ courseSlug }),
    db.course.findMany({ where: { status: "ACTIVE", deletedAt: null, successStories: { some: { isPublished: true } } }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  const activeCourse = courses.find((c) => c.slug === courseSlug);

  return (
    <>
      <PageHero eyebrow={section.label} title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Success Stories" }]} />

      <section className="relative overflow-x-clip bg-surface section-y" aria-labelledby="stories-list-title">
        <SectionBg variant="blobs" />
        <div className="container-x relative z-10">
          <h2 id="stories-list-title" className="sr-only">
            Published success stories
          </h2>

          {courses.length > 1 && (
            <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filter stories by course">
              <Link href="/success-stories" className={cn(CHIP, !courseSlug ? CHIP_ON : CHIP_OFF)} aria-current={!courseSlug ? "page" : undefined}>
                All courses
              </Link>
              {courses.map((c) => (
                <Link key={c.slug} href={`/success-stories?course=${encodeURIComponent(c.slug)}`} className={cn(CHIP, courseSlug === c.slug ? CHIP_ON : CHIP_OFF)} aria-current={courseSlug === c.slug ? "page" : undefined}>
                  {c.name}
                </Link>
              ))}
            </nav>
          )}

          {stories.length > 0 && (
            <p className="mb-6 text-body text-muted" aria-live="polite">
              <span className="font-heading font-extrabold text-navy tabular-nums">{stories.length}</span> {stories.length === 1 ? "story" : "stories"}
              {activeCourse ? <> from <span className="font-semibold text-navy">{activeCourse.name}</span></> : null}.
            </p>
          )}

          {stories.length === 0 ? (
            <EmptyState
              className="mx-auto max-w-2xl"
              title={courseSlug ? "No story for this course yet" : "The first stories are still being written"}
              description={
                courseSlug
                  ? "Nobody from this course has shared their story yet. Try another course, or read every story we have."
                  : "As our students finish their training and find work, their stories will be published here in their own words."
              }
              action={
                courseSlug ? (
                  <ButtonLink href="/success-stories" variant="navy">
                    Read all stories
                  </ButtonLink>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <ButtonLink href="/courses" variant="navy">
                      Browse courses
                    </ButtonLink>
                    <ButtonLink href="/training-centers" variant="outline">
                      Find a centre
                    </ButtonLink>
                  </div>
                )
              }
            />
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {stories.map((st, i) => (
                <Reveal as="li" key={st.id} delay={Math.min(i, 5) * 60}>
                  <StoryCard story={st} full />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>

      <CtaBand
        title="Write your own [[success story]]"
        description="Every story here started with a simple registration. Yours can too."
        primary={{ label: "Apply Now", href: "/register" }}
        secondary={{ label: "Browse Courses", href: "/courses" }}
      />
    </>
  );
}
