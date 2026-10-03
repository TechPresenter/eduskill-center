import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, Clock, Coffee, Mail, Sparkles, Trophy } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";
import { DynamicIcon } from "@/components/ui/icon";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionBg } from "@/components/site/decor";
import { SectionHeading } from "@/components/site/section-heading";
import { CtaBand } from "@/components/site/cta-band";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { cn } from "@/lib/utils";
import { RotatingWords } from "./rotating-words";
import {
  ABOUT,
  ACTIVITIES,
  BENEFITS,
  BOOKING,
  BOOKING_FACTS,
  CERTIFICATE,
  DURATION_NOTE,
  DURATIONS,
  HERO,
  INFRASTRUCTURE,
  MODULES,
  OBJECTIVES,
  OUTCOMES,
  SCHEDULE,
  SUPPORT,
  TARGET_GROUP,
  TEACHER_ORIENTATION,
  TICKER,
} from "./school-ai-workshop-content";

const JUMP_LINKS = [
  { href: "#about", label: "About" },
  { href: "#modules", label: "Modules" },
  { href: "#activities", label: "Activities" },
  { href: "#schedule", label: "Schedule" },
  { href: "#benefits", label: "Benefits" },
  { href: "#book", label: "Book a workshop" },
];

const LEVEL_TONE = {
  orange: { tile: "bg-orange text-white", ring: "group-hover:border-orange/50", text: "text-orange" },
  navy: { tile: "bg-navy text-white", ring: "group-hover:border-navy/40", text: "text-navy" },
  green: { tile: "bg-green text-white", ring: "group-hover:border-green/50", text: "text-green-dark" },
} as const;

/** Icon tile that tilts and grows a little when its card is hovered. */
function HoverIcon({ icon: Icon, className }: { icon: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-light text-orange transition-transform duration-element ease-soft group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:transform-none",
        className
      )}
    >
      <Icon className="h-6 w-6" />
    </span>
  );
}

/** A bullet line whose text slides right and turns orange on hover. */
function HoverBullet({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <li className="group/item flex items-start gap-2.5">
      <CheckCircle2 aria-hidden className={cn("mt-1 h-4 w-4 shrink-0", light ? "text-green-on-navy" : "text-green")} />
      <span
        className={cn(
          "transition-[color,transform] duration-micro ease-soft group-hover/item:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/item:translate-x-0",
          light ? "text-white/90 group-hover/item:text-white" : "text-ink/85 group-hover/item:text-orange"
        )}
      >
        {children}
      </span>
    </li>
  );
}

/**
 * /programs/ai-workshop-training — the School AI Training & Awareness Workshop, laid out as a full
 * landing page (hero with rotating line, ticker, modules, schedule and duration tables, benefits,
 * certificate, and a booking form that files a Partnership enquiry). Content:
 * school-ai-workshop-content.ts.
 */
