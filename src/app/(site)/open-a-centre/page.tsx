import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CalendarCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Droplets,
  HeartHandshake,
  Home,
  IdCard,
  LineChart,
  NotebookPen,
  PenLine,
  Repeat,
  School,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { getSetting } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { CENTRE_CLASSES } from "@/lib/validation/centre-applications";
import { CENTRE_STEPS } from "@/server/centre-applications";
import { CentreSteps } from "@/components/site/centre-steps";
import { CtaBand } from "@/components/site/cta-band";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";

const TITLE = "Open a Normal Education Centre";
const DESCRIPTION =
  "EduSkill India Foundation invites local operators in panchayat and rural areas to open a Normal Education Centre for Class 1 to 4 — regular study, practice and extra academic support for children. Computer courses are not part of this programme.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: absoluteUrl("/open-a-centre") },
    openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/open-a-centre"), type: "website" },
  };
}

const OBJECTIVES = [
  { icon: BookOpen, title: "Strengthen foundational education", description: "Give children of Class 1 to 4 a strong base in the subjects they study at school." },
  { icon: PenLine, title: "Develop reading and writing skills", description: "Daily reading and writing practice until every child can read and write with confidence." },
  { icon: Calculator, title: "Strengthen basic mathematics", description: "Build a clear understanding of numbers, tables and everyday calculation." },
  { icon: CalendarCheck, title: "Build a habit of regular study", description: "A fixed daily routine so that studying becomes a habit, not an exam-time activity." },
  { icon: HeartHandshake, title: "Support weaker students", description: "Extra academic support for children who need more time and attention." },
  { icon: Sparkles, title: "A quality learning environment", description: "A calm, safe and well-run place to learn in rural and panchayat areas." },
];

const SUBJECTS = [
  { name: "Hindi", note: null },
  { name: "English", note: null },
  { name: "Mathematics", note: null },
  { name: "EVS", note: "प्रारंभिक पर्यावरण अध्ययन" },
];

const ACTIVITIES = [
  { icon: CalendarDays, title: "Daily Classes" },
  { icon: BookOpen, title: "Reading Practice" },
  { icon: PenLine, title: "Writing Practice" },
  { icon: Calculator, title: "Mathematics Practice" },
  { icon: NotebookPen, title: "Homework Support" },
  { icon: Repeat, title: "Revision Classes" },
  { icon: ClipboardCheck, title: "Weekly Test" },
  { icon: CalendarCheck, title: "Monthly Assessment" },
  { icon: LineChart, title: "Student Progress Record" },
  { icon: Users, title: "Parent–Teacher Interaction" },
];

const WHO_CAN_APPLY = [
  "You live in, or close to, the panchayat, village or town where the centre would run.",
  "You can run classes for Class 1 to 4 every day, yourself or with a teacher.",
  "You have a space for the centre — your own, rented, or a community / panchayat building.",
  "You are willing to have your documents and the proposed space verified by the Foundation.",
  "You will attend the orientation on running the centre and its academics before classes start.",
];

const KEEP_READY = [
  { icon: IdCard, label: "Identity proof", hint: "Aadhaar, voter ID, driving licence or passport." },
  { icon: Home, label: "Address proof", hint: "Aadhaar, ration card, electricity bill or similar." },
  { icon: Users, label: "A recent photograph", hint: "A clear passport-style photo of the applicant." },
  { icon: School, label: "Details of the space", hint: "Number of rooms, approximate area and how many children can sit." },
  { icon: Zap, label: "Facilities in the space", hint: "Electricity, drinking water, toilet and furniture — tick what you have." },
  { icon: Droplets, label: "Photos of the rooms", hint: "Optional, but they help the centre verification." },
];

