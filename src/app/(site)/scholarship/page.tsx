import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Coins, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { stripHighlight } from "@/components/ui/highlight";
import { EmptyState } from "@/components/ui/feedback";
import { getSection, getPage } from "@/lib/cms";
import { getSessionUser } from "@/lib/auth/session";
import { absoluteUrl, cn, formatINR, titleCase } from "@/lib/utils";
import { listScholarshipPrograms } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionBg, IconTile } from "@/components/site/decor";
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

      <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="scholarship-programs-title">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10">
          <Reveal>
            <SectionHeading
              id="scholarship-programs-title"
              label="Active programs"
              title="Scholarship [[Programs]]"
              description="Each application is assessed individually; the programme and the amount are decided by the Foundation during review."
              align="center"
            />
          </Reveal>
          {programs.length === 0 ? (
            <EmptyState
              className="mx-auto mt-12 max-w-2xl"
              title="No scholarship programme is open right now"
              description="That does not close the door. Tick the scholarship option in your application and our team will review your case individually."
              action={
                <ButtonLink href={applyHref(user)} variant="navy">
                  Apply with a scholarship request
                </ButtonLink>
              }
            />
          ) : (
            <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {programs.map((p, i) => (
                <Reveal as="li" key={p.id} delay={Math.min(i, 5) * 70} className="card card-hover flex h-full flex-col card-p">
                  <div className="flex items-start justify-between gap-3">
                    <IconTile icon={p.percentage ? Percent : Coins} tone="orange" size="lg" />
                    <Badge tone="navy">{titleCase(p.type)}</Badge>
                  </div>
                  <h3 className="mt-4 text-h3 text-navy">{p.name}</h3>
                  {/* The award is the headline figure of the card — it is what the reader came for. */}
                  <p className="mt-3 font-heading text-3xl font-extrabold text-orange tabular-nums">
                    {p.percentage ? `${p.percentage}%` : p.fixedAmount ? formatINR(p.fixedAmount) : "Case by case"}
                    {(p.percentage || p.fixedAmount) && <span className="ml-1.5 text-body-sm font-semibold text-muted">{p.percentage ? "of course fee" : "fixed support"}</span>}
                  </p>
                  {p.maxAmount !== null && p.maxAmount > 0 && <p className="mt-1 text-caption text-muted">Up to {formatINR(p.maxAmount)} per student</p>}
                  {p.description && <p className="mt-3 flex-1 text-body text-muted">{p.description}</p>}
                  {p.eligibilityCriteria && (
                    <p className="mt-4 rounded-card bg-surface p-3 text-body-sm text-ink">
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

      {(eligibility.length > 0 || process.length > 0) && (
        <section className="relative overflow-x-clip bg-lavender section-y" aria-label="Eligibility and process">
          <SectionBg variant="grid" />
          <div className="container-x relative z-10 grid gap-6 lg:grid-cols-2">
            {eligibility.length > 0 && (
              <Reveal className="card rounded-card-lg p-7 sm:p-8">
                <p className="eyebrow mb-2">Who can apply</p>
                <h2 className="text-h2 text-navy">Eligibility</h2>
                <ul className="mt-6 space-y-3">
                  {eligibility.map((e) => (
                    <li key={e} className="flex items-start gap-3 text-body text-ink">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-dark" aria-hidden />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
            {process.length > 0 && (
              <Reveal delay={100} className="card rounded-card-lg p-7 sm:p-8">
                <p className="eyebrow mb-2">How it works</p>
                <h2 className="text-h2 text-navy">Application process</h2>
                {/*
                 * The connector is drawn on every step except the last, so the list reads as one
                 * sequence rather than four loose rows. Pure border — no extra element, no JS.
                 */}
                <ol className="mt-6">
                  {process.map((step, i) => (
                    <li key={step} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange font-heading text-body-sm font-extrabold text-white tabular-nums">{i + 1}</span>
                        {i < process.length - 1 && <span aria-hidden className="w-px flex-1 bg-line" />}
                      </div>
                      <span className={cn("pt-1.5 text-body text-ink", i < process.length - 1 && "pb-6")}>{step}</span>
                    </li>
                  ))}
                </ol>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {page && (
        <section className="relative overflow-x-clip bg-white section-y" aria-label="More about scholarships">
          <SectionBg variant="dots" />
          <div className="container-x relative z-10">
            <div className="card rounded-card-lg mx-auto max-w-3xl p-6 sm:p-10">
              <Markdown source={page.content} />
            </div>
          </div>
        </section>
      )}

      <CtaBand
        title="Don't let fees stop your [[learning]]"
        description="Register, choose your course and tick the scholarship option. Our team reviews every request."
        primary={{ label: "Register & Apply", href: "/register" }}
        secondary={{ label: "Ask a Question", href: "/contact?type=ADMISSION" }}
      />
    </>
  );
}
