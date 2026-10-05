import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, Clock, Layers, MapPin, MonitorSmartphone, Tag } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, titleCase } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { getCoursePageData } from "@/server/course-cms";
import { getDocumentTypeNames, listCentersForCourse } from "@/server/public";
import { trackEvent } from "@/server/analytics";
import { PageHero } from "@/components/site/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";
import { applyHref } from "@/components/site/apply-link";
import { markdownExcerpt } from "@/components/site/markdown";
import { CourseSection } from "@/components/site/course/course-section";
import { CourseBanner } from "@/components/site/course/course-banner";
import { CourseOverview, type CourseFact } from "@/components/site/course/course-overview";
import { CourseFee, type FeeBreakdownRow } from "@/components/site/course/course-fee";
import { CourseCurriculum } from "@/components/site/course/course-curriculum";
import { CourseSyllabus, parseSyllabus } from "@/components/site/course/course-syllabus";
import { CourseBenefits, courseBenefits } from "@/components/site/course/course-benefits";
import { CourseInstructor } from "@/components/site/course/course-instructor";
import { CourseMaterials, type CourseMaterialItem } from "@/components/site/course/course-materials";
import { CourseFaqs } from "@/components/site/course/course-faqs";
import { CourseEnrol, type EnrolCentre } from "@/components/site/course/course-enrol";
import { curriculumStats, flattenCurriculum, formatMinutes, resolveFileLink, resolveImageSrc, toPublicCurriculum } from "@/components/site/course/public-view";

/**
 * The public course page.
 *
 * Every section is driven by what the Foundation configured in the Course CMS, in the order the
 * page reads: banner, overview, fee, content, benefits, instructor, study material, FAQs, enrol.
 * A section with nothing behind it is not rendered — a course with no curriculum and no FAQ still
 * gets a complete page rather than empty headings.
 *
 * ONE aggregate read: `getCoursePageData()` fetches the course, curriculum, fee plan, FAQs and both
 * media sets together, and `cache()` shares that single call between `generateMetadata()` and the
 * render. The few extra reads below are other modules (centres, document types, course-level study
 * material), batched on the pooled client.
 *
 * Not shown yet, on purpose: course offers (billing does not apply them, so the page must not
 * advertise a price nobody is charged) and the assigned trainers (they have not agreed to a public
 * profile). The instructor section shows only the image the Foundation uploads.
 */
const loadCourse = cache((slug: string) => getCoursePageData(slug));

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadCourse(slug);
  if (!data) return { title: "Course not found" };
  const { course } = data;
  const title = course.seoTitle || course.name;
  const description =
    course.seoDescription ||
    course.shortDescription ||
    `${course.name} – ${course.durationText}, ${titleCase(course.level)} level ${titleCase(course.mode)} course at EduSkill training centers.`;
  const image = resolveImageSrc(course.bannerImage) ?? resolveImageSrc(course.image);
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/courses/${course.slug}`) },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/courses/${course.slug}`),
      type: "article",
      images: image ? [{ url: absoluteUrl(image) }] : undefined,
    },
  };
}

