import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSection } from "@/lib/cms";
import { absoluteUrl, cn } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { EmptyState } from "@/components/ui/feedback";
import { listSuccessStories } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { StoryCard } from "@/components/site/story-card";
import { Reveal } from "@/components/site/reveal";
import { CtaBand } from "@/components/site/cta-band";

interface HeadingSection {
  label?: string;
  title: string;
  description?: string;
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

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

  return (
    <>
      <PageHero eyebrow={section.label} title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Success Stories" }]} />
      <section className="bg-lavender py-14 sm:py-20">
        <div className="container-x">
          {courses.length > 1 && (
            <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filter by course">
              <Link href="/success-stories" className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", !courseSlug ? "bg-navy text-white" : "bg-white text-navy hover:bg-navy-soft")} aria-current={!courseSlug ? "page" : undefined}>
                All courses
              </Link>
              {courses.map((c) => (
                <Link key={c.slug} href={`/success-stories?course=${encodeURIComponent(c.slug)}`} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", courseSlug === c.slug ? "bg-navy text-white" : "bg-white text-navy hover:bg-navy-soft")} aria-current={courseSlug === c.slug ? "page" : undefined}>
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
          {stories.length === 0 ? (
            <EmptyState title="No stories yet" description={courseSlug ? "No published story for this course yet." : "Success stories will be published here as our students complete their training."} />
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {stories.map((st, i) => (
                <Reveal as="li" key={st.id} delay={Math.min(i, 5) * 60}>
                  <StoryCard story={st} full />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>
      <CtaBand title="Write your own [[success story]]" description="Every story here started with a simple registration. Yours can too." primary={{ label: "Apply Now", href: "/register" }} secondary={{ label: "Browse Courses", href: "/courses" }} />
    </>
  );
}