const NOTES = [
  {
    q: "Which classes and subjects does the centre run?",
    a: "Class 1, 2, 3 and 4. Each class studies Hindi, English, Mathematics and EVS (प्रारंभिक पर्यावरण अध्ययन). Reading, writing, revision and homework support are given as needed.",
  },
  {
    q: "Is the computer course included?",
    a: "No. A Normal Education Centre under the EduSkill Shiksha Mission is only for normal education of Class 1 to 4. The computer course is not included.",
  },
  {
    q: "What kind of space do I need?",
    a: "The form asks for the space type (own property, rented space, community or panchayat building, or other), the number of rooms, the approximate area, how many children can sit, and which basic facilities are available. In step 3 the Foundation verifies the proposed space, the classroom and those basic facilities.",
  },
  {
    q: "What documents will I have to upload?",
    a: "Identity proof, address proof and a recent photograph. Photos of the proposed space are optional but useful. You can upload right after submitting the form, or later from the application status page.",
  },
  {
    q: "How long does the process take?",
    a: "It depends on how quickly your documents are verified and when the centre verification visit can be arranged. Every step is shown on the status page, and you are informed by email and SMS whenever your application moves forward.",
  },
  {
    q: "Can I submit more than one application?",
    a: "No. Only one open application is allowed per mobile number and email address. If you have already applied, track that application instead of submitting a new one.",
  },
  {
    q: "What happens once my application is approved?",
    a: "The Foundation creates your centre record and issues an official centre code, which appears on your status page. Class 1 to 4 classes can then begin at the centre.",
  },
];