export default async function CourseDetailPage({ params }: PageProps<"/courses/[slug]">) {
  const { slug } = await params;
  const data = await loadCourse(slug);
  if (!data) notFound();
  const { course, curriculum, feePlan, fee, feeFromPlan, faqs, gallery, promotional } = data;

  const [documents, centres, user, branding, studyMaterials] = await Promise.all([
    getDocumentTypeNames(course.requiredDocuments),
    listCentersForCourse(course.id),
    getSessionUser().catch(() => null),
    getBranding(),
    // Course-level material only: a trainer's upload belongs to their batch (batchId set) and is for
    // that batch's students, not for anonymous visitors.
    db.studyMaterial.findMany({
      where: { courseId: course.id, batchId: null, isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { id: true, title: true, description: true, fileUrl: true, fileType: true },
    }),
  ]);

  void trackEvent({ type: "COURSE_VIEW", refId: course.id, path: `/courses/${course.slug}` });

  // ── The gate: paid material loses its URLs here, before any component sees the tree ──
  const nodes = toPublicCurriculum(curriculum);
  const stats = curriculumStats(nodes);
  const flatNodes = flattenCurriculum(nodes);
  const syllabus = nodes.length === 0 ? parseSyllabus(course.syllabus) : [];

  const apply = applyHref(user, { courseId: course.id });
  const centersHref = `/training-centers?courseId=${course.id}`;
  const signInHref = `/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`;

  // ── Media ──
  const bannerSrc = resolveImageSrc(course.bannerImage) ?? resolveImageSrc(course.image);
  const promoVideo = resolveFileLink(course.promoVideoUrl);
  // A private upload is skipped: an anonymous visitor cannot play a file the file route refuses.
  const videoSrc = promoVideo && !promoVideo.requiresLogin ? promoVideo.href : null;
  const posterSrc = resolveImageSrc(course.videoThumbnail) ?? bannerSrc;
  const galleryImages = gallery.flatMap((m) => {
    const src = resolveImageSrc(m.url);
    return src ? [{ id: m.id, src, alt: m.alt, caption: m.caption }] : [];
  });
  const promoImages = promotional.flatMap((m) => {
    const src = resolveImageSrc(m.url);
    return src ? [{ id: m.id, src, alt: m.alt, caption: m.caption }] : [];
  });

  // ── Overview facts: every one of them a column on the course record ──
  const facts: CourseFact[] = [
    { icon: Clock, label: "Duration", value: course.durationText },
    { icon: Layers, label: "Level", value: titleCase(course.level) },
    { icon: MonitorSmartphone, label: "Mode", value: titleCase(course.mode) },
  ];
  if (course.totalClasses > 0) facts.push({ icon: CalendarDays, label: "Classes", value: `${course.totalClasses} classes` });
  if (stats.totalMinutes > 0) facts.push({ icon: BookOpen, label: "Course content", value: formatMinutes(stats.totalMinutes) });
  if (course.category) facts.push({ icon: Tag, label: "Category", value: course.category.name });

  const ageText =
    course.minAge || course.maxAge
      ? `Age: ${course.minAge ? `${course.minAge}+` : ""}${course.minAge && course.maxAge ? " to " : ""}${course.maxAge ? `${course.maxAge} years` : course.minAge ? " years" : ""}`
      : null;

  // ── Fee: the plan is the published price; a course with NO plan shows what admission bills.
  //    Either way the one-time exam and certificate fees admission also bills are listed, and
  //    without a plan the rows add up to the total. A single registration-only row (Class 1–4) is
  //    already the headline, so it is not repeated. ──
  const billedRows: FeeBreakdownRow[] = feeFromPlan
    ? [
        { label: "Exam fee", value: course.examFee },
        { label: "Certificate fee", value: course.certificateFee },
      ]
    : [
        { label: "Course fee", value: course.courseFee },
        { label: "Registration fee", value: course.registrationFee },
        { label: "Exam fee", value: course.examFee },
        { label: "Certificate fee", value: course.certificateFee },
      ];
  const nonZeroRows = billedRows.filter((r) => r.value > 0);
  const breakdown = !feeFromPlan && nonZeroRows.length === 1 ? [] : nonZeroRows;
  const total = !feeFromPlan && breakdown.length > 1 ? course.totalFee : null;

  // ── Study material: curriculum attachments first, then the course library ──
  const materials: CourseMaterialItem[] = [];
  for (const n of flatNodes) {
    if (!n.attached.material && !n.attached.document) continue;
    const link = n.preview?.material ?? n.preview?.document ?? null;
    const openable = link && !link.requiresLogin ? link : null;
    materials.push({
      id: `node-${n.id}`,
      title: n.title,
      description: n.description,
      meta: n.isFreePreview ? "Preview" : titleCase(n.kind),
      link: openable,
      locked: !openable,
      signInOnly: Boolean(link?.requiresLogin),
    });
  }
  for (const m of studyMaterials) {
    const link = resolveFileLink(m.fileUrl);
    const openable = link && !link.requiresLogin ? link : null;
    materials.push({
      id: m.id,
      title: m.title,
      description: m.description,
      meta: m.fileType ? m.fileType.toUpperCase() : null,
      link: openable,
      locked: !openable,
      signInOnly: Boolean(link?.requiresLogin),
    });
  }

  const benefits = courseBenefits({
    mode: course.mode,
    durationText: course.durationText,
    totalClasses: course.totalClasses,
    certificateEligibility: course.certificateEligibility,
    minAttendancePct: course.minAttendancePct,
    passingMarksPct: course.passingMarksPct,
    scholarshipAvailable: course.scholarshipAvailable,
    scholarshipNote: course.scholarshipNote,
    centerCount: centres.length,
    materialCount: materials.length,
    freePreviewCount: stats.freePreviews,
    isFree: fee.isFree,
  });

  const instructorSrc = resolveImageSrc(course.instructorImage);

  const enrolCentres: EnrolCentre[] = centres.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    href: `/training-centers/${c.state.slug}/${c.district.slug}/${c.slug}`,
    location: [c.villageTown, c.block.name, c.district.name, c.state.name].filter(Boolean).join(", "),
    isVerified: c.isVerified,
  }));

  // ── Structured data: the Course graph the page already published, extended with the curriculum
  //    the CMS now holds, the published price and a FAQ graph when there are questions. ──
  const courseJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.name,
    description: course.shortDescription ?? undefined,
    courseCode: course.code,
    url: absoluteUrl(`/courses/${course.slug}`),
    image: bannerSrc ? absoluteUrl(bannerSrc) : undefined,
    provider: { "@type": "Organization", name: branding.siteName, url: absoluteUrl("/") },
    educationalLevel: titleCase(course.level),
    timeRequired: course.durationWeeks > 0 ? `P${course.durationWeeks}W` : undefined,
    offers: {
      "@type": "Offer",
      // What admission collects without a plan; the plan's published amount when there is one.
      price: feeFromPlan ? (fee.amount ?? course.totalFee) : course.totalFee,
      priceCurrency: fee.currency,
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/courses/${course.slug}`),
    },
    ...(nodes.length > 0
      ? { syllabusSections: nodes.map((n) => ({ "@type": "Syllabus", name: n.title, description: n.description ?? undefined })) }
      : {}),
    hasCourseInstance: centres.slice(0, 20).map((c) => ({
      "@type": "CourseInstance",
      courseMode: course.mode === "ONLINE" ? "online" : course.mode === "HYBRID" ? "blended" : "onsite",
      location: { "@type": "Place", name: c.name, address: { "@type": "PostalAddress", addressLocality: c.district.name, addressRegion: c.state.name, addressCountry: "IN" } },
    })),
  };
  const jsonLd: Record<string, unknown>[] = [courseJsonLd];
  if (faqs.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      url: absoluteUrl(`/courses/${course.slug}`),
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: markdownExcerpt(f.answer, 2000) } })),
    });
  }

  const hasContent = nodes.length > 0 || syllabus.length > 0;

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHero
        eyebrow={course.category?.name ?? "Course"}
        title={course.name}
        description={course.shortDescription ?? undefined}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Courses", href: "/courses" }, { label: course.name }]}
      >
        <div className="flex flex-col gap-6">
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-body text-white/85">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-on-navy" aria-hidden />
              <dt className="sr-only">Duration</dt>
              <dd>{course.durationText}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-orange-on-navy" aria-hidden />
              <dt className="sr-only">Level</dt>
              <dd>{titleCase(course.level)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-orange-on-navy" aria-hidden />
              <dt className="sr-only">Mode</dt>
              <dd>{titleCase(course.mode)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-overline text-white/60">{fee.label}</dt>
              <dd className="font-semibold">{fee.text}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={apply} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Enrol Now
            </ButtonLink>
            <ButtonLink href={centersHref} size="lg" variant="white" leftIcon={<MapPin className="h-4 w-4" />}>
              Find a Center
            </ButtonLink>
          </div>
        </div>
      </PageHero>

      <CourseBanner title={course.name} seed={course.slug} bannerSrc={bannerSrc} videoSrc={videoSrc} posterSrc={posterSrc} />

      <CourseSection id="course-overview" label="Overview" title="Course [[overview]]" tone="white">
        <CourseOverview
          description={course.description}
          summary={course.shortDescription}
          facts={facts}
          eligibility={course.eligibility}
          ageText={ageText}
          gallery={galleryImages}
          seed={course.slug}
        />
      </CourseSection>

      <CourseSection id="course-fee" label="Fees" title="What you [[pay]]" tone="lavender">
        <CourseFee
          fee={fee}
          offer={null}
          planNote={feeFromPlan ? (feePlan?.note ?? null) : null}
          breakdown={breakdown}
          total={total}
          scholarshipNote={course.scholarshipAvailable ? course.scholarshipNote || "Need-based and merit scholarships reduce the payable fee. The final amount is decided during application review." : null}
          applyHref={apply}
          centersHref={centersHref}
          promotional={promoImages}
          seed={course.slug}
        />
      </CourseSection>

      {hasContent && (
        <CourseSection
          id="course-content"
          label="Curriculum"
          title="Course [[content]]"
          tone="white"
          aside={
            nodes.length > 0 ? (
              <p className="text-body-sm text-muted">
                <span className="font-semibold text-ink tabular-nums">{stats.sections}</span> sections ·{" "}
                <span className="font-semibold text-ink tabular-nums">{stats.lessons}</span> lessons
                {stats.totalMinutes > 0 && <> · {formatMinutes(stats.totalMinutes)}</>}
                {stats.freePreviews > 0 && (
                  <>
                    {" "}
                    · <span className="font-semibold text-success-dark tabular-nums">{stats.freePreviews}</span> open to preview
                  </>
                )}
              </p>
            ) : undefined
          }
        >
          {nodes.length > 0 ? <CourseCurriculum nodes={nodes} signInHref={signInHref} /> : <CourseSyllabus modules={syllabus} />}
        </CourseSection>
      )}

      {benefits.length > 0 && (
        <CourseSection id="course-benefits" label="Benefits" title="What you [[get]]" tone="lavender">
          <CourseBenefits benefits={benefits} />
        </CourseSection>
      )}

      {instructorSrc && (
        <CourseSection id="course-instructor" label="Instructor" title="Who [[teaches]] you" tone="white">
          <CourseInstructor imageSrc={instructorSrc} trainers={[]} courseName={course.name} seed={course.slug} />
        </CourseSection>
      )}

      {materials.length > 0 && (
        <CourseSection
          id="course-material"
          label="Study material"
          title="Notes and [[resources]]"
          description="Course files are served through EduSkill with the same access check as the student portal."
          tone="lavender"
        >
          <CourseMaterials items={materials} signInHref={signInHref} />
        </CourseSection>
      )}

      {faqs.length > 0 && (
        <CourseSection id="course-faq" label="Questions" title="Frequently asked [[questions]]" tone="white">
          <CourseFaqs faqs={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))} />
        </CourseSection>
      )}

      <CourseSection id="course-enrol" label="Enrol now" title={`Join the next [[${course.name}]] batch`} tone="surface">
        <CourseEnrol fee={fee} applyHref={apply} centersHref={centersHref} centres={enrolCentres} documents={documents} courseName={course.name} />
      </CourseSection>

      <CtaBand
        title="Start your [[application]] today"
        description="Register in minutes, choose this course and the nearest center, and our team will guide you through admission."
        primary={{ label: "Enrol Now", href: apply }}
        secondary={{ label: "Ask a Question", href: "/contact?type=ADMISSION" }}
      />

      {/* Phone + tablet conversion bar. StickyActionBar publishes its height as --sticky-bar-h, which
          the chat launcher and the Toaster both read, so the three can never overlap. Hidden at lg,
          where the fee card and the enrol section carry the button. */}
      <StickyActionBar desktop="hidden" innerClassName="justify-between">
        <span className="min-w-0">
          <span className="block text-overline text-muted">{fee.label}</span>
          <span className="block truncate text-h4 text-navy tabular-nums">{fee.text}</span>
        </span>
        <ButtonLink href={apply} size="md" className="shrink-0" rightIcon={<ArrowRight className="h-4 w-4" />}>
          Enrol Now
        </ButtonLink>
      </StickyActionBar>
    </>
  );
}
