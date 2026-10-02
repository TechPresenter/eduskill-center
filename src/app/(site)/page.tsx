import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BookOpen, Building2, ClipboardList, Compass, FileSignature, GraduationCap, HandCoins, Landmark, Layers, Map, MapPin, Presentation, Users, type LucideProps } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { stripHighlight } from "@/components/ui/highlight";
import { Carousel, CarouselSlide } from "@/components/ui/carousel";
import { getBranding, getPublicSettings, getSetting } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl, formatINR } from "@/lib/utils";
import { getHomepageData, listPublicCourses, type FeeSlab } from "@/server/public";
import { feePeriodSuffix, formatFeeAmount } from "@/lib/course-pricing";
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

/*
 * ═══ THE BAND PLAN ═══
 *
 * The page used to alternate white and lavender, which is a two-beat rhythm in a colour the logo
 * does not contain. It now runs the mark's own three hues, one coloured beat between quiet white
 * ones, in the order the logo weights them (blue 52.5 · orange 31.5 · green 15.9):
 *
 *   hero navy → trust lavender → about WHITE → programmes NAVY → courses WHITE →
 *   find a centre ORANGE-LIGHT → process WHITE → fees GREEN → cta NAVY → why WHITE →
 *   reach PALE BLUE → impact NAVY → stories WHITE
 *
 * Which section may take a tint is decided by contrast, not by taste. `SectionHeading` prints its
 * description in `text-muted` (#667085) and that colour lives in section-heading.tsx, not here, so a
 * band underneath a section description has to keep #667085 at 4.5:1. Measured on the body's white:
 * white 4.97 ✓ · green-light/60 4.65 ✓ · navy-soft/30 4.64 ✓ · lavender 4.15 ✗ · navy-soft 3.91 ✗.
 * That is why lavender leaves this page (it was failing on five bands), why the green band is dialled
 * to 60%, and why the two full-strength tints went to the only two sections that write nothing on the
 * band itself: programmes (white cards, white heading on navy) and the centre search (one white card).
 * A navy band is the freest of all — `SectionHeading light` is white at 8.49 and white/80 at 6.03.
 *
 * Section order, copy, data and routes are unchanged; this is the arrangement only.
 */

/**
 * Marks for the admission-process steps. CMS steps carry no icon field, so these are positional and
 * deliberately generic — discover, locate, apply, begin — which is the shape of the flow whatever an
 * editor renames the steps to. Meaning always stays in the step title: the tile is decorative and the
 * ordinal is already carried by the <ol>.
 */
const PROCESS_ICONS: React.ComponentType<LucideProps>[] = [Compass, MapPin, ClipboardList, GraduationCap];

/**
 * The three logo hues as SOFT icon tiles — the measured triple quick-actions.tsx settled on: navy on
 * navy-soft 6.68, green-dark on green-light 5.89, orange on orange-light 3.24 (a lucide glyph is a
 * GRAPHIC, so it owes 3:1, not 4.5:1).
 *
 * They are painted through `className` rather than `IconTile`'s `tone` because the site tile's `navy`
 * IS the solid brand mark, and decor.tsx reserves that for "a single emphasised mark (never a whole
 * list of them)" — six coverage counts or eight feature cards in solid navy is exactly the list it
 * warns about. `tone="lavender"` is only the slot being borrowed: IconTile puts `className` after its
 * own tone classes, so tailwind-merge drops the bg/text underneath, the same trick decor.tsx uses for
 * its green tiles.
 */
const HUE_TILE = {
  navy: "bg-navy-soft text-navy",
  orange: "bg-orange-light text-orange",
  green: "bg-green-light text-green-dark",
} as const;
type BrandHue = keyof typeof HUE_TILE;

/**
 * Hue cycle for a CMS feature grid, where the tiles carry no meaning of their own and only the order
 * is ours. Four steps with blue twice: a 4-card grid lands 2:1:1 and an 8-card grid 4:2:2, which is as
 * near as whole tiles get to the logo's 52.5 / 31.5 / 15.9. The phone renders these same features as a
 * `ListGroup`, which keeps ONE tone for every row — a hue cycle is a grid device; a vertical list of
 * alternating colours reads as unsorted status, not as a brand.
 */
