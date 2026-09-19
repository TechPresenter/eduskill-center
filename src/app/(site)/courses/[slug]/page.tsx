import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, CalendarDays, Clock, FileCheck, Layers, ListChecks, MapPin, MonitorSmartphone, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, formatINR, titleCase } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { getDocumentTypeNames, listCentersForCourse, publicCourseSelect, toCourseCard } from "@/server/public";
import { trackEvent } from "@/server/analytics";
import { PageHero } from "@/components/site/page-hero";
import { Markdown } from "@/components/site/markdown";
import { SafeImage } from "@/components/site/safe-image";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";
import { applyHref } from "@/components/site/apply-link";

type Props = { params: Promise<{ slug: string }> };

const courseDetailSelect = {
  ...publicCourseSelect,
  description: true,
  eligibility: true,
  minAge: true,
  maxAge: true,
  syllabus: true,
  totalClasses: true,
  certificateEligibility: true,
  minAttendancePct: true,
  passingMarksPct: true,
  requiredDocuments: true,
  seoTitle: true,
  seoDescription: true,
} as const;

async function loadCourse(slug: string) {
  return db.course.findFirst({ where: { slug, status: "ACTIVE", deletedAt: null }, select: courseDetailSelect });
}

interface SyllabusModule {
  module?: number;
  title: string;
  topics?: string[];
}

function toSyllabusModule(item: unknown, index: number): SyllabusModule | null {
  if (typeof item === "string") return item.trim() ? { module: index + 1, title: item } : null;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : "";
    if (!title) return null;
    const topics = Array.isArray(o.topics) ? o.topics.filter((t): t is string => typeof t === "string") : undefined;
    return { module: typeof o.module === "number" ? o.module : index + 1, title, topics };
  }
  return null;
}

