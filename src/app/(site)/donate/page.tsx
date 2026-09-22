import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, CalendarDays, CreditCard, HandHeart, Landmark, Receipt, ShieldCheck } from "lucide-react";
import { getSection, getPage } from "@/lib/cms";
import { getGatewayConfig } from "@/lib/payments";
import { getBranding } from "@/lib/settings";
import { absoluteUrl, cn, formatDate, formatINR } from "@/lib/utils";
import { stripHighlight } from "@/components/ui/highlight";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/stats";
import { listActiveCampaigns } from "@/server/donations";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SectionBg, IconTile } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { Media } from "@/components/site/safe-image";
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

  const steps = [
    { icon: HandHeart, title: "Choose an amount", text: "Pick a suggested amount or enter your own (minimum ₹100). Optionally direct it to a campaign." },
    online
      ? { icon: CreditCard, title: "Pay online", text: "Checkout opens in a secure Razorpay window. Your donation is confirmed the moment the payment succeeds." }
      : { icon: Landmark, title: "Transfer the amount", text: "Use the bank / UPI details shown after this step and quote your donation number. Our team confirms it after reconciliation." },
    { icon: Receipt, title: "Receive your receipt", text: "A receipt is issued for every confirmed donation and sent to the email you provide." },
  ];

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
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="#donate-form" size="lg" leftIcon={<HandHeart className="h-5 w-5" />}>
            Donate now
          </ButtonLink>
          <ButtonLink href="/contact?type=DONATION" size="lg" variant="white">
            Talk to us about CSR
          </ButtonLink>
        </div>
      </PageHero>

      {impacts.length > 0 && (
        <section className="relative overflow-x-clip bg-white section-y" aria-labelledby="donate-impacts-title">
          <SectionBg variant="mesh" />
          <div className="container-x relative z-10">
            <Reveal>
              <SectionHeading
                id="donate-impacts-title"
                label="What your gift does"
                title="Every Rupee Goes to [[Learning]]"
                description="Indicative costs from our training centers. Every donation, of any size, is pooled where it is needed most unless you choose a campaign."
                align="center"
              />
            </Reveal>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {impacts.map((i, idx) => (
                <Reveal as="li" key={`${i.amount}-${idx}`} delay={idx * 70}>
                  {/* The amount is the card's headline — it is the decision the reader is making. */}
                  <Link href={`/donate?amount=${i.amount}#donate-form`} className="card card-hover ring-focus group flex h-full flex-col card-p">
                    <span className="font-heading text-3xl font-extrabold text-orange tabular-nums">{formatINR(i.amount)}</span>
                    <p className="mt-3 flex-1 text-body text-ink">{i.description}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 border-t border-line pt-4 text-body-sm font-semibold text-navy transition-colors duration-micro group-hover:text-orange motion-reduce:transition-none">
                      Give this amount
                      <ArrowDown className="h-4 w-4 transition-transform duration-micro group-hover:translate-y-0.5 motion-reduce:transition-none" aria-hidden />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {campaigns.length > 0 && (
        <section className="relative overflow-x-clip bg-lavender section-y" aria-labelledby="donate-campaigns-title">
          <SectionBg variant="grid" />
          <div className="container-x relative z-10">
            <Reveal>
              <SectionHeading id="donate-campaigns-title" label="Active campaigns" title="Fund a [[Specific Goal]]" description="Progress is updated from confirmed donations only." align="center" />
            </Reveal>
            <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {campaigns.map((c, i) => {
                const hasGoal = c.goalAmount !== null && c.goalAmount > 0;
                const pct = hasGoal ? Math.min(100, Math.round((c.raisedAmount / (c.goalAmount as number)) * 100)) : null;
                const selected = c.id === initialCampaignId;
                return (
                  <Reveal as="li" key={c.id} delay={Math.min(i, 5) * 60}>
                    <article className={cn("card card-hover flex h-full flex-col overflow-hidden", selected && "ring-2 ring-orange")}>
                      <div className="rounded-t-card">
                        <Media src={c.image} alt={c.image ? c.title : ""} seed={c.id} ratio="16x9" tone="navy" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                      </div>
                      <div className="flex flex-1 flex-col card-p">
                        <h3 className="text-h3 text-navy">{c.title}</h3>
                        {c.description && <p className="mt-2 line-clamp-3 flex-1 text-body text-muted">{c.description}</p>}
                        <div className="mt-4 border-t border-line pt-4">
                          {pct !== null ? (
                            <ProgressBar value={pct} label={`${formatINR(c.raisedAmount)} raised of ${formatINR(c.goalAmount as number)}`} />
                          ) : (
                            <p className="text-body">
                              <span className="font-heading font-extrabold text-navy tabular-nums">{formatINR(c.raisedAmount)}</span> <span className="text-muted">raised so far</span>
                            </p>
                          )}
                          {c.endDate && (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-caption text-muted">
                              <CalendarDays className="h-3.5 w-3.5 text-orange" aria-hidden /> Ends {formatDate(c.endDate)}
                            </p>
                          )}
                        </div>
                        <ButtonLink href={`/donate?campaign=${c.id}#donate-form`} variant="navy" fullWidth className="mt-4" rightIcon={<ArrowRight className="h-4 w-4" />} aria-current={selected ? "true" : undefined}>
                          {selected ? "Selected below" : "Support this campaign"}
                        </ButtonLink>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section id="donate-form" className="relative scroll-mt-24 overflow-x-clip bg-white section-y" aria-labelledby="donate-form-title">
        <SectionBg variant="dots" />
        <div className="container-x relative z-10 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <div className="card rounded-card-lg p-6 sm:p-8">
              <h2 id="donate-form-title" className="text-h2 text-navy">
                Make a donation
              </h2>
              <p className="mt-2 mb-7 text-body text-muted">{online ? "Pay securely online by UPI, card or net banking." : "You will receive bank transfer / UPI details and a donation number to quote as reference."}</p>
              <DonationForm
                campaigns={campaigns.map((c) => ({ id: c.id, title: c.title }))}
                gateway={cfg.gateway}
                bankDetails={cfg.bankDetails || null}
                initialCampaignId={initialCampaignId}
                initialAmount={typeof sp.amount === "string" ? sp.amount : undefined}
              />
            </div>
          </div>

          <aside className="space-y-5 lg:col-span-5">
            <div className="card card-p">
              <h3 className="text-overline text-muted">How it works</h3>
              {/* Numbered connector, same device as the scholarship process list — one sequence, not three cards. */}
              <ol className="mt-4">
                {steps.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <IconTile icon={s.icon} tone="orange" size="sm" />
                      {i < steps.length - 1 && <span aria-hidden className="w-px flex-1 bg-line" />}
                    </div>
                    <div className={cn("min-w-0", i < steps.length - 1 && "pb-5")}>
                      <p className="text-h4 text-navy">{s.title}</p>
                      <p className="mt-1 text-body-sm text-muted">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {cfg.bankDetails && (
              <div className="card card-p">
                <BankDetails value={cfg.bankDetails} />
              </div>
            )}

            {section.note && (
              <div className="flex items-start gap-3 rounded-card border border-navy/10 bg-lavender p-5 text-body text-ink">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden />
                <p className="whitespace-pre-line">{section.note}</p>
              </div>
            )}

            {page?.content && (
              <div className="card card-p">
                <Markdown source={page.content} className="text-body-sm" />
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