const HUE_CYCLE: BrandHue[] = ["navy", "orange", "navy", "green"];

/** "₹50 / month" for a uniform category, "₹50–₹100 / month" when its courses differ. */
function feeSlabLabel(slab: FeeSlab): string {
  if (slab.min === slab.max) return formatFeeAmount(slab.min, slab.feePeriod);
  return `${formatINR(slab.min)}–${formatFeeAmount(slab.max, slab.feePeriod)}`;
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
  const [data, branding, user, registrationOpen, allCourses] = await Promise.all([
    getHomepageData(),
    getBranding(),
    getSessionUser().catch(() => null),
    getSetting<boolean>("admissions.registrationOpen").catch(() => true),
    // Every active course, for the hero enquiry card's <select>. Loaded HERE, on the server, rather
    // than fetched by the card on first paint.
    listPublicCourses().catch(() => []),
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

  /*
   * Courses offered in the hero enquiry card. Real ACTIVE courses only: the card composes the
   * enquiry's `subject` and `message` from the visitor's choice, so a name that is not a real
   * course would put a fiction into the Enquiry row a staff member later reads. Falls back to the
   * featured courses `getHomepageData` already holds, so a failed query narrows the list instead
   * of emptying it.
   */
  const heroCourses = (allCourses.length > 0 ? allCourses : data.featuredCourses).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));

  /*
   * Tinted by what each one counts, not at random: the three location levels are the map (blue), the
   * centres and trainers are the network the Foundation runs and sends you to (orange, this site's
   * "go / act" hue), and the students are who it is all for (green, the hue the card family already
   * spends on free fees, scholarships and seats). Six tiles land 3:2:1 — the logo's own ratio.
   */
  const coverageItems: { label: string; value: number; icon: React.ComponentType<LucideProps>; hue: BrandHue }[] = [
    { label: "States", value: data.coverage.states, icon: Map, hue: "navy" },
    { label: "Districts", value: data.coverage.districts, icon: Landmark, hue: "navy" },
    { label: "Blocks", value: data.coverage.blocks, icon: MapPin, hue: "navy" },
    { label: "Training Centers", value: data.coverage.centers, icon: Building2, hue: "orange" },
    { label: "Students", value: data.coverage.students, icon: Users, hue: "green" },
    { label: "Trainers", value: data.coverage.trainers, icon: GraduationCap, hue: "orange" },
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

      <Hero section={hero} courses={heroCourses} contact={branding.contact} />

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

      {/*
        About — the page's first reading section, so it stays white: its description is 15px #667085,
        which is 4.97:1 here and would be 4.15:1 on the lavender this band used to alternate with. The
        mesh wash carries all three logo hues instead, and the wave hands the page to the navy
        programmes band below.
      */}
      <section className="relative overflow-hidden bg-white section-y" aria-labelledby="home-about-title">
        <SectionBg variant="mesh" className="opacity-70" />
        <div className="relative z-10 container-x grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            {/* Hand-rolled eyebrow + h2 + description before; SectionHeading is the same three parts,
                and one heading component for the whole page is what makes the rhythm legible. */}
            <SectionHeading id="home-about-title" label={about.label} title={about.title} description={about.description} />
            {about.ctaLabel && about.ctaHref && (
              <ButtonLink href={about.ctaHref} variant="navy" size="lg" className="mt-6 w-full sm:mt-8 sm:w-auto" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {about.ctaLabel}
              </ButtonLink>
            )}
          </Reveal>
          <Reveal delay={120}>
            {/* Phones: one app-style list. sm+: the feature cards. The list takes the cycle's leading
                hue instead of cycling with it — soft navy, the same tile the `why` list uses. */}
            <ListGroup aria-label="What we do" className="sm:hidden">
              {(about.features ?? []).slice(0, 4).map((f, i) => (
                <ListRow key={i} icon={f.icon ?? ""} iconTone="navy" title={f.title} description={f.description} clamp={false} />
              ))}
            </ListGroup>
            <ul className="hidden gap-4 sm:grid sm:grid-cols-2">
              {(about.features ?? []).slice(0, 4).map((f, i) => (
                <li key={i} className="card card-hover p-5">
                  {/* Four tiles, cycled: blue, orange, blue, green. All four were orange before, which
                      said nothing about the Foundation and spent the action hue on decoration. */}
                  <IconTile icon={f.icon ?? ""} tone="lavender" className={HUE_TILE[HUE_CYCLE[i % HUE_CYCLE.length]]} />
                  <h3 className="mt-4 text-base font-bold text-navy">{f.title}</h3>
                  {f.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.description}</p>}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        {/* Only drawn when the next band really is the navy programmes band. */}
        {data.programs.length > 0 && <SectionDivider variant="wave" className="text-navy" />}
      </section>

      {/*
        Programmes — the page's first navy anchor, roughly every third section (hero · programmes ·
        cta · impact). It is the one long section that can carry a full-strength brand colour for
        free: every word here is either the heading, which `light` turns white (8.49) and white/80
        (6.03), or a white programme card. `blobs tone="navy"` is the same three hues lit for a dark
        band. The seam below is deliberately hard — a navy block ends where it ends.
      */}
      {data.programs.length > 0 && (
        <section className="relative overflow-hidden bg-navy section-y" aria-labelledby="home-programs-title">
          <SectionBg variant="blobs" tone="navy" />
          <div className="relative z-10 container-x">
            <Reveal>
              <SectionHeading
                id="home-programs-title"
                emoji="🎓"
                label={programs.label}
                title={programs.title}
                description={programs.description}
                align="center"
                light
                className="max-sm:mx-0 max-sm:text-left"
              />
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
              <SectionHeading id="home-courses-title" emoji="📚" label={courses.label} title={courses.title} description={courses.description} />
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

      {/*
        Find a training centre — the page's one warm band, and the orange beat of the three. Orange is
        already this site's "go somewhere" hue (the header CTA; the Find-a-Centre tile in the phone
        quick actions), so the section that sends you to a centre is where it belongs as a surface
        rather than as another button. Safe at full strength because nothing writes on the band: every
        word in this section sits on the white card the rings frame.
      */}
      <section className="relative overflow-hidden bg-orange-light section-y" aria-labelledby="home-center-search-title">
        <SectionBg variant="rings" />
        <div className="relative z-10 container-x">
          <Reveal className="card rounded-card-lg p-5 sm:p-10">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-center lg:gap-8">
              <div className="lg:col-span-5">
                <SectionHeading id="home-center-search-title" emoji="📍" label={centerSearch.label} title={centerSearch.title} description={centerSearch.description} />
              </div>
              <div className="lg:col-span-7">
                <CenterSearchForm compact />
                {/* Both links were 12px orange — 3.72:1 on white, an inherited AA failure. Navy is
                    8.49 and navy-light 5.82 on hover, which is the small-link pattern the rest of the
                    home components settled on. */}
                <p className="mt-3 text-caption text-muted">
                  Or browse{" "}
                  <Link href="/training-centers" className="ring-focus font-semibold text-navy underline-offset-2 hover:text-navy-light hover:underline">
                    all training centers
                  </Link>{" "}
                  and the{" "}
                  <Link href="/training-centers?view=map" className="ring-focus font-semibold text-navy underline-offset-2 hover:text-navy-light hover:underline">
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
                  {/* Was white on flat orange at 12px: 3.72:1. This is the desktop ordinal's own
                      treatment — navy on white, 8.49:1 — so both breakpoints now count the same way. */}
                  <span aria-hidden className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-white font-heading text-caption font-extrabold text-navy shadow-card ring-1 ring-navy/10">
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
          {/* mt-12, the same heading-to-content step the other sections use, instead of a lone mt-14. */}
          <div className="relative mt-12 hidden md:block">
            {/* The rail under the four steps is the logo's own blue→green sweep, read left to right:
                it starts where the journey starts and lands on the hue the site uses for "you got the
                thing". Decorative (aria-hidden, 2px), and it stops the action hue being spent on a
                rule nobody can click — at from-orange/20 the old one was invisible anyway. */}
            <div aria-hidden className="absolute top-7 right-[12.5%] left-[12.5%] hidden h-0.5 bg-linear-to-r from-navy/20 via-navy-light to-green lg:block" />
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
        {/* Dyed to the fees band's exact composite: green-light at 60% over this white section is the
            same colour as green-light at 60% over the white body below it. */}
        <SectionDivider variant="slant" className="text-green-light/60" />
      </section>

      {/*
        Fees & scholarship — the money section, so it takes the page's one green band; green is
        already what the card family spends on free fees, scholarships and seats, and this is where
        that promise is actually made. 60% rather than the flat token is an accessibility budget, not
        a taste dial: the heading's description is `text-muted` inside SectionHeading, which measures
        4.43:1 on full green-light and 4.65:1 at 60% over the white body. Re-measure before raising it.
        The wave bands then ramp the colour down into the navy CTA below.
      */}
      <section id="fees" className="relative scroll-mt-24 overflow-hidden bg-green-light/60 section-y" aria-labelledby="home-fees-title">
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
                      {/* hover:text-orange was 3.72:1 at 14px; navy-light is the card family's hover. */}
                      <Link href={`/courses/${data.fees.course.slug}`} className="ring-focus font-medium text-navy hover:text-navy-light">
                        {data.fees.course.name}
                      </Link>
                    </p>
                  </div>
                  <p className="font-heading text-2xl font-extrabold text-navy sm:text-3xl">
                    {formatINR(data.fees.originalFee)}
                    {feePeriodSuffix(data.fees.feePeriod)}
                  </p>
                </div>
                {/*
                  The three rows are a ladder — what it costs (white), what we take off (green, the
                  benefit hue), what you pay (navy, the answer). Orange was carrying the middle row at
                  3.72:1 for a 12px label, which fails; green-dark is 5.89 on green-light. The card
                  keeps green-light at full strength so it still steps out of the 60% band, and the
                  quiet line moves to ink/70 (5.74) because #667085 on green-light is 4.43.
                */}
                {data.fees.scholarshipUpTo > 0 && (
                  <div className="card flex items-center justify-between gap-4 border-green/25 bg-green-light p-4 sm:p-6">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-green-dark uppercase">Scholarship up to</p>
                      <p className="mt-1 text-sm text-ink/70">Need-based and merit support</p>
                    </div>
                    <p className="font-heading text-2xl font-extrabold text-green-dark sm:text-3xl">
                      − {formatINR(data.fees.scholarshipUpTo)}
                      {feePeriodSuffix(data.fees.feePeriod)}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 rounded-card bg-navy p-4 text-white shadow-card sm:p-6">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">Your fee from</p>
                    <p className="mt-1 text-sm text-white/70">Final amount decided per application</p>
                  </div>
                  <p className="font-heading text-2xl font-extrabold text-white sm:text-3xl">{formatFeeAmount(data.fees.yourFeeFrom, data.fees.feePeriod)}</p>
                </div>
              </div>
            ) : (
              <div className="card p-5 sm:p-8">
                {/* Spelled out rather than cn("eyebrow", …): `eyebrow` is orange at 12px, 3.72:1, and
                    tailwind-merge knows neither utility name, so stacking a colour on it would leave
                    the winner to stylesheet order. navy-light on white is 5.82. */}
                <p className="text-overline text-navy-light">Course fees</p>
                {data.feeSlabs.length > 0 ? (
                  <>
                    <h3 className="mt-2 text-2xl font-extrabold text-navy">Low fees for every class</h3>
                    {/* Every figure is read from the live catalogue (ACTIVE priced courses grouped by
                        category), so this list can never promise a fee the course page does not charge. */}
                    <ul className="mt-4 divide-y divide-line">
                      {data.feeSlabs.map((slab) => (
                        <li key={slab.category.slug} className="flex items-baseline justify-between gap-4 py-3">
                          <Link href={`/courses?category=${slab.category.slug}`} className="ring-focus min-w-0 text-body font-medium text-navy hover:text-navy-light">
                            {slab.category.name}
                          </Link>
                          <span className="shrink-0 font-heading text-lg font-extrabold text-navy tabular-nums">{feeSlabLabel(slab)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-muted">
                      {data.feeSlabs.some((slab) => slab.feePeriod === "month") ? "The first month's fee is paid at admission. " : ""}
                      Each course page shows its exact fee.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="mt-2 text-2xl font-extrabold text-navy">Fees are listed on every course page.</h3>
                    <p className="mt-3 text-sm text-muted">Where a course offers scholarship support, it will be shown here.</p>
                  </>
                )}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/*
        The editable closing CTA (`home.cta`) sits HERE rather than above the footer. The footer carries
        its own "Ready to start learning or teaching?" strip with the same two destinations, so a navy CTA
        band immediately before it read as the same call made twice. Mid-page it earns its place: it
        answers the fee question directly above it, and it is the deep-blue beat that closes the
        blue → orange → green run of coloured bands above it.
      */}
      <CtaBand
        title={cta.title}
        description={cta.description}
        primary={cta.primaryLabel && cta.primaryHref ? { label: cta.primaryLabel, href: cta.primaryHref } : undefined}
        secondary={cta.secondaryLabel && cta.secondaryHref ? { label: cta.secondaryLabel, href: cta.secondaryHref } : undefined}
      />

      {/* Why EduSkill — white, both because eight cards need a calm bed straight after a navy band and
          because its description is muted copy sitting on the band itself. The colour comes from the
          spotlight wash and from the tiles, not from the surface. */}
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
                {/* Eight tiles, cycled to 4 blue : 2 orange : 2 green. They were eight SOLID navy
                    marks, which is the "whole list of them" decor.tsx tells you not to make. */}
                <IconTile icon={f.icon ?? ""} tone="lavender" className={HUE_TILE[HUE_CYCLE[i % HUE_CYCLE.length]]} />
                <h3 className="mt-5 text-base font-bold text-navy">{f.title}</h3>
                {f.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.description}</p>}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/*
        Impact across India — the pale-blue step that ramps the last sections white → tint → navy
        stats band instead of jumping. 30% and not the flat token: this band carries TWO pieces of
        muted copy of its own (the section description and the 12px coverage note), and #667085 is
        3.91:1 on full navy-soft against 4.64:1 at 30% over the white body. `bg-surface` would also
        pass, but it is a grey-violet — this is the same step in the logo's blue. The dot matrix stays
        the quietest wash on the page, because a live map is already busy.
      */}
      <section className="relative overflow-hidden bg-navy-soft/30 section-y" aria-labelledby="home-impact-title">
        <SectionBg variant="dots" />
        <div className="relative z-10 container-x">
          <Reveal>
            <SectionHeading id="home-impact-title" emoji="🗺️" label={impact.label} title={impact.title} description={impact.description} align="center" className="max-sm:mx-0 max-sm:text-left" />
          </Reveal>
          <div className="mt-6 grid gap-6 sm:mt-12 lg:grid-cols-12 lg:gap-8">
            <Reveal className="lg:col-span-4">
              {coverageShown.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1 xl:grid-cols-2">
                {coverageShown.map((c) => (
                  <li key={c.label} className="card flex items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
                    <IconTile icon={c.icon} tone="lavender" size="sm" className={HUE_TILE[c.hue]} />
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
              <SectionHeading id="home-stories-title" emoji="🌟" label={stories.label} title={stories.title} description={stories.description} />
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
