import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, CalendarDays, CreditCard, HandHeart, Landmark, Receipt, ShieldCheck } from "lucide-react";
import { getSection, getPage } from "@/lib/cms";
import { getGatewayConfig } from "@/lib/payments";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, formatDate, formatINR } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { ProgressBar } from "@/components/ui/stats";
import { listActiveCampaigns } from "@/server/donations";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { SafeImage } from "@/components/site/safe-image";
import { Markdown } from "@/components/site/markdown";
import { BankDetails } from "@/components/site/bank-details";
import { DonationForm } from "@/components/site/donation-form";
import { JsonLd } from "@/components/site/json-ld";

interface DonateSection {
  title: string;
  description?: string;
  note?: string;
  impacts?: { amount?: number | string; description?: string }[];
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSection<DonateSection>("donate.page");
  const title = "Donate";
  const description = s.description ?? stripHighlight(s.title);
  return { title, description, alternates: { canonical: absoluteUrl("/donate") }, openGraph: { title, description, url: absoluteUrl("/donate"), type: "website" } };
}

export default async function DonatePage({ searchParams }: Props) {
  const sp = await searchParams;
  const [section, campaigns, cfg, page, branding] = await Promise.all([getSection<DonateSection>("donate.page"), listActiveCampaigns(), getGatewayConfig(), getPage("donate"), getBranding()]);
  const initialCampaignId = typeof sp.campaign === "string" ? sp.campaign : undefined;
  const impacts = (section.impacts ?? [])
    .map((i) => ({ amount: Number(i.amount), description: (i.description ?? "").trim() }))
    .filter((i) => Number.isFinite(i.amount) && i.amount > 0 && i.description);
  const online = cfg.gateway === "razorpay";

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NGO",
          name: branding.siteName,
          url: absoluteUrl("/"),
          potentialAction: { "@type": "DonateAction", target: absoluteUrl("/donate"), recipient: { "@type": "NGO", name: branding.siteName } },
        }}
      />
      <PageHero eyebrow="Support a student" title={section.title} description={section.description} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Donate" }]}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href="#donate-form" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-orange-hover focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none">
            <HandHeart className="h-5 w-5" aria-hidden /> Donate now
          </a>
          <Link href="/contact?type=DONATION" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-base font-semibold text-navy transition-colors hover:bg-lavender focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none">
            Talk to us about CSR
          </Link>
        </div>
      </PageHero>

      {impacts.length > 0 && (
        <section className="bg-white py-16 sm:py-20" aria-labelledby="donate-impacts-title">
          <div className="container-x">
            <Reveal>
              <SectionHeading id="donate-impacts-title" label="What your gift does" title="Every Rupee Goes to [[Learning]]" description="Indicative costs from our training centers. Every donation, of any size, is pooled where it is needed most unless you choose a campaign." align="center" />
            </Reveal>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {impacts.map((i, idx) => (
                <Reveal as="li" key={`${i.amount}-${idx}`} delay={idx * 70} className="card card-hover flex h-full flex-col p-6">
                  <span className="font-heading text-3xl font-extrabold text-orange">{formatINR(i.amount)}</span>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink">{i.description}</p>
                  <Link href={`/donate?amount=${i.amount}#donate-form`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy hover:text-orange">
                    Give this amount <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {campaigns.length > 0 && (
        <section className="bg-lavender py-16 sm:py-20" aria-labelledby="donate-campaigns-title">
          <div className="container-x">
            <Reveal>
              <SectionHeading id="donate-campaigns-title" label="Active campaigns" title="Fund a [[Specific Goal]]" description="Progress is updated from confirmed donations only." align="center" />
            </Reveal>
            <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c, i) => {
                const hasGoal = c.goalAmount !== null && c.goalAmount > 0;
                const pct = hasGoal ? Math.min(100, Math.round((c.raisedAmount / (c.goalAmount as number)) * 100)) : null;
                const selected = c.id === initialCampaignId;
                return (
                  <Reveal as="li" key={c.id} delay={Math.min(i, 5) * 60}>
                    <article className={`card card-hover flex h-full flex-col overflow-hidden ${selected ? "ring-2 ring-orange" : ""}`}>
                      <div className="relative h-40 bg-navy">
                        {c.image ? (
                          <SafeImage src={c.image} alt={c.title} sizes="(max-width: 768px) 100vw, 33vw" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-linear-to-br from-navy to-navy-light">
                            <HandHeart className="h-10 w-10 text-white/60" aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="text-lg font-bold leading-snug text-navy">{c.title}</h3>
                        {c.description && <p className="mt-2 flex-1 text-sm text-muted">{c.description}</p>}
                        <div className="mt-4">
                          {pct !== null ? (
                            <ProgressBar value={pct} label={`${formatINR(c.raisedAmount)} raised of ${formatINR(c.goalAmount as number)}`} />
                          ) : (
                            <p className="text-sm">
                              <span className="font-semibold text-navy">{formatINR(c.raisedAmount)}</span> <span className="text-muted">raised so far</span>
                            </p>
                          )}
                          {c.endDate && (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                              <CalendarDays className="h-3.5 w-3.5 text-orange" aria-hidden /> Ends {formatDate(c.endDate)}
                            </p>
                          )}
                        </div>
                        <Link href={`/donate?campaign=${c.id}#donate-form`} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-dark" aria-current={selected ? "true" : undefined}>
                          {selected ? "Selected below" : "Support this campaign"} <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section id="donate-form" className="scroll-mt-24 bg-white py-16 sm:py-20" aria-labelledby="donate-form-title">
        <div className="container-x grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="card rounded-card-lg p-6 sm:p-8">
              <h2 id="donate-form-title" className="text-2xl font-extrabold text-navy">
                Make a donation
              </h2>
              <p className="mt-1 mb-6 text-sm text-muted">{online ? "Pay securely online by UPI, card or net banking." : "You will receive bank transfer / UPI details and a donation number to quote as reference."}</p>
              <DonationForm campaigns={campaigns.map((c) => ({ id: c.id, title: c.title }))} gateway={cfg.gateway} bankDetails={cfg.bankDetails || null} initialCampaignId={initialCampaignId} initialAmount={typeof sp.amount === "string" ? sp.amount : undefined} />
            </div>
          </div>
          <aside className="space-y-6 lg:col-span-5">
            <div className="card p-6">
              <h3 className="text-sm font-bold tracking-wide text-muted uppercase">How it works</h3>
              <ol className="mt-4 space-y-4">
                {[
                  { icon: HandHeart, title: "Choose an amount", text: "Pick a suggested amount or enter your own (minimum ₹100). Optionally direct it to a campaign." },
                  online ? { icon: CreditCard, title: "Pay online", text: "Checkout opens in a secure Razorpay window. Your donation is confirmed the moment the payment succeeds." } : { icon: Landmark, title: "Transfer the amount", text: "Use the bank / UPI details shown after this step and quote your donation number. Our team confirms it after reconciliation." },
                  { icon: Receipt, title: "Receive your receipt", text: "A receipt is issued for every confirmed donation and sent to the email you provide." },
                ].map((s) => (
                  <li key={s.title} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-light text-orange">
                      <s.icon className="h-4.5 w-4.5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-navy">{s.title}</span>
                      <span className="block text-sm text-muted">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            {cfg.bankDetails && (
              <div className="card p-6">
                <BankDetails value={cfg.bankDetails} />
              </div>
            )}
            {section.note && (
              <div className="flex items-start gap-3 rounded-card bg-lavender p-5 text-sm text-ink">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden />
                <p className="whitespace-pre-line">{section.note}</p>
              </div>
            )}
            {page?.content && (
              <div className="card p-6">
                <Markdown source={page.content} className="text-sm" />
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