export default async function OpenACentrePage() {
  const open = await getSetting<boolean>("centres.applicationsOpen").catch(() => true);
  const applicationsOpen = open !== false;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          name: `${TITLE} — EduSkill Shiksha Mission`,
          mainEntity: NOTES.map((n) => ({ "@type": "Question", name: n.q, acceptedAnswer: { "@type": "Answer", text: n.a } })),
        }}
      />

      <PageHero
        eyebrow="EduSkill Shiksha Mission"
        title="Open a [[Normal Education Centre]] in Your Area"
        description="EduSkill India Foundation proposes to open Normal Education Centres for children in panchayat and rural areas. Each centre gives children of Class 1 to 4 regular study, practice and extra academic support."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Open a Centre" }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          {applicationsOpen ? (
            <ButtonLink href="/open-a-centre/apply" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Apply to open a centre
            </ButtonLink>
          ) : (
            <span className="inline-flex min-h-12 items-center rounded-xl bg-white/10 px-6 text-sm font-semibold text-white">Applications are currently closed</span>
          )}
          <ButtonLink href="/open-a-centre/status" size="lg" variant="white" leftIcon={<Search className="h-4 w-4" />}>
            Track your application
          </ButtonLink>
        </div>
      </PageHero>

      {/* ── What the programme is ── */}
      <section className="bg-white py-16 sm:py-20" aria-labelledby="centre-about-title">
        <div className="container-x grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-7">
            <SectionHeading
              id="centre-about-title"
              label="The programme"
              title="Normal Education Centre, [[Class 1 to 4]]"
              description="एडुस्किल शिक्षा मिशन — नॉर्मल एजुकेशन सेंटर, कक्षा 1 से 4"
            />
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink sm:text-base">
              <p>
                A Normal Education Centre is a small neighbourhood learning centre for children of Class 1 to 4. Its main purpose is to give those children regular study, practice and extra
                academic support — close to home, in the language they understand.
              </p>
              <p>
                The centre is run by a local operator who is authorised by EduSkill India Foundation after the documents and the proposed space have been verified. The Foundation guides the
                operator on how to run the centre and on the academics; the operator runs the daily classes.
              </p>
              <p className="rounded-xl border border-orange/20 bg-orange-light/60 p-4 text-[15px] font-semibold text-navy">
                Please note: the computer course is <span className="text-orange">not</span> included in this programme. A Normal Education Centre is only for normal education of Class 1 to 4.
              </p>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-5" delay={90}>
            <div className="card p-6 sm:p-7">
              <h3 className="font-heading text-lg font-extrabold text-navy">At a glance</h3>
              <dl className="mt-5 space-y-4">
                {[
                  { term: "Classes", detail: "Class 1, 2, 3 and 4" },
                  { term: "Subjects", detail: "Hindi, English, Mathematics, EVS" },
                  { term: "Where", detail: "Panchayat, village and rural areas" },
                  { term: "Run by", detail: "A local operator authorised by the Foundation" },
                  { term: "Computer course", detail: "Not included in this programme" },
                  { term: "Process", detail: "Seven steps, from application to centre start" },
                ].map((row) => (
                  <div key={row.term} className="flex flex-col gap-0.5 border-b border-line pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <dt className="text-xs font-bold tracking-wide text-muted uppercase">{row.term}</dt>
                    <dd className="text-sm font-semibold text-ink sm:text-right">{row.detail}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6">
                {applicationsOpen ? (
                  <ButtonLink href="/open-a-centre/apply" fullWidth rightIcon={<ArrowRight className="h-4 w-4" />}>
                    Start the application
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/open-a-centre/status" variant="navy" fullWidth>
                    Track an application
                  </ButtonLink>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Objectives ── */}
      <section className="bg-lavender py-16 sm:py-20" aria-labelledby="centre-objectives-title">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              id="centre-objectives-title"
              label="Objectives"
              title="What Every Centre [[Sets Out to Do]]"
              description="These six objectives shape the daily timetable of every Normal Education Centre."
              align="center"
            />
          </Reveal>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {OBJECTIVES.map((o, i) => {
              const Icon = o.icon;
              return (
                <Reveal as="li" key={o.title} delay={i * 70} className="card card-hover p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-light text-orange">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-navy">{o.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{o.description}</p>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Classes & subjects ── */}
      <section className="bg-white py-16 sm:py-20" aria-labelledby="centre-classes-title">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              id="centre-classes-title"
              label="Classes & subjects"
              title="Four Classes, [[Four Subjects]] Each"
              description="Every class studies the same four subjects. Reading, writing, revision and homework support are added as each child needs them."
              align="center"
            />
          </Reveal>

          {/* Phones: one card per class */}
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 md:hidden">
            {CENTRE_CLASSES.map((c) => (
              <div key={c.value} className="card p-5">
                <h3 className="font-heading text-lg font-extrabold text-navy">{c.label}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => (
                    <li key={s.name} className="inline-flex items-center gap-1.5 rounded-full bg-lavender px-3 py-1.5 text-sm font-semibold text-navy">
                      <Check className="h-3.5 w-3.5 text-orange" aria-hidden />
                      {s.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted">Plus reading, writing, revision and homework support.</p>
              </div>
            ))}
          </Reveal>

          {/* md+: subject grid */}
          <Reveal className="mt-10 hidden md:block">
            <div className="card overflow-hidden">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Subjects taught in each class at a Normal Education Centre</caption>
                <thead>
                  <tr className="bg-lavender">
                    <th scope="col" className="px-5 py-4 text-sm font-bold text-navy">
                      Class
                    </th>
                    {SUBJECTS.map((s) => (
                      <th key={s.name} scope="col" className="px-5 py-4 text-sm font-bold text-navy">
                        {s.name}
                        {s.note && <span className="mt-0.5 block text-xs font-medium text-muted">{s.note}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CENTRE_CLASSES.map((c) => (
                    <tr key={c.value} className="border-t border-line">
                      <th scope="row" className="px-5 py-4 text-sm font-bold text-navy">
                        {c.label}
                      </th>
                      {SUBJECTS.map((s) => (
                        <td key={s.name} className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-light text-success" aria-hidden>
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                            <span className="sr-only">
                              {s.name} is taught in {c.label}
                            </span>
                            Taught
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">Reading, writing, revision and homework support are also given as needed.</p>
          </Reveal>
        </div>
      </section>

      {/* ── Centre activities ── */}
      <section className="bg-lavender py-16 sm:py-20" aria-labelledby="centre-activities-title">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              id="centre-activities-title"
              label="Centre activities"
              title="What Happens at the Centre [[Every Week]]"
              align="center"
            />
          </Reveal>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ACTIVITIES.map((a, i) => {
              const Icon = a.icon;
              return (
                <Reveal as="li" key={a.title} delay={i * 50} className="card card-hover flex items-center gap-3 p-4 lg:flex-col lg:items-center lg:p-5 lg:text-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-sm font-bold text-navy">{a.title}</h3>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Who can apply ── */}
      <section className="bg-white py-16 sm:py-20" aria-labelledby="centre-who-title">
        <div className="container-x grid gap-8 lg:grid-cols-2 lg:gap-10">
          <Reveal>
            <SectionHeading id="centre-who-title" label="Who can apply" title="Local People Who Can [[Run a Centre]]" />
            <ul className="mt-6 space-y-3">
              {WHO_CAN_APPLY.map((w) => (
                <li key={w} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-light text-orange" aria-hidden>
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {w}
                </li>
              ))}
            </ul>
            <Alert tone="info" className="mt-6" title="One application per applicant">
              Only one open application is allowed per mobile number and email address. If you have already applied,{" "}
              <Link href="/open-a-centre/status" className="font-semibold underline underline-offset-2">
                track that application
              </Link>{" "}
              instead of starting a new one.
            </Alert>
          </Reveal>

          <Reveal delay={90}>
            <div className="card h-full p-6 sm:p-7">
              <h3 className="font-heading text-lg font-extrabold text-navy">Keep this ready before you apply</h3>
              <p className="mt-1 text-sm text-muted">The form takes about ten minutes. Documents can be uploaded right after you submit, or later from the status page.</p>
              <ul className="mt-6 space-y-4">
                {KEEP_READY.map((k) => {
                  const Icon = k.icon;
                  return (
                    <li key={k.label} className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavender text-navy">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy">{k.label}</p>
                        <p className="text-sm text-muted">{k.hint}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── The seven steps ── */}
      <section className="bg-lavender py-16 sm:py-20" aria-labelledby="centre-process-title">
        <div className="container-x grid gap-10 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <SectionHeading
                id="centre-process-title"
                label="How it works"
                title="Seven Steps to [[Open a Centre]]"
                description="From the day you submit the form to the day Class 1–4 classes begin. You can follow every step on the status page with your application number and mobile number."
              />
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {applicationsOpen && (
                  <ButtonLink href="/open-a-centre/apply" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    Apply to open a centre
                  </ButtonLink>
                )}
                <ButtonLink href="/open-a-centre/status" variant="outline" leftIcon={<Search className="h-4 w-4" />}>
                  Track your application
                </ButtonLink>
              </div>
            </div>
          </Reveal>
          <Reveal className="lg:col-span-7" delay={90}>
            <div className="card p-6 sm:p-8">
              <CentreSteps steps={CENTRE_STEPS} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Good to know ── */}
      <section className="bg-white py-16 sm:py-20" aria-labelledby="centre-notes-title">
        <div className="container-x">
          <Reveal>
            <SectionHeading id="centre-notes-title" label="Good to know" title="Questions Applicants [[Ask Us]]" align="center" />
          </Reveal>
          <Reveal className="mx-auto mt-10 max-w-3xl space-y-3">
            {NOTES.map((n) => (
              <details key={n.q} className="group card overflow-hidden open:shadow-card-hover">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-navy marker:content-none [&::-webkit-details-marker]:hidden">
                  {n.q}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-light text-orange transition-transform group-open:rotate-45" aria-hidden>
                    <span className="text-lg leading-none font-bold">+</span>
                  </span>
                </summary>
                <div className="border-t border-line px-5 py-4 text-[15px] leading-relaxed text-muted">{n.a}</div>
              </details>
            ))}
          </Reveal>
          <p className="mt-8 text-center text-sm text-muted">
            Still have a question?{" "}
            <Link href="/contact" className="font-semibold text-orange hover:underline">
              Contact the Foundation
            </Link>
            .
          </p>
        </div>
      </section>

      <CtaBand
        title="Ready to bring a [[centre]] to your village?"
        description="Fill the application, upload your documents, and follow all seven steps online. Class 1 to 4 children in your area get regular study, practice and support close to home."
        primary={applicationsOpen ? { label: "Apply to open a centre", href: "/open-a-centre/apply" } : undefined}
        secondary={{ label: "Track your application", href: "/open-a-centre/status" }}
      />
    </>
  );
}
