import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSection } from "@/lib/cms";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { listPublicCourses } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { CourseCatalog } from "@/components/site/course-catalog";
import { CtaBand } from "@/components/site/cta-band";
import { applyHref } from "@/components/site/apply-link";

interface HeadingSection {
  label?: string;
  title: string;
  description?: string;
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSection<HeadingSection>("home.courses");
  const title = "Courses";
  const description = s.description ?? stripHighlight(s.title);
  return { title, description, alternates: { canonical: absoluteUrl("/courses") }, openGraph: { title, description, url: absoluteUrl("/courses"), type: "website" } };
}

export default async function CoursesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialCategory = typeof sp.category === "string" ? sp.category : undefined;
  const [section, courses, categories, user] = await Promise.all([
    getSection<HeadingSection>("home.courses"),
    listPublicCourses(),
    db.courseCategory.findMany({ where: { isActive: true, courses: { some: { status: "ACTIVE", deletedAt: null } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } }),
    getSessionUser().catch(() => null),
  ]);
  const applyHrefs = Object.fromEntries(courses.map((c) => [c.id, applyHref(user, { courseId: c.id })]));

  return (
    <>
      <PageHero eyebrow={section.label} title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Courses" }]} />
      <section className="bg-white section-y">
        <div className="container-x">
          {/* Keyed so a header link from /courses?category=a to ?category=b re-applies the filter. */}
          <CourseCatalog key={initialCategory ?? "all"} courses={courses} categories={categories} applyHrefs={applyHrefs} initialCategory={initialCategory} />
        </div>
      </section>
      <CtaBand title="Need help choosing a [[course]]?" description="Our team can suggest the right course based on your background and the centers near you." primary={{ label: "Contact Us", href: "/contact?type=ADMISSION" }} secondary={{ label: "Find a Training Center", href: "/training-centers" }} />
    </>
  );
}
