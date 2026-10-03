import { Award, CheckCircle2, Clock, Mail, Quote, Sparkles, Users } from "lucide-react";
import { Highlight } from "@/components/ui/highlight";
import { Reveal } from "@/components/site/reveal";
import { SectionBg } from "@/components/site/decor";
import { Media } from "@/components/site/safe-image";
import { SectionHeading } from "@/components/site/section-heading";
import { CtaBand } from "@/components/site/cta-band";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { HoverBullet, HoverIcon, JumpLinks, LandingHero, OtherProgramsNav, SimpleTable, Ticker } from "./landing-parts";
import {
  DM_ACTIVITIES,
  DM_ACTIVITIES_INTRO,
  DM_ASSESSMENT,
  DM_BOOKING,
  DM_BRANDING,
  DM_CERTIFICATE,
  DM_DURATIONS,
  DM_HERO,
  DM_IMPLEMENTATION,
  DM_IMPLEMENTATION_INTRO,
  DM_INSTITUTION_BENEFITS,
  DM_INTRO,
  DM_MODES,
  DM_MODULES,
  DM_OBJECTIVES,
  DM_OUTCOMES,
  DM_PARTICIPANTS,
  DM_SCHEDULE,
  DM_TICKER,
  DM_VISION,
} from "./digital-marketing-content";

const JUMP_LINKS = [
  { href: "#intro", label: "Introduction" },
  { href: "#modules", label: "12 Modules" },
  { href: "#activities", label: "Activities" },
  { href: "#duration", label: "Duration & Mode" },
  { href: "#schedule", label: "One-day schedule" },
  { href: "#outcomes", label: "Outcomes" },
  { href: "#book", label: "Organize a program" },
];

/** Alternating tile tones for the module numbers, so a long grid has rhythm. */
const MODULE_TONES = ["bg-orange-light text-orange", "bg-lavender text-navy", "bg-green-light text-green-dark"];

/**
 * /programs/digital-marketing-training — the Digital Marketing Training & Awareness Program as a full
 * landing page: hero, ticker, introduction with the programme's branding facts, objectives,
 * participants, 12 modules, practical activities, duration and training-mode, one-day schedule,
 * institution formats, assessment path, outcomes and benefits, certificate, vision, and a request
 * form that files a Partnership enquiry. Content: digital-marketing-content.ts.
 */
