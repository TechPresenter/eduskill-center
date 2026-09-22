import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, Building2, ClipboardList, Compass, FileSignature, GraduationCap, HandCoins, Landmark, Layers, Map, MapPin, Presentation, Users, type LucideProps } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Highlight, stripHighlight } from "@/components/ui/highlight";
import { Carousel, CarouselSlide } from "@/components/ui/carousel";
import { getBranding, getPublicSettings, getSetting } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl, cn, formatINR } from "@/lib/utils";
import { getHomepageData } from "@/server/public";
import { Hero, type HeroSection } from "@/components/site/hero";
import { TrustStrip } from "@/components/site/trust-strip";
import { SectionHeading } from "@/components/site/section-heading";
import { IconTile, SectionBg, SectionDivider } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { ProgramCard } from "@/components/site/program-card";
import { CourseCard, CourseCardCompact } from "@/components/site/course-card";
import { CenterCardCompact } from "@/components/site/center-card";
import { StoryCard } from "@/components/site/story-card";
import { CenterSearchForm } from "@/components/site/center-search-form";
import { CenterMap } from "@/components/site/center-map";
import { ImpactBand } from "@/components/site/impact-band";
import { CtaBand } from "@/components/site/cta-band";
import { CountUp } from "@/components/site/count-up";
import { JsonLd } from "@/components/site/json-ld";
import { applyHref } from "@/components/site/apply-link";
import { ListGroup, ListRow } from "@/components/ui/list";
import { HomeSearchBar } from "@/components/site/home/home-search-bar";
import { QuickActions, type QuickAction } from "@/components/site/home/quick-actions";
import { HomeRail } from "@/components/site/home/home-rail";
import { ImpactChips } from "@/components/site/home/impact-chips";

interface Feature {
  icon?: string;
  title: string;
  description?: string;
}
interface HeadingSection {
  label?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}
interface AboutSection extends HeadingSection {
  features?: Feature[];
}
interface ProcessSection extends HeadingSection {
  steps?: { title: string; description?: string }[];
}
interface WhySection extends HeadingSection {
  features?: Feature[];
}
interface CtaSection {
  title: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

/**
 * Marks for the admission-process steps. CMS steps carry no icon field, so these are positional and
 * deliberately generic — discover, locate, apply, begin — which is the shape of the flow whatever an
 * editor renames the steps to. Meaning always stays in the step title: the tile is decorative and the
 * ordinal is already carried by the <ol>.
 */
const PROCESS_ICONS: React.ComponentType<LucideProps>[] = [Compass, MapPin, ClipboardList, GraduationCap];

/**
 * Eyebrow label with a single decorative emoji. The emoji is `aria-hidden`, so assistive tech reads the
 * label text only and the emoji never carries meaning of its own.
 */
function Eyebrow({ emoji, center, children }: { emoji: string; center?: boolean; children: string }) {
  return (
    <p className={cn("eyebrow mb-3", center && "justify-center")}>
      <span aria-hidden="true" className="text-[15px] leading-none">
        {emoji}
      </span>
      {children}
    </p>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPublicSettings();
  const title = String(s["seo.defaultTitle"] ?? "EduSkill India Foundation");
  const description = String(s["seo.defaultDescription"] ?? "");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: absoluteUrl("/") },
    openGraph: { title, description, url: absoluteUrl("/"), type: "website" },
  };
}

