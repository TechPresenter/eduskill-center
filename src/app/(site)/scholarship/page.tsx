import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Coins, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { stripHighlight } from "@/components/ui/highlight";
import { getSection, getPage } from "@/lib/cms";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl, formatINR, titleCase } from "@/lib/utils";
import { listScholarshipPrograms } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { Markdown } from "@/components/site/markdown";
import { CtaBand } from "@/components/site/cta-band";
import { applyHref } from "@/components/site/apply-link";

interface ScholarshipSection {
  title: string;
  description?: string;
  eligibility?: string;
  process?: string;
}

const lines = (s: string | undefined) => (s ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSection<ScholarshipSection>("scholarship.page");
  const title = "Scholarships";
  const description = s.description ?? stripHighlight(s.title);
  return { title, description, alternates: { canonical: absoluteUrl("/scholarship") }, openGraph: { title, description, url: absoluteUrl("/scholarship"), type: "website" } };
}

export default async function ScholarshipPage() {
  const [section, programs, page, user] = await Promise.all([getSection<ScholarshipSection>("scholarship.page"), listScholarshipPrograms(), getPage("scholarship"), getSessionUser().catch(() => null)]);
  const eligibility = lines(section.eligibility);
  const process = lines(section.process);

  return (
    <>
      <PageHero eyebrow="Scholarships" title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Scholarship" }]}>
        <ButtonLink href={applyHref(user)} size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
          Apply with Scholarship Request
        </ButtonLink>
      </PageHero>

      <section className="bg-white py-16 sm:py-20" aria-labelledby="scholarship-programs-title">
        <div className="container-x">
          <Reveal>
            <SectionHeading id="scholarship-programs-title" label="Active programs" title="Scholarship [[Programs]]" description="Each application is assessed individually; the program and amount are decided by the Foundation during review." align="center" />
          </Reveal>
          {programs.length === 0 ? (
            <p className="card mx-auto mt-10 max-w-xl p-6 text-center text-sm text-muted">No scholarship program is open right now. You can still tick &ldquo;I need scholarship support&rdquo; in your application and our team will review your case.</p>
          ) : (
            <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {programs.map((p, i) => (
                <Reveal as="li" key={p.id} delay={i * 80} className="card card-hover flex h-full flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-light text-orange">{p.percentage ? <Percent className="h-6 w-6" aria-hidden /> : <Coins className="h-6 w-6" aria-hidden />}</span>
                    <Badge tone="navy">{titleCase(p.type)}</Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold text-navy">{p.name}</h3>
                  <p className="mt-2 font-heading text-3xl font-extrabold text-orange">
                    {p.percentage ? `${p.percentage}%` : p.fixedAmount ? formatINR(p.fixedAmount) : "Case by case"}
                    <span className="ml-1 text-sm font-semibold text-muted">{p.percentage ? "of course fee" : p.fixedAmount ? "fixed support" : ""}</span>
                  </p>
                  {p.maxAmount !== null && p.maxAmount > 0 && <p className="text-xs text-muted">Up to {formatINR(p.maxAmount)} per student</p>}
                  {p.description && <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{p.description}</p>}
                  {p.eligibilityCriteria && (
                    <p className="mt-4 rounded-xl bg-surface p-3 text-xs text-ink">
                      <span className="font-semibold text-navy">Eligibility: </span>
                      {p.eligibilityCriteria}
                    </p>
                  )}
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-lavender py-16 sm:py-20">
        <div className="container-x grid gap-8 lg:grid-cols-2">
          {eligibility.length > 0 && (
            <Reveal className="card rounded-card-lg p-7 sm:p-8">
              <p className="eyebrow mb-2">Who can apply</p>
              <h2 className="text-2xl font-extrabold text-navy">Eligibility</h2>
              <ul className="mt-5 space-y-3">
                {eligibility.map((e) => (
                  <li key={e} className="flex items-start gap-3 text-[15px] text-ink">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                    {e}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
          {process.length > 0 && (
            <Reveal delay={100} className="card rounded-card-lg p-7 sm:p-8">
              <p className="eyebrow mb-2">How it works</p>
              <h2 className="text-2xl font-extrabold text-navy">Application process</h2>
              <ol className="mt-5 space-y-4">
                {process.map((step, i) => (
                  <li key={step} className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange font-heading text-sm font-extrabold text-white">{i + 1}</span>
                    <span className="pt-1.5 text-[15px] text-ink">{step}</span>
                  </li>
                ))}
              </ol>
            </Reveal>
          )}
        </div>
      </section>

      {page && (
        <section className="bg-white py-16 sm:py-20">
          <div className="container-x">
            <div className="mx-auto max-w-3xl">
              <Markdown source={page.content} />
            </div>
          </div>
        </section>
      )}

      <CtaBand title="Don't let fees stop your [[learning]]" description="Register, choose your course and tick the scholarship option. Our team reviews every request." primary={{ label: "Register & Apply", href: "/register" }} secondary={{ label: "Ask a Question", href: "/contact?type=ADMISSION" }} />
    </>
  );
}