function parseSyllabus(raw: unknown): SyllabusModule[] {
  if (!Array.isArray(raw)) return [];
  const out: SyllabusModule[] = [];
  raw.forEach((item, i) => {
    const m = toSyllabusModule(item, i);
    if (m) out.push(m);
  });
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await loadCourse(slug);
  if (!course) return { title: "Course not found" };
  const title = course.seoTitle || course.name;
  const description = course.seoDescription || course.shortDescription || `${course.name} – ${course.durationText}, ${titleCase(course.level)} level ${titleCase(course.mode)} course at EduSkill training centers.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/courses/${course.slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/courses/${course.slug}`), type: "article", images: course.image ? [{ url: course.image }] : undefined },
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const raw = await loadCourse(slug);
  if (!raw) notFound();
  const course = toCourseCard(raw);
  const [documents, centers, user, branding] = await Promise.all([getDocumentTypeNames(raw.requiredDocuments), listCentersForCourse(raw.id), getSessionUser().catch(() => null), getBranding()]);
  void trackEvent({ type: "COURSE_VIEW", refId: raw.id, path: `/courses/${raw.slug}` });
  const syllabus = parseSyllabus(raw.syllabus);
  const apply = applyHref(user, { courseId: raw.id });

  const feeRows = [
    { label: "Course fee", value: course.courseFee },
    { label: "Registration fee", value: course.registrationFee },
    { label: "Exam fee", value: course.examFee },
    { label: "Certificate fee", value: course.certificateFee },
  ].filter((r) => r.value > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.name,
    description: course.shortDescription ?? undefined,
    courseCode: course.code,
    url: absoluteUrl(`/courses/${course.slug}`),
    provider: { "@type": "Organization", name: branding.siteName, url: absoluteUrl("/") },
    educationalLevel: titleCase(course.level),
    timeRequired: course.durationWeeks > 0 ? `P${course.durationWeeks}W` : undefined,
    offers: { "@type": "Offer", price: course.totalFee, priceCurrency: "INR", availability: "https://schema.org/InStock", url: absoluteUrl(`/courses/${course.slug}`) },
    hasCourseInstance: centers.slice(0, 20).map((c) => ({
      "@type": "CourseInstance",
      courseMode: course.mode === "ONLINE" ? "online" : course.mode === "HYBRID" ? "blended" : "onsite",
      location: { "@type": "Place", name: c.name, address: { "@type": "PostalAddress", addressLocality: c.district.name, addressRegion: c.state.name, addressCountry: "IN" } },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero eyebrow={course.category?.name ?? "Course"} title={course.name} description={course.shortDescription ?? undefined} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Courses", href: "/courses" }, { label: course.name }]}>
        <div className="flex flex-col gap-6">
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/85">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange" aria-hidden />
              <dt className="sr-only">Duration</dt>
              <dd>{course.durationText}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-orange" aria-hidden />
              <dt className="sr-only">Level</dt>
              <dd>{titleCase(course.level)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-orange" aria-hidden />
              <dt className="sr-only">Mode</dt>
              <dd>{titleCase(course.mode)}</dd>
            </div>
            {raw.totalClasses > 0 && (
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-orange" aria-hidden />
                <dt className="sr-only">Classes</dt>
                <dd>{raw.totalClasses} classes</dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-white/60 uppercase">Code</span>
              <dd>{course.code}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={apply} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Apply Now
            </ButtonLink>
            <ButtonLink href={`/training-centers?courseId=${course.id}`} size="lg" variant="white" leftIcon={<MapPin className="h-4 w-4" />}>
              Find a Center
            </ButtonLink>
          </div>
        </div>
      </PageHero>

      <section className="container-x grid gap-10 py-14 lg:grid-cols-12 lg:py-20">
        <div className="space-y-12 lg:col-span-8">
          {course.image && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-card-lg bg-lavender">
              <SafeImage src={course.image} alt={course.name} sizes="(max-width: 1024px) 100vw, 800px" priority />
            </div>
          )}

          {raw.description && (
            <div>
              <h2 className="mb-4 text-2xl font-extrabold text-navy">About this course</h2>
              <Markdown source={raw.description} />
            </div>
          )}

          {(raw.eligibility || raw.minAge || raw.maxAge) && (
            <div className="card p-6 sm:p-8">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-navy">
                <Users className="h-5 w-5 text-orange" aria-hidden /> Eligibility
              </h2>
              {raw.eligibility && <p className="mt-3 text-[15px] leading-relaxed text-ink">{raw.eligibility}</p>}
              {(raw.minAge || raw.maxAge) && (
                <p className="mt-3 text-sm text-muted">
                  Age: {raw.minAge ? `${raw.minAge}+` : ""}
                  {raw.minAge && raw.maxAge ? " to " : ""}
                  {raw.maxAge ? `${raw.maxAge} years` : raw.minAge ? " years" : ""}
                </p>
              )}
            </div>
          )}

          {syllabus.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-navy">
                <ListChecks className="h-6 w-6 text-orange" aria-hidden /> Syllabus
              </h2>
              <ol className="space-y-3">
                {syllabus.map((m, i) => (
                  <li key={i} className="card flex gap-4 p-4 sm:p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-light font-heading text-sm font-extrabold text-orange">{String(m.module ?? i + 1).padStart(2, "0")}</span>
                    <div>
                      <h3 className="text-base font-bold text-navy">{m.title}</h3>
                      {m.topics && m.topics.length > 0 && <p className="mt-1 text-sm text-muted">{m.topics.join(" · ")}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy">
                <BadgeCheck className="h-5 w-5 text-orange" aria-hidden /> Certificate eligibility
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink">{raw.certificateEligibility || `Minimum ${raw.minAttendancePct}% attendance and ${raw.passingMarksPct}% in assessments.`}</p>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                <li>Minimum attendance: {raw.minAttendancePct}%</li>
                <li>Passing marks: {raw.passingMarksPct}%</li>
                <li>Certificates carry a unique number verifiable online.</li>
              </ul>
            </div>
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy">
                <FileCheck className="h-5 w-5 text-orange" aria-hidden /> Required documents
              </h2>
              {documents.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {documents.map((d) => (
                    <li key={d.key} className="flex items-start gap-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${d.isRequired ? "bg-orange" : "bg-muted"}`} aria-hidden />
                      <span>
                        <span className="font-medium text-ink">{d.name}</span>
                        {d.description && <span className="block text-xs text-muted">{d.description}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">Documents will be requested during your application.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-navy">
              <MapPin className="h-6 w-6 text-orange" aria-hidden /> Centers offering this course
            </h2>
            {centers.length === 0 ? (
              <p className="card p-6 text-sm text-muted">No active center currently lists this course. Please check back soon or browse all training centers.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {centers.map((c) => (
                  <li key={c.id}>
                    <Link href={`/training-centers/${c.state.slug}/${c.district.slug}/${c.slug}`} className="card card-hover flex h-full flex-col p-5">
                      <span className="flex items-center gap-2">
                        <span className="text-base font-bold text-navy">{c.name}</span>
                        {c.isVerified && <BadgeCheck className="h-4 w-4 text-success" aria-label="Verified" />}
                      </span>
                      <span className="mt-1 text-xs font-semibold text-muted">{c.code}</span>
                      <span className="mt-2 text-sm text-muted">
                        {[c.villageTown, c.block.name, c.district.name, c.state.name].filter(Boolean).join(", ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 bg-navy px-6 py-4 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <DynamicIcon name={course.icon ?? course.category?.icon ?? undefined} className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="text-base font-extrabold text-white">Fee breakdown</h2>
              </div>
              <div className="p-6">
                {feeRows.length === 0 ? (
                  <p className="font-heading text-3xl font-extrabold text-navy">Free</p>
                ) : (
                  <dl className="space-y-2 text-sm">
                    {feeRows.map((r) => (
                      <div key={r.label} className="flex justify-between">
                        <dt className="text-muted">{r.label}</dt>
                        <dd className="font-semibold text-ink">{formatINR(r.value)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-line pt-3 text-base">
                      <dt className="font-bold text-navy">Total</dt>
                      <dd className="font-heading text-xl font-extrabold text-navy">{formatINR(course.totalFee)}</dd>
                    </div>
                  </dl>
                )}
                {course.scholarshipAvailable && (
                  <div className="mt-4 rounded-xl bg-orange-light p-3 text-sm text-ink">
                    <Badge tone="orange" className="mb-1.5">
                      Scholarship available
                    </Badge>
                    <p className="text-xs leading-relaxed text-muted">{course.scholarshipNote || "Need-based and merit scholarships reduce the payable fee. The final amount is decided during application review."}</p>
                    <Link href="/scholarship" className="mt-1 inline-block text-xs font-semibold text-orange">
                      Check eligibility →
                    </Link>
                  </div>
                )}
                <ButtonLink href={apply} fullWidth size="lg" className="mt-5">
                  Apply Now
                </ButtonLink>
                <ButtonLink href={`/training-centers?courseId=${course.id}`} variant="outline" fullWidth className="mt-2">
                  Find a Center
                </ButtonLink>
              </div>
            </div>
            <div className="card p-6 text-sm">
              <h2 className="text-sm font-bold tracking-wide text-muted uppercase">At a glance</h2>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between">
                  <dt className="text-muted">Duration</dt>
                  <dd className="font-medium text-ink">{course.durationText}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Level</dt>
                  <dd className="font-medium text-ink">{titleCase(course.level)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Mode</dt>
                  <dd className="font-medium text-ink">{titleCase(course.mode)}</dd>
                </div>
                {course.category && (
                  <div className="flex justify-between">
                    <dt className="text-muted">Category</dt>
                    <dd className="font-medium text-ink">{course.category.name}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted">Centers</dt>
                  <dd className="font-medium text-ink">{centers.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </section>

      <CtaBand title="Start your [[application]] today" description="Register in minutes, choose this course and the nearest center, and our team will guide you through admission." primary={{ label: "Apply Now", href: apply }} secondary={{ label: "Ask a Question", href: "/contact?type=ADMISSION" }} />
    </>
  );
}