export default async function HomePage() {
  const [data, branding, user, registrationOpen] = await Promise.all([
    getHomepageData(),
    getBranding(),
    getSessionUser().catch(() => null),
    getSetting<boolean>("admissions.registrationOpen").catch(() => true),
  ]);
  // Verified first, eight at most (listHomeCenters), for the phone "Training centres" rail.
  const railCenters = data.homeCenters;
  const s = data.sections;
  const hero = s["home.hero"] as unknown as HeroSection;
  const trust = s["home.trust"] as { heading?: string; subheading?: string; showWhenEmpty?: boolean };
  const about = s["home.about"] as unknown as AboutSection;
  const programs = s["home.programs"] as unknown as HeadingSection;
  const courses = s["home.courses"] as unknown as HeadingSection;
  const centerSearch = s["home.centerSearch"] as unknown as HeadingSection;
  const process = s["home.process"] as unknown as ProcessSection;
  const fees = s["home.fees"] as unknown as HeadingSection;
  const why = s["home.why"] as unknown as WhySection;
  const impact = s["home.impact"] as unknown as HeadingSection;
  const stories = s["home.stories"] as unknown as HeadingSection;
  const cta = s["home.cta"] as unknown as CtaSection;

  const coverageItems = [
    { label: "States", value: data.coverage.states, icon: Map },
    { label: "Districts", value: data.coverage.districts, icon: Landmark },
    { label: "Blocks", value: data.coverage.blocks, icon: MapPin },
    { label: "Training Centers", value: data.coverage.centers, icon: Building2 },
    { label: "Students", value: data.coverage.students, icon: Users },
    { label: "Trainers", value: data.coverage.trainers, icon: GraduationCap },
  ];

  // Coverage the Foundation does not have yet is left out rather than printed as a zero.
  const coverageShown = coverageItems.filter((c) => c.value > 0);

  /*
   * Phone home screen quick actions. "Apply Now" follows the header's Apply button: registration while
   * it is open (the register page bounces signed-in users into their application); signed-in users go
   * straight to the application. When admissions are closed the tile becomes Programs instead.
   */
  const applyTarget = user ? applyHref(user) : registrationOpen !== false ? "/register" : null;
  const quickActions: QuickAction[] = [
    { label: "Find a Centre", href: "/training-centers", icon: MapPin, tone: "orange" },
    { label: "Courses", href: "/courses", icon: BookOpen, tone: "info" },
    applyTarget ? { label: "Apply Now", href: applyTarget, icon: FileSignature, tone: "navy-solid" } : { label: "Programs", href: "/programs", icon: Layers, tone: "navy" },
    { label: "Scholarship", href: "/scholarship", icon: HandCoins, tone: "success" },
    { label: "Become a Trainer", href: "/become-a-trainer", icon: Presentation, tone: "warning" },
    { label: "Verify Certificate", href: "/verify-certificate", icon: BadgeCheck, tone: "navy" },
  ];

  // Impact chips: the Foundation's own impact stats; before any exist, the real coverage counts.
  const reachChips =
    data.impact.length > 0
      ? data.impact.map((st) => ({ key: st.key, value: st.value, suffix: st.suffix, label: st.label }))
      : coverageShown.map((c) => ({ key: c.label, value: c.value, label: c.value === 1 ? c.label.replace(/s$/, "") : c.label }));

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: branding.siteName,
    alternateName: branding.shortName,
    url: absoluteUrl("/"),
    ...(branding.logoUrl ? { logo: absoluteUrl(branding.logoUrl) } : {}),
    slogan: branding.tagline || undefined,
    email: branding.contact.email || undefined,
    telephone: branding.contact.phone || undefined,
    address: branding.contact.address ? { "@type": "PostalAddress", streetAddress: branding.contact.address, addressCountry: "IN" } : undefined,
    sameAs: Object.values(branding.social).filter(Boolean),
  };

  return (
    <>
      <JsonLd data={orgJsonLd} />

      <Hero section={hero} impact={data.impact} />

      {/*
        Phone / tablet home screen (below lg): search, quick actions, swipe rails and reach chips, in
        that order, directly under the compact hero. The search bar overlaps the hero's bottom edge like
        an app's header search. Desktop keeps the website layout further down instead.
      */}
      <div className="bg-surface pb-8 lg:hidden">
        <div className="container-x relative z-10 space-y-6">
          <HomeSearchBar className="-mt-7" />
          <QuickActions actions={quickActions} />

          {data.featuredCourses.length > 0 && (
            <HomeRail id="home-rail-courses" title="Popular courses" seeAllHref="/courses" seeAllLabel="courses">
              {data.featuredCourses.map((c) => (
                <CourseCardCompact key={c.id} course={c} />
              ))}
            </HomeRail>
          )}

          {railCenters.length > 0 && (
            <HomeRail id="home-rail-centres" title="Training centres" seeAllHref="/training-centers" seeAllLabel="training centres">
              {railCenters.map((c) => (
                <CenterCardCompact key={c.id} center={c} />
              ))}
            </HomeRail>
          )}

          <ImpactChips chips={reachChips} />
        </div>
      </div>

      <TrustStrip section={trust} partners={data.partners} />

      {/* About — soft brand wash, then a wave into the lavender programmes band. */}
      <section className="relative overflow-hidden bg-white section-y" aria-labelledby="home-about-title">
        <SectionBg variant="mesh" className="opacity-70" />
        <div className="relative z-10 container-x grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            {about.label && <p className="eyebrow mb-3">{about.label}</p>}
            <h2 id="home-about-title" className="section-title">
              <Highlight text={about.title} />
            </h2>
            {about.description && <p className="mt-4 text-body text-muted sm:mt-5 sm:text-body-lg">{about.description}</p>}
            {about.ctaLabel && about.ctaHref && (
              <ButtonLink href={about.ctaHref} variant="navy" size="lg" className="mt-6 w-full sm:mt-8 sm:w-auto" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {about.ctaLabel}
              </ButtonLink>
            )}
          </Reveal>
          <Reveal delay={120}>
            {/* Phones: one app-style list. sm+: the feature cards. */}
            <ListGroup aria-label="What we do" className="sm:hidden">
              {(about.features ?? []).slice(0, 4).map((f, i) => (
                <ListRow key={i} icon={f.icon ?? ""} iconTone="orange" title={f.title} description={f.description} clamp={false} />
              ))}
            </ListGroup>
            <ul className="hidden gap-4 sm:grid sm:grid-cols-2">
              {(about.features ?? []).slice(0, 4).map((f, i) => (
                <li key={i} className="card card-hover p-5">
                  <IconTile icon={f.icon ?? ""} tone="orange" />
                  <h3 className="mt-4 text-base font-bold text-navy">{f.title}</h3>
                  {f.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.description}</p>}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        {/* Only drawn when the next band really is lavender. */}
        {data.programs.length > 0 && <SectionDivider variant="wave" className="text-lavender" />}
      </section>

      {/* Programs */}
      {data.programs.length > 0 && (
        <section className="relative overflow-hidden bg-lavender section-y" aria-labelledby="home-programs-title">
          <SectionBg variant="blobs" />
          <div className="relative z-10 container-x">
            <Reveal className="sm:text-center">
              {programs.label && (
                <Eyebrow emoji="🎓" center>
                  {programs.label}
                </Eyebrow>
              )}
              <SectionHeading id="home-programs-title" title={programs.title} description={programs.description} align="center" className="max-sm:mx-0 max-sm:text-left" />
            </Reveal>
            {/* Phones: a tappable list of programmes. sm+: the card grid. */}
            <ListGroup aria-label={stripHighlight(programs.title)} className="mt-6 sm:hidden">
              {data.programs.map((p) => (
                <ListRow key={p.id} href={`/programs/${p.slug}`} icon={p.icon ?? "Sparkles"} iconTone="orange" title={p.title} description={p.summary} clamp={2} />
              ))}
            </ListGroup>
            <ul className="mt-12 hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {data.programs.map((p, i) => (
                <Reveal as="li" key={p.id} delay={Math.min(i, 5) * 60}>
                  <ProgramCard program={p} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Popular courses — desktop grid (phones have the swipe rail at the top of the page). */}
      {data.featuredCourses.length > 0 && (
        <section className="relative hidden overflow-hidden bg-white section-y lg:block" aria-labelledby="home-courses-title">
          <SectionBg variant="dots" />
          <div className="relative z-10 container-x">
            <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                {courses.label && <Eyebrow emoji="📚">{courses.label}</Eyebrow>}
                <SectionHeading id="home-courses-title" title={courses.title} description={courses.description} />
              </div>
              <ButtonLink href="/courses" variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />} className="self-start lg:self-auto">
                View all courses
              </ButtonLink>
            </Reveal>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.featuredCourses.map((c, i) => (
                <Reveal as="li" key={c.id} delay={Math.min(i, 5) * 60}>
                  <CourseCard course={c} applyHref={applyHref(user, { courseId: c.id })} />
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Find a training center — rings frame the single focal card. */}
      <section className="relative overflow-hidden bg-lavender section-y" aria-labelledby="home-center-search-title">
        <SectionBg variant="rings" />
        <div className="relative z-10 container-x">
          <Reveal className="card rounded-card-lg p-5 sm:p-10">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-center lg:gap-8">
              <div className="lg:col-span-5">
                <SectionHeading id="home-center-search-title" emoji="📍" label={centerSearch.label} title={centerSearch.title} description={centerSearch.description} />
              </div>
              <div className="lg:col-span-7">
                <CenterSearchForm compact />
                <p className="mt-3 text-caption text-muted">
                  Or browse{" "}
                  <Link href="/training-centers" className="font-semibold text-orange underline-offset-2 hover:underline">
                    all training centers
                  </Link>{" "}
                  and the{" "}
                  <Link href="/training-centers?view=map" className="font-semibold text-orange underline-offset-2 hover:underline">
                    India map
                  </Link>
                  .
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Admission process — grid lines under the steps, slant into the fees band. */}
      <section id="admission-process" className="relative scroll-mt-24 overflow-hidden bg-white section-y" aria-labelledby="home-process-title">
        <SectionBg variant="grid" />
        <div className="relative z-10 container-x">
          <Reveal>
            <SectionHeading id="home-process-title" emoji="📝" label={process.label} title={process.title} align="center" className="max-md:mx-0 max-md:text-left" />
          </Reveal>
          {/* Phones: a numbered vertical list in one card. md+: the four-step row. */}
          <ol className="card mt-6 divide-y divide-line overflow-hidden md:hidden">
            {(process.steps ?? []).slice(0, 4).map((step, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3.5">
                <span className="relative shrink-0">
                  <IconTile icon={PROCESS_ICONS[i % PROCESS_ICONS.length]} tone="navy" size="sm" />
                  <span aria-hidden className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-orange font-heading text-caption font-extrabold text-white">
                    {i + 1}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-semibold text-ink">{step.title}</span>
                  {step.description && <span className="mt-0.5 block text-body-sm text-muted">{step.description}</span>}
                </span>
              </li>
            ))}
          </ol>
          <div className="relative mt-14 hidden md:block">
            <div aria-hidden className="absolute top-7 right-[12.5%] left-[12.5%] hidden h-0.5 bg-linear-to-r from-orange/20 via-orange to-orange/20 lg:block" />
            <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {(process.steps ?? []).slice(0, 4).map((step, i) => (
                <Reveal as="li" key={i} delay={i * 100} className="relative flex flex-col items-center text-center">
                  <span className="relative z-10">
                    <IconTile icon={PROCESS_ICONS[i % PROCESS_ICONS.length]} tone="navy" size="lg" className="shadow-card-hover" />
                    <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white font-heading text-xs font-extrabold text-navy shadow-card ring-1 ring-navy/10">{i + 1}</span>
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-navy">{step.title}</h3>
                  {step.description && <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{step.description}</p>}
                </Reveal>
              ))}
            </ol>
          </div>
          {process.ctaLabel && process.ctaHref && (
            <Reveal className="mt-6 md:mt-12 md:text-center">
              <ButtonLink href={process.ctaHref} size="xl" className="w-full md:w-auto" rightIcon={<ArrowRight className="h-5 w-5" />}>
                {process.ctaLabel}
              </ButtonLink>
            </Reveal>
          )}
        </div>
        <SectionDivider variant="slant" className="text-lavender" />
      </section>

      {/* Fees & scholarship — wave bands ramp the lavender down into the navy CTA below. */}
      <section id="fees" className="relative scroll-mt-24 overflow-hidden bg-lavender section-y" aria-labelledby="home-fees-title">
        <SectionBg variant="waves" />
        <div className="relative z-10 container-x grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
          <Reveal>
            <SectionHeading id="home-fees-title" emoji="💰" label={fees.label} title={fees.title} description={fees.description} />
            {fees.ctaLabel && fees.ctaHref && (
              <ButtonLink href={fees.ctaHref} size="lg" className="mt-6 w-full sm:mt-8 sm:w-auto" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {fees.ctaLabel}
              </ButtonLink>
            )}
          </Reveal>
          <Reveal delay={120}>
            {data.fees ? (
              <div className="space-y-3 sm:space-y-4">
                <div className="card flex items-center justify-between gap-4 p-4 sm:p-6">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">Original fee</p>
                    <p className="mt-1 text-sm text-muted">
                      <Link href={`/courses/${data.fees.course.slug}`} className="font-medium text-navy hover:text-orange">
                        {data.fees.course.name}
                      </Link>
                    </p>
                  </div>
                  <p className="font-heading text-2xl font-extrabold text-navy sm:text-3xl">{formatINR(data.fees.originalFee)}</p>
                </div>
                {data.fees.scholarshipUpTo > 0 && (
                  <div className="card flex items-center justify-between gap-4 border-orange/30 bg-orange-light/60 p-4 sm:p-6">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-orange uppercase">Scholarship up to</p>
                      <p className="mt-1 text-sm text-muted">Need-based and merit support</p>
                    </div>
                    <p className="font-heading text-2xl font-extrabold text-orange sm:text-3xl">− {formatINR(data.fees.scholarshipUpTo)}</p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 rounded-card bg-navy p-4 text-white shadow-card sm:p-6">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">Your fee from</p>
                    <p className="mt-1 text-sm text-white/70">Final amount decided per application</p>
                  </div>
                  <p className="font-heading text-2xl font-extrabold text-white sm:text-3xl">{data.fees.yourFeeFrom > 0 ? formatINR(data.fees.yourFeeFrom) : "Free"}</p>
                </div>
              </div>
            ) : (
              <div className="card p-5 sm:p-8">
                <p className="eyebrow">Free training</p>
                <h3 className="mt-2 text-2xl font-extrabold text-navy">Currently all our courses are free of cost.</h3>
                <p className="mt-3 text-sm text-muted">Registration, training and certification are provided without any fee. Where paid courses are introduced, scholarship support will be shown here.</p>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/*
        The editable closing CTA (`home.cta`) sits HERE rather than above the footer. The footer carries
        its own "Ready to start learning or teaching?" strip with the same two destinations, so a navy CTA
        band immediately before it read as the same call made twice. Mid-page it earns its place: it
        answers the fee question directly above it, and it breaks the long white/lavender run.
      */}
      <CtaBand
        title={cta.title}
        description={cta.description}
        primary={cta.primaryLabel && cta.primaryHref ? { label: cta.primaryLabel, href: cta.primaryHref } : undefined}
        secondary={cta.secondaryLabel && cta.secondaryHref ? { label: cta.secondaryLabel, href: cta.secondaryHref } : undefined}
      />

      {/* Why EduSkill */}
      <section className="relative overflow-hidden bg-white section-y" aria-labelledby="home-why-title">
        <SectionBg variant="spotlight" className="opacity-70" />
        <div className="relative z-10 container-x">
          <Reveal>
            <SectionHeading id="home-why-title" emoji="⭐" label={why.label} title={why.title} description={why.description} align="center" className="max-sm:mx-0 max-sm:text-left" />
          </Reveal>
          {/* Phones: one list card. sm+: the feature grid. */}
          <ListGroup aria-label={stripHighlight(why.title)} className="mt-6 sm:hidden">
            {(why.features ?? []).slice(0, 8).map((f, i) => (
              <ListRow key={i} icon={f.icon ?? ""} iconTone="navy" title={f.title} description={f.description} clamp={false} />
            ))}
          </ListGroup>
          <ul className="mt-12 hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {(why.features ?? []).slice(0, 8).map((f, i) => (
              <Reveal as="li" key={i} delay={Math.min(i, 7) * 50} className="card card-hover p-6">
                <IconTile icon={f.icon ?? ""} tone="navy" />
                <h3 className="mt-5 text-base font-bold text-navy">{f.title}</h3>
                {f.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.description}</p>}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Impact across India — quiet dot matrix under the map, arch into the stats band. */}
      <section className="relative overflow-hidden bg-lavender section-y" aria-labelledby="home-impact-title">
        <SectionBg variant="dots" />
        <div className="relative z-10 container-x">
          <Reveal className="sm:text-center">
            {impact.label && (
              <Eyebrow emoji="🗺️" center>
                {impact.label}
              </Eyebrow>
            )}
            <SectionHeading id="home-impact-title" title={impact.title} description={impact.description} align="center" className="max-sm:mx-0 max-sm:text-left" />
          </Reveal>
          <div className="mt-6 grid gap-6 sm:mt-12 lg:grid-cols-12 lg:gap-8">
            <Reveal className="lg:col-span-4">
              {coverageShown.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1 xl:grid-cols-2">
                {coverageShown.map((c) => (
                  <li key={c.label} className="card flex items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
                    <IconTile icon={c.icon} tone="orange" size="sm" />
                    <span>
                      <span className="block font-heading text-2xl font-extrabold text-navy tabular-nums">
                        <CountUp value={c.value} />
                      </span>
                      <span className="block text-caption font-semibold text-muted">{c.label}</span>
                    </span>
                  </li>
                ))}
              </ul>
              )}
              <p className="mt-4 text-caption text-muted">Coverage counts only locations with active, verified training centers.</p>
            </Reveal>
            <Reveal delay={120} className="lg:col-span-8">
              <CenterMap height={460} listTitle="Training centers on the map" />
            </Reveal>
          </div>
        </div>
        {/* The navy stats band it curves into is desktop-only (phones get the reach chips up top). */}
        {data.impact.length > 0 && <SectionDivider variant="curve" height="lg" className="hidden text-navy lg:block" />}
      </section>

      <ImpactBand stats={data.impact} className="hidden lg:block" />

      {/* Success stories — one swipeable rail instead of a three-card grid. */}
      {data.stories.length > 0 && (
        <section className="relative overflow-hidden bg-white section-y" aria-labelledby="home-stories-title">
          <SectionBg variant="blobs" />
          <div className="relative z-10 container-x">
            <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                {stories.label && <Eyebrow emoji="🌟">{stories.label}</Eyebrow>}
                <SectionHeading id="home-stories-title" title={stories.title} description={stories.description} />
              </div>
              <ButtonLink href="/success-stories" variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />} className="hidden self-start sm:inline-flex lg:self-auto">
                All stories
              </ButtonLink>
            </Reveal>
            <Reveal className="mt-6 sm:mt-12">
              <Carousel aria-label={stories.label ?? stripHighlight(stories.title)} slidesPerView={{ base: 1.12, sm: 2, lg: 3 }} gap={6} autoPlay={6500} loop pauseOnHover snapStop trackClassName="-mx-1">
                {data.stories.map((st) => (
                  <CarouselSlide key={st.id}>
                    <StoryCard story={st} />
                  </CarouselSlide>
                ))}
              </Carousel>
            </Reveal>
            <ButtonLink href="/success-stories" variant="outline" fullWidth className="mt-6 sm:hidden" rightIcon={<ArrowRight className="h-4 w-4" />}>
              All stories
            </ButtonLink>
          </div>
        </section>
      )}
    </>
  );
}