export function SchoolAiWorkshop({
  contactEmail,
  otherPrograms,
}: {
  contactEmail?: string | null;
  otherPrograms: { id: string; slug: string; title: string; icon: string | null }[];
}) {
  return (
    <>
      <PageHero
        eyebrow={HERO.eyebrow}
        title={HERO.title}
        description={HERO.quote}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Programs", href: "/programs" }, { label: "AI Workshop & Training" }]}
      >
        <div className="space-y-5 lg:space-y-7">
          <p className="font-heading text-h3 text-white lg:text-h2">
            <RotatingWords words={HERO.rotating} wordClassName="text-orange-on-navy" />
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="At a glance">
            {HERO.chips.map((c) => (
              <li
                key={c}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 text-body-sm font-semibold text-white transition-colors duration-micro hover:border-orange-on-navy/60 hover:bg-white/15 motion-reduce:transition-none"
              >
                <Sparkles aria-hidden className="h-3.5 w-3.5 text-orange-on-navy" />
                {c}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#book" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Book a Workshop for Your School
            </ButtonLink>
            <ButtonLink href="#modules" size="lg" variant="white">
              Explore the Modules
            </ButtonLink>
          </div>
        </div>
      </PageHero>

      {/* Ticker: the two taglines, moving. Decorative — the words are read once from the sr-only copy. */}
      <div className="relative overflow-x-clip bg-orange py-3 text-white">
        <p className="sr-only">{TICKER.join(", ")}</p>
        <div aria-hidden className="flex w-max animate-marquee items-center [--marquee-duration:32s]">
          {[0, 1].map((run) => (
            <div key={run} className="flex items-center">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={`${run}-${i}`} className="flex items-center gap-4 px-4 font-heading text-xl font-bold whitespace-nowrap">
                  {t}
                  <Sparkles className="h-4 w-4 text-white/80" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Jump links */}
      <nav aria-label="On this page" className="border-b border-line bg-white">
        <div className="container-x">
          <ul className="hscroll gap-2 py-3 lg:mx-0 lg:flex-wrap lg:px-0">
            {JUMP_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="ring-focus inline-flex min-h-11 items-center rounded-full border border-line px-4 text-body-sm font-semibold text-navy transition-colors duration-micro hover:border-orange hover:bg-orange-light hover:text-orange motion-reduce:transition-none"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* About */}
      <section id="about" className="relative scroll-mt-24 overflow-x-clip bg-surface section-y" aria-labelledby="about-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-6">
            <SectionHeading id="about-title" label="About the workshop" title="Learn AI. Create with AI. [[Prepare for the Future.]]" />
            <div className="mt-5 space-y-4 text-body-lg text-ink/85">
              {ABOUT.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <blockquote className="mt-7 border-l-4 border-orange bg-white py-4 pr-4 pl-5 font-heading text-h4 text-navy shadow-e1 rounded-r-card">
              “{HERO.quote}”
            </blockquote>
          </Reveal>
          <div className="lg:col-span-6">
            <h3 className="text-overline text-muted">Key highlights</h3>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {ABOUT.highlights.map((h, i) => (
                <Reveal as="li" key={h.label} delay={i * 60}>
                  <div className="group card card-hover flex h-full items-center gap-4 p-5">
                    <HoverIcon icon={h.icon} />
                    <span className="text-body font-semibold text-navy transition-colors duration-micro group-hover:text-orange motion-reduce:transition-none">{h.label}</span>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Objectives */}
      <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="objectives-title">
        <SectionBg variant="dots" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading id="objectives-title" label="Objectives" title="What the Workshop [[Sets Out to Do]]" align="center" />
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OBJECTIVES.map((o, i) => (
              <Reveal as="li" key={o} delay={(i % 4) * 70}>
                <div className="group flex h-full gap-4 rounded-card border border-line bg-white p-5 transition-colors duration-micro hover:border-orange/40 hover:bg-orange-light/60 motion-reduce:transition-none">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy font-heading text-body font-bold text-white transition-colors duration-micro group-hover:bg-orange motion-reduce:transition-none"
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

      {/* Target group */}
      <section className="relative overflow-x-clip bg-lavender section-y" aria-labelledby="target-title">
        <div className="container-x relative z-10 grid items-center gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionHeading id="target-title" label="Target group" title={`${TARGET_GROUP.classes}, [[Every School]]`} />
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-body font-semibold text-navy shadow-e1">
              <Award aria-hidden className="h-5 w-5 text-orange" />
              {TARGET_GROUP.schools}
            </p>
          </Reveal>
          <ul className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
            {TARGET_GROUP.levels.map((l, i) => {
              const tone = LEVEL_TONE[l.tone];
              return (
                <Reveal as="li" key={l.level} delay={i * 90}>
                  <div className={cn("group card card-hover h-full border-2 border-transparent p-6 text-center", tone.ring)}>
                    <span aria-hidden className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-2xl font-heading text-h3 transition-transform duration-element group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100", tone.tile)}>
                      {l.level[0]}
                    </span>
                    <p className={cn("mt-4 text-overline", tone.text)}>{l.level}</p>
                    <p className="mt-1 font-heading text-h3 text-navy">{l.classes}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="relative scroll-mt-24 overflow-x-clip bg-surface section-y" aria-labelledby="modules-title">
        <SectionBg variant="grid" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading
              id="modules-title"
              label="Workshop modules"
              title="Seven Modules, From [[Basics to Careers]]"
              description="Each module mixes a short explanation with live demonstrations and a hands-on task."
              align="center"
            />
          </Reveal>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, i) => (
              <Reveal as="li" key={m.title} delay={(i % 3) * 80} className={cn(i === MODULES.length - 1 && "lg:col-start-2")}>
                <article className="group card card-hover relative flex h-full flex-col overflow-hidden p-6">
                  {/* A bar that sweeps across the top edge on hover. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-linear-to-r from-orange via-navy-light to-green transition-transform duration-element ease-soft group-hover:scale-x-100 motion-reduce:transition-none"
                  />
                  <div className="flex items-start justify-between gap-4">
                    <HoverIcon icon={m.icon} />
                    <span aria-hidden className="font-heading text-[2.75rem] leading-none font-bold text-navy/10 transition-colors duration-element group-hover:text-orange/30 motion-reduce:transition-none">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 text-h4 text-navy">
                    <span className="sr-only">Module {i + 1}: </span>
                    {m.title}
                  </h3>
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

      {/* Practical activities */}
      <section id="activities" className="relative scroll-mt-24 overflow-x-clip bg-white section-y" aria-labelledby="activities-title">
        <SectionBg variant="spotlight" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading id="activities-title" label="Practical activities" title="Learning by [[Doing]]" description="Students participate in hands-on activities such as:" />
          </Reveal>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVITIES.map((a, i) => (
              <Reveal as="li" key={a.label} delay={(i % 3) * 60}>
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

      {/* Schedule + duration tables */}
      <section id="schedule" className="relative scroll-mt-24 overflow-x-clip bg-surface section-y" aria-labelledby="schedule-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <SectionHeading id="schedule-title" label="Suggested one-day schedule" title="A Day of [[AI Learning]]" />
            <div className="card relative mt-6 overflow-x-auto">
              <table className="w-full min-w-[18rem] border-collapse text-left">
                <caption className="sr-only">Suggested one-day schedule</caption>
                <thead>
                  <tr className="bg-navy text-white">
                    <th scope="col" className="px-4 py-3 text-overline sm:px-6">
                      Time
                    </th>
                    <th scope="col" className="px-4 py-3 text-overline sm:px-6">
                      Activity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE.map((row) => (
                    <tr
                      key={row.time}
                      className={cn(
                        "border-t border-line transition-colors duration-micro motion-reduce:transition-none",
                        row.kind === "break" ? "bg-orange-light" : row.kind === "closing" ? "bg-green-light" : "odd:bg-white even:bg-surface hover:bg-lavender"
                      )}
                    >
                      <td className="px-4 py-3 text-body-sm font-bold whitespace-nowrap text-navy tabular-nums sm:px-6">{row.time}</td>
                      <td className="px-4 py-3 text-body text-ink sm:px-6">
                        <span className="inline-flex items-center gap-2">
                          {row.kind === "break" && <Coffee aria-hidden className="h-4 w-4 text-orange" />}
                          {row.kind === "closing" && <Trophy aria-hidden className="h-4 w-4 text-green-dark" />}
                          {row.activity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-5" delay={120}>
            <SectionHeading label="Workshop duration" title="Choose the [[Format]]" />
            <div className="card relative mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Workshop duration options</caption>
                <thead>
                  <tr className="bg-navy text-white">
                    <th scope="col" className="px-4 py-3 text-overline sm:px-6">
                      Duration
                    </th>
                    <th scope="col" className="px-4 py-3 text-overline sm:px-6">
                      Program
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DURATIONS.map((d) => (
                    <tr key={d.duration} className="group border-t border-line transition-colors duration-micro odd:bg-white even:bg-surface hover:bg-lavender motion-reduce:transition-none">
                      <td className="px-4 py-3.5 whitespace-nowrap sm:px-6">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-light px-3 py-1 text-body-sm font-bold text-orange transition-colors duration-micro group-hover:bg-orange group-hover:text-white motion-reduce:transition-none">
                          <Clock aria-hidden className="h-3.5 w-3.5" />
                          {d.duration}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-body font-semibold text-navy sm:px-6">{d.program}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 flex items-start gap-2 text-body text-muted">
              <Sparkles aria-hidden className="mt-1 h-4 w-4 shrink-0 text-orange" />
              {DURATION_NOTE}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Benefits (navy band) */}
      <section id="benefits" className="relative isolate scroll-mt-24 overflow-x-clip bg-navy surface-tint-dark section-y text-white" aria-labelledby="benefits-title">
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1.5px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="container-x relative">
          <Reveal>
            <SectionHeading id="benefits-title" label="Benefits for students" title="What Every Student [[Takes Home]]" light align="center" />
          </Reveal>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <Reveal as="li" key={b} delay={(i % 3) * 60}>
                <div className="group flex h-full items-center gap-3 rounded-card border border-white/15 bg-white/5 p-4 transition-all duration-micro hover:border-orange-on-navy/60 hover:bg-white/10 motion-reduce:transition-none">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-green-on-navy transition-colors duration-micro group-hover:bg-orange group-hover:text-white motion-reduce:transition-none">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <span className="text-body font-semibold text-white">{b}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Teacher orientation + outcomes */}
      <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="outcomes-title">
        <SectionBg variant="dots" />
        <div className="container-x relative z-10 grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div className="card h-full rounded-card-lg p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-h3 text-navy">Teacher Orientation</h2>
                <span className="rounded-full bg-lavender px-3 py-1 text-caption font-bold tracking-wide text-navy uppercase">Optional</span>
              </div>
              <p className="mt-3 text-body text-muted">{TEACHER_ORIENTATION.intro}</p>
              <ul className="mt-5 space-y-2.5 text-body">
                {TEACHER_ORIENTATION.topics.map((t) => (
                  <HoverBullet key={t}>{t}</HoverBullet>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="card h-full rounded-card-lg border-t-4 border-t-orange p-6 sm:p-8">
              <h2 id="outcomes-title" className="text-h3 text-navy">
                Program <Highlight text="[[Outcomes]]" highlightClassName="text-orange" />
              </h2>
              <p className="mt-3 text-body text-muted">{OUTCOMES.intro}</p>
              <ol className="mt-5 space-y-2.5">
                {OUTCOMES.items.map((o, i) => (
                  <li key={o} className="group/item flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-light text-caption font-bold text-orange transition-colors duration-micro group-hover/item:bg-orange group-hover/item:text-white motion-reduce:transition-none">
                      {i + 1}
                    </span>
                    <span className="text-body text-ink/85 transition-colors duration-micro group-hover/item:text-navy motion-reduce:transition-none">{o}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Infrastructure + certificate */}
      <section className="relative overflow-x-clip bg-lavender section-y" aria-labelledby="infra-title">
        <div className="container-x relative z-10 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <SectionHeading id="infra-title" label="Infrastructure requirements" title="What the School [[Provides]]" />
            </Reveal>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {INFRASTRUCTURE.map((it, i) => (
                <Reveal as="li" key={it.label} delay={(i % 3) * 60}>
                  <div className="group card card-hover flex h-full flex-col items-center gap-3 p-4 text-center">
                    <HoverIcon icon={it.icon} className="bg-lavender text-navy group-hover:bg-orange group-hover:text-white" />
                    <span className="text-body-sm font-semibold text-navy">{it.label}</span>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>

          <Reveal className="lg:col-span-5" delay={120}>
            <h2 className="text-overline text-orange">Certificate</h2>
            {/* A certificate-shaped card: double rule, seal, script line. */}
            <div className="group relative mt-4 overflow-hidden rounded-card-lg border-4 border-double border-navy/30 bg-white p-7 text-center shadow-e2 transition-transform duration-element hover:-rotate-1 motion-reduce:transition-none motion-reduce:hover:rotate-0 sm:p-9">
              <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-orange/10" />
              <span aria-hidden className="relative mx-auto flex h-16 w-16 animate-float items-center justify-center rounded-full bg-orange text-white shadow-e2 motion-reduce:animate-none">
                <Award className="h-8 w-8" />
              </span>
              <p className="relative mt-5 text-overline text-muted">Eduskill India Foundation</p>
              <p className="relative mt-2 font-heading text-h3 text-navy">{CERTIFICATE.title}</p>
              <span aria-hidden className="relative mx-auto mt-4 block h-px w-24 bg-orange" />
              <p className="relative mt-4 text-body text-ink/85">{CERTIFICATE.text}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* School workshop support */}
      <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="support-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading id="support-title" label="School workshop support" title={SUPPORT.title} align="center" />
          </Reveal>
          <ul className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
            {SUPPORT.cards.map((c, i) => (
              <Reveal as="li" key={c.title} delay={i * 100}>
                <div className="group card card-hover flex h-full gap-5 rounded-card-lg p-6 sm:p-8">
                  <HoverIcon icon={c.icon} className="h-14 w-14 rounded-2xl" />
                  <div>
                    <h3 className="text-h4 text-navy transition-colors duration-micro group-hover:text-orange motion-reduce:transition-none">{c.title}</h3>
                    <p className="mt-2 text-body text-muted">{c.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Booking */}
      <section id="book" className="relative scroll-mt-24 overflow-x-clip bg-surface section-y" aria-labelledby="book-title">
        <SectionBg variant="spotlight" />
        <div className="container-x relative z-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-5">
            <SectionHeading id="book-title" label="Organize this workshop" title={BOOKING.title} description={BOOKING.subtitle} />
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Workshop promise">
              {BOOKING.tagline.map((t) => (
                <li key={t} className="rounded-full bg-navy px-4 py-2 text-body-sm font-semibold text-white transition-colors duration-micro hover:bg-orange motion-reduce:transition-none">
                  {t}
                </li>
              ))}
            </ul>
            <ul className="mt-6 grid grid-cols-2 gap-3">
              {BOOKING_FACTS.map((f) => (
                <li key={f.label} className="flex items-center gap-2.5 rounded-card border border-line bg-white p-3 text-body-sm font-semibold text-navy">
                  <f.icon aria-hidden className="h-5 w-5 shrink-0 text-orange" />
                  {f.label}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-card-lg bg-navy p-6 text-white">
              <p className="text-overline text-orange-on-navy">Organized by</p>
              <p className="mt-1 font-heading text-h3">{BOOKING.organizer}</p>
              <p className="mt-2 text-body-sm text-white/80">{BOOKING.pillars.join(" | ")}</p>
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(BOOKING.enquirySubject)}`}
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
              <h3 className="text-h3 text-navy">Request a workshop</h3>
              <p className="mt-1 text-body text-muted">Tell us about your school, the classes and a preferred date — our team will get back to you.</p>
              <div className="mt-6">
                <EnquiryForm defaultType="PARTNERSHIP" defaultSubject={BOOKING.enquirySubject} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {otherPrograms.length > 0 && (
        <nav className="border-t border-line bg-white py-8" aria-labelledby="other-programs">
          <div className="container-x">
            <h2 id="other-programs" className="text-overline text-muted">
              Other programs
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {otherPrograms.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/programs/${p.slug}`}
                    className="ring-focus group inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-body-sm font-semibold text-navy transition-colors duration-micro hover:border-orange hover:text-orange motion-reduce:transition-none"
                  >
                    <DynamicIcon name={p.icon ?? undefined} className="h-4 w-4 text-orange" aria-hidden />
                    {p.title}
                    <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-micro group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      <CtaBand
        title="Empowering Students with AI Skills for a [[Smart Future]]"
        description={BOOKING.tagline.join(" • ")}
        primary={{ label: "Book a Workshop", href: "#book" }}
        secondary={{ label: "All Programs", href: "/programs" }}
      />
    </>
  );
}
