import type { Metadata } from "next";
import { ArrowRight, Building2, Landmark, Map, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { stripHighlight } from "@/components/ui/highlight";
import { getSection } from "@/lib/cms";
import { getSetting } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { CtaBand } from "@/components/site/cta-band";

interface TrainerSection {
  title: string;
  description?: string;
  benefits?: { icon?: string; title: string; description?: string }[];
  levels?: { title: string; description?: string }[];
}

const LEVEL_META = [
  { key: "BLOCK", icon: Building2, requirements: ["Resident of the block or nearby", "Graduate / diploma or trade certification", "Minimum 1 year of relevant experience", "Available for at least one batch a week"] },
  { key: "DISTRICT", icon: Landmark, requirements: ["Willing to travel within the district", "Graduate with 3+ years of experience", "Prior teaching or mentoring experience", "Can support new block-level trainers"] },
  { key: "STATE", icon: Map, requirements: ["Willing to travel across the state", "Post-graduate or 5+ years of industry experience", "Curriculum or master-trainer experience", "Leads trainer development sessions"] },
];

const PROCESS_STEPS = [
  { title: "Apply", description: "Fill the online volunteer trainer application with your skills and availability." },
  { title: "Review", description: "The Foundation reviews your profile and may request additional documents." },
  { title: "Verification", description: "Your identity and qualification documents are verified." },
  { title: "Interview", description: "A short conversation (online or in person) with our team." },
  { title: "Approval", description: "Approved trainers receive a welcome email and portal access." },
  { title: "Trainer ID", description: "You are issued an official EduSkill Trainer ID." },
  { title: "Assignment", description: "You are assigned to a center and batch that fits your level." },
];

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSection<TrainerSection>("trainer.page");
  const title = "Become a Volunteer Trainer";
  const description = s.description ?? stripHighlight(s.title);
  return { title, description, alternates: { canonical: absoluteUrl("/become-a-trainer") }, openGraph: { title, description, url: absoluteUrl("/become-a-trainer"), type: "website" } };
}

export default async function BecomeTrainerPage() {
  const [section, open] = await Promise.all([getSection<TrainerSection>("trainer.page"), getSetting<boolean>("admissions.trainerApplicationsOpen").catch(() => true)]);
  const levels = (section.levels ?? []).slice(0, 3);

  return (
    <>
      <PageHero eyebrow="Volunteer with us" title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Become a Trainer" }]}>
        <div className="flex flex-col gap-3 sm:flex-row">
          {open !== false ? (
            <ButtonLink href="/become-a-trainer/apply" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Apply Now
            </ButtonLink>
          ) : (
            <span className="inline-flex h-12 items-center rounded-xl bg-white/10 px-6 text-sm font-semibold text-white">Applications are currently closed</span>
          )}
          <ButtonLink href="/become-a-trainer/status" size="lg" variant="white" leftIcon={<Search className="h-4 w-4" />}>
            Track application
          </ButtonLink>
        </div>
      </PageHero>

      {(section.benefits ?? []).length > 0 && (
        <section className="bg-white py-16 sm:py-20" aria-labelledby="trainer-benefits-title">
          <div className="container-x">
            <Reveal>
              <SectionHeading id="trainer-benefits-title" label="Why volunteer" title="What You [[Gain]] as a Trainer" align="center" />
            </Reveal>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(section.benefits ?? []).map((b, i) => (
                <Reveal as="li" key={i} delay={i * 70} className="card card-hover p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-light text-orange">
                    <DynamicIcon name={b.icon} className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-navy">{b.title}</h3>
                  {b.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{b.description}</p>}
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="bg-lavender py-16 sm:py-20" aria-labelledby="trainer-levels-title">
        <div className="container-x">
          <Reveal>
            <SectionHeading id="trainer-levels-title" label="Volunteer levels" title="Choose the Level That [[Fits You]]" description="Trainers are registered at block, district or state level. Location details required in the application depend on the level you choose." align="center" />
          </Reveal>
          <ul className="mt-12 grid gap-6 lg:grid-cols-3">
            {LEVEL_META.map((meta, i) => {
              const lvl = levels[i];
              const Icon = meta.icon;
              return (
                <Reveal as="li" key={meta.key} delay={i * 90} className="card card-hover flex h-full flex-col p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-white">
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    <h3 className="text-xl font-extrabold text-navy">{lvl?.title ?? `${meta.key.charAt(0)}${meta.key.slice(1).toLowerCase()} Level`}</h3>
                  </div>
                  {lvl?.description && <p className="mt-4 text-sm leading-relaxed text-muted">{lvl.description}</p>}
                  <h4 className="mt-5 text-xs font-bold tracking-wide text-orange uppercase">Typical requirements</h4>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink">
                    {meta.requirements.map((r) => (
                      <li key={r} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange" aria-hidden />
                        {r}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20" aria-labelledby="trainer-process-title">
        <div className="container-x">
          <Reveal>
            <SectionHeading id="trainer-process-title" label="How it works" title="From Application to [[Assignment]]" align="center" />
          </Reveal>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {PROCESS_STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 60} className="relative flex flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange font-heading text-base font-extrabold text-white shadow-card">{i + 1}</span>
                <h3 className="mt-4 text-base font-bold text-navy">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{s.description}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand title="Ready to [[teach]]?" description="Applications take about 10 minutes. Keep your resume, qualification certificate and an ID document handy." primary={open !== false ? { label: "Apply Now", href: "/become-a-trainer/apply" } : undefined} secondary={{ label: "Track application", href: "/become-a-trainer/status" }} />
    </>
  );
}