export function DigitalMarketingProgram({
  contactEmail,
  image,
  otherPrograms,
}: {
  contactEmail?: string | null;
  /** The programme's picture (Admin → CMS → Programs), shown beside the introduction when set. */
  image?: string | null;
  otherPrograms: { id: string; slug: string; title: string; icon: string | null }[];
}) {
  return (
    <>
      <LandingHero
        eyebrow={DM_HERO.eyebrow}
        title={DM_HERO.title}
        description={DM_HERO.tagline}
        crumb="Digital Marketing Training"
        rotating={DM_HERO.rotating}
        chips={DM_HERO.chips}
        primary={{ label: "Organize This Program", href: "#book" }}
        secondary={{ label: "Explore 12 Modules", href: "#modules" }}
      />
      <Ticker items={DM_TICKER} seconds={40} />
      <JumpLinks links={JUMP_LINKS} />

      {/* 1. Introduction + 13. branding facts */}
      <section id="intro" className="relative scroll-mt-24 overflow-x-clip bg-surface section-y" aria-labelledby="intro-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-7">
            <SectionHeading id="intro-title" label="Program introduction" title="Learn Digital Marketing. [[Create. Promote. Grow.]]" />
            <p className="mt-5 text-body-lg text-ink/85">{DM_INTRO}</p>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Program line">
              {DM_BRANDING.line.split(" | ").map((t) => (
                <li key={t} className="rounded-full bg-navy px-4 py-2 text-body-sm font-semibold text-white transition-colors duration-micro hover:bg-orange motion-reduce:transition-none">
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="lg:col-span-5" delay={120}>
            {image && (
              <div className="group mb-5 overflow-hidden rounded-card-lg shadow-e2">
                <div className="transition-transform duration-element ease-soft group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                  <Media src={image} alt="" seed="digital-marketing" ratio="16x9" sizes="(max-width: 1024px) 100vw, 500px" />
                </div>
              </div>
            )}
            <div className="relative overflow-hidden rounded-card-lg bg-navy p-6 text-white shadow-e2 sm:p-8">
              <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-orange/25" />
              <p className="relative text-overline text-orange-on-navy">Program branding</p>
              <p className="relative mt-2 font-heading text-h3">{DM_BRANDING.name}</p>
              <dl className="relative mt-5 space-y-3">
                {DM_BRANDING.facts.map((f) => (
                  <div key={f.label} className="rounded-card border border-white/15 bg-white/5 p-3 transition-colors duration-micro hover:bg-white/10 motion-reduce:transition-none">
                    <dt className="text-caption font-bold tracking-wide text-white/70 uppercase">{f.label}</dt>
                    <dd className="mt-0.5 text-body font-semibold">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 2. Objectives */}
      <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="dm-objectives-title">
        <SectionBg variant="dots" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading id="dm-objectives-title" label="Objectives" title="कार्यक्रम के मुख्य [[उद्देश्य]]" align="center" />
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {DM_OBJECTIVES.map((o, i) => (
              <Reveal as="li" key={o} delay={(i % 5) * 60}>
                <div className="group flex h-full flex-col gap-3 rounded-card border border-line bg-white p-5 transition-colors duration-micro hover:border-orange/40 hover:bg-orange-light/60 motion-reduce:transition-none">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-navy font-heading text-body font-bold text-white transition-colors duration-micro group-hover:bg-orange motion-reduce:transition-none"
                  >
                    {i + 1}
                  </span>
                  <span className="text-body text-ink/90">{o}</span>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. Target participants */}
      <section className="relative overflow-x-clip bg-lavender section-y" aria-labelledby="participants-title">
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading id="participants-title" label="Target participants" title="Who Can [[Join]]" align="center" />
          </Reveal>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {DM_PARTICIPANTS.map((p, i) => (
              <Reveal as="li" key={p.label} delay={(i % 5) * 60}>
                <div className="group card card-hover flex h-full flex-col items-center gap-3 p-4 text-center">
                  <HoverIcon icon={p.icon} className="bg-lavender text-navy group-hover:bg-orange group-hover:text-white" />
                  <span className="text-body-sm font-semibold text-navy">{p.label}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Modules */}
      <section id="modules" className="relative scroll-mt-24 overflow-x-clip bg-surface section-y" aria-labelledby="dm-modules-title">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading id="dm-modules-title" label="Training modules" title="12 Modules, From [[Basics to Career]]" align="center" />
          </Reveal>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {DM_MODULES.map((m, i) => (
              <Reveal as="li" key={m.title} delay={(i % 3) * 80}>
                <article className="group card card-hover relative flex h-full flex-col overflow-hidden p-6">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-linear-to-r from-orange via-navy-light to-green transition-transform duration-element ease-soft group-hover:scale-x-100 motion-reduce:transition-none"
                  />
                  <div className="flex items-start justify-between gap-4">
                    <HoverIcon icon={m.icon} className={MODULE_TONES[i % MODULE_TONES.length]} />
                    <span aria-hidden className="font-heading text-[2.75rem] leading-none font-bold text-navy/10 transition-colors duration-element group-hover:text-orange/30 motion-reduce:transition-none">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-4 text-overline text-muted">Module {i + 1}</p>
                  <h3 className="mt-1 text-h4 text-navy">{m.title}</h3>
                  <ul className="mt-3 space-y-2 text-body">
                    {m.topics.map((t) => (
                      <HoverBullet key={t}>{t}</HoverBullet>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Practical activities */}
      <section id="activities" className="relative scroll-mt-24 overflow-x-clip bg-white section-y" aria-labelledby="dm-activities-title">
        <SectionBg variant="spotlight" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading id="dm-activities-title" label="Practical activities" title="केवल Theory नहीं, [[Practical भी]]" description={DM_ACTIVITIES_INTRO} />
          </Reveal>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DM_ACTIVITIES.map((a, i) => (
              <Reveal as="li" key={a.label} delay={(i % 4) * 60}>
                <div className="group flex h-full min-h-16 items-center gap-4 rounded-card border border-line bg-white p-4 transition-all duration-micro hover:-translate-y-0.5 hover:border-orange hover:shadow-e2 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lavender text-navy transition-colors duration-micro group-hover:bg-orange group-hover:text-white motion-reduce:transition-none">
                    <a.icon className="h-5 w-5" />
                  </span>
                  <span className="text-body font-semibold text-ink">{a.label}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Duration + 7. Training mode */}
      <section id="duration" className="relative scroll-mt-24 overflow-x-clip bg-surface section-y" aria-labelledby="duration-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <SectionHeading id="duration-title" label="Suggested training duration" title="1 Day से [[30 Days]] तक" />
            <SimpleTable caption="Suggested training duration" head={["Duration", "Program"]} rows={DM_DURATIONS.map(([program, days]) => ({ cells: [days, program] }))} firstAsPill firstIcon={Clock} />
          </Reveal>
          <Reveal className="lg:col-span-6" delay={120}>
            <SectionHeading label="Training mode" title="Offline [[or Online]]" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {DM_MODES.map((m) => (
                <div key={m.title} className="group card card-hover h-full p-6">
                  <HoverIcon icon={m.icon} />
                  <h3 className="mt-4 text-h4 text-navy transition-colors duration-micro group-hover:text-orange motion-reduce:transition-none">{m.title}</h3>
                  <ul className="mt-3 space-y-2 text-body">
                    {m.items.map((t) => (
                      <HoverBullet key={t}>{t}</HoverBullet>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 14. One-day schedule + 10. School & college implementation */}
      <section id="schedule" className="relative scroll-mt-24 overflow-x-clip bg-white section-y" aria-labelledby="dm-schedule-title">
        <SectionBg variant="dots" />
        <div className="container-x relative z-10 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <SectionHeading id="dm-schedule-title" label="Suggested one-day workshop schedule" title="A Day of [[Digital Skills]]" />
            <SimpleTable caption="Suggested one-day workshop schedule" head={["Time", "Session"]} rows={DM_SCHEDULE} minWidth="min-w-[20rem]" />
          </Reveal>
          <Reveal className="lg:col-span-5" delay={120}>
            <SectionHeading label="School & College Implementation" title="For Every [[Institution]]" description={DM_IMPLEMENTATION_INTRO} />
            <ul className="mt-6 space-y-3">
              {DM_IMPLEMENTATION.map(([program, who], i) => (
                <li key={program} className="group flex items-center gap-4 rounded-card border border-line bg-white p-4 transition-all duration-micro hover:border-orange hover:shadow-e2 motion-reduce:transition-none">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-body font-bold text-white transition-colors duration-micro group-hover:bg-orange motion-reduce:transition-none">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-navy">{program}</span>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-body-sm text-muted">
                      <Users aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      {who}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 11. Assessment path */}
      <section className="relative overflow-x-clip bg-lavender section-y" aria-labelledby="assessment-title">
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading id="assessment-title" label="Assessment" title="Learning That Is [[Assessed]]" align="center" />
          </Reveal>
          <div className="relative mt-10">
          {/* The line joining the steps on desktop. */}
          <span aria-hidden className="absolute top-10 right-[10%] left-[10%] hidden h-0.5 bg-linear-to-r from-orange via-navy-light to-green lg:block" />
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {DM_ASSESSMENT.map((step, i) => (
              <Reveal as="li" key={step.label} delay={i * 80} className="relative">
                <div className="group card card-hover flex h-full flex-col items-center p-5 text-center">
                  <span aria-hidden className="relative flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white ring-4 ring-lavender transition-colors duration-micro group-hover:bg-orange motion-reduce:transition-none">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="mt-3 text-overline text-muted">Step {i + 1}</span>
                  <span className="mt-1 text-body font-semibold text-navy">{step.label}</span>
                </div>
              </Reveal>
            ))}
          </ol>
          </div>
        </div>
      </section>

      {/* 8. Expected outcomes (navy) */}
      <section id="outcomes" className="relative isolate scroll-mt-24 overflow-x-clip bg-navy surface-tint-dark section-y text-white" aria-labelledby="dm-outcomes-title">
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1.5px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="container-x relative">
          <Reveal>
            <SectionHeading id="dm-outcomes-title" label="Expected outcomes" title="What Participants Will [[Be Able to Do]]" description={DM_OUTCOMES.intro} light align="center" />
          </Reveal>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DM_OUTCOMES.items.map((o, i) => (
              <Reveal as="li" key={o} delay={(i % 4) * 60}>
                <div className="group flex h-full items-center gap-3 rounded-card border border-white/15 bg-white/5 p-4 transition-all duration-micro hover:border-orange-on-navy/60 hover:bg-white/10 motion-reduce:transition-none">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-green-on-navy transition-colors duration-micro group-hover:bg-orange group-hover:text-white motion-reduce:transition-none">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <span className="text-body font-semibold text-white">{o}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 12. Benefits for institutions + 9. Certificate */}
      <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="institution-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10 grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div className="card h-full rounded-card-lg border-t-4 border-t-orange p-6 sm:p-8">
              <h2 id="institution-title" className="text-h3 text-navy">
                Program Benefits for <Highlight text="[[Institutions]]" highlightClassName="text-orange" />
              </h2>
              <ul className="mt-5 space-y-2.5 text-body">
                {DM_INSTITUTION_BENEFITS.map((b) => (
                  <HoverBullet key={b}>{b}</HoverBullet>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="text-overline text-orange">Certificate</h2>
            <div className="group relative mt-4 overflow-hidden rounded-card-lg border-4 border-double border-navy/30 bg-white p-7 text-center shadow-e2 transition-transform duration-element hover:-rotate-1 motion-reduce:transition-none motion-reduce:hover:rotate-0 sm:p-9">
              <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-orange/10" />
              <span aria-hidden className="relative mx-auto flex h-16 w-16 animate-float items-center justify-center rounded-full bg-orange text-white shadow-e2 motion-reduce:animate-none">
                <Award className="h-8 w-8" />
              </span>
              <p className="relative mt-5 text-overline text-muted">Eduskill India Foundation</p>
              <p className="relative mt-2 font-heading text-h3 text-navy">Participation / Training Certificate</p>
              <span aria-hidden className="relative mx-auto mt-4 block h-px w-24 bg-orange" />
              <p className="relative mt-4 text-body text-ink/85">{DM_CERTIFICATE}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 15. Long-term vision */}
      <section className="relative overflow-x-clip bg-lavender py-12 lg:py-16" aria-labelledby="vision-title">
        <div className="container-x">
          <Reveal>
            <figure className="relative mx-auto max-w-4xl rounded-card-lg bg-white p-7 text-center shadow-e2 sm:p-10">
              <span aria-hidden className="absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-orange text-white shadow-e2">
                <Quote className="h-5 w-5" />
              </span>
              <h2 id="vision-title" className="mt-2 text-overline text-orange">
                Long-Term Vision
              </h2>
              <blockquote className="mt-3 font-heading text-h4 text-navy lg:text-h3">{DM_VISION}</blockquote>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* Organize — request form */}
      <section id="book" className="relative scroll-mt-24 overflow-x-clip bg-surface section-y" aria-labelledby="dm-book-title">
        <SectionBg variant="spotlight" />
        <div className="container-x relative z-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-5">
            <SectionHeading id="dm-book-title" label="Organize this program" title={DM_BOOKING.title} description={DM_BOOKING.subtitle} />
            <ul className="mt-6 grid grid-cols-2 gap-3">
              {DM_BOOKING.facts.map((f) => (
                <li key={f.label} className="flex items-center gap-2.5 rounded-card border border-line bg-white p-3 text-body-sm font-semibold text-navy">
                  <f.icon aria-hidden className="h-5 w-5 shrink-0 text-orange" />
                  {f.label}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-card-lg bg-navy p-6 text-white">
              <p className="text-overline text-orange-on-navy">Organized by</p>
              <p className="mt-1 font-heading text-h3">Eduskill India Foundation</p>
              <p className="mt-2 text-body-sm text-white/80">Skill Development & Digital Education</p>
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(DM_BOOKING.enquirySubject)}`}
                  className="ring-focus-inverse mt-4 inline-flex min-h-11 items-center gap-2 rounded-md text-body font-semibold text-white underline-offset-4 hover:text-orange-on-navy hover:underline"
                >
                  <Mail aria-hidden className="h-4 w-4" />
                  {contactEmail}
                </a>
              )}
            </div>
          </Reveal>
          <Reveal className="lg:col-span-7" delay={120}>
            <div className="card rounded-card-lg p-6 sm:p-8">
              <h3 className="flex items-center gap-2 text-h3 text-navy">
                <Sparkles aria-hidden className="h-5 w-5 text-orange" />
                Request this program
              </h3>
              <p className="mt-1 text-body text-muted">Tell us about your institution or group, the participants and a preferred date — our team will get back to you.</p>
              <div className="mt-6">
                <EnquiryForm defaultType="PARTNERSHIP" defaultSubject={DM_BOOKING.enquirySubject} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <OtherProgramsNav programs={otherPrograms} />

      <CtaBand
        title="Learn Digital Marketing. Create Content. Build Your Brand. [[Grow Digitally.]]"
        description="Digital Marketing Training & Awareness Program — Offline / Online"
        primary={{ label: "Organize This Program", href: "#book" }}
        secondary={{ label: "All Programs", href: "/programs" }}
      />
    </>
  );
}
