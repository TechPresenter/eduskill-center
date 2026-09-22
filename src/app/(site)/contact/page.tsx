import type { Metadata } from "next";
import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { getBranding } from "@/lib/settings";
import { getPage } from "@/lib/cms";
import { absoluteUrl } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { Markdown } from "@/components/site/markdown";
import { SectionBg, IconTile } from "@/components/site/decor";
import { JsonLd } from "@/components/site/json-ld";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

interface ContactCard {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding();
  const title = "Contact Us";
  const description = `Get in touch with ${b.siteName} for admissions, volunteering, partnerships and donations.`;
  return { title, description, alternates: { canonical: absoluteUrl("/contact") }, openGraph: { title, description, url: absoluteUrl("/contact"), type: "website" } };
}

export default async function ContactPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [branding, page] = await Promise.all([getBranding(), getPage("contact")]);
  const c = branding.contact;
  const waDigits = c.whatsapp.replace(/\D/g, "");
  const waHref = waDigits ? `https://wa.me/${waDigits.length === 10 ? `91${waDigits}` : waDigits}` : null;
  const cards: ContactCard[] = [];
  if (c.email) cards.push({ icon: Mail, label: "Email", value: c.email, href: `mailto:${c.email}` });
  if (c.phone) cards.push({ icon: Phone, label: "Phone", value: c.phone, href: `tel:${c.phone.replace(/[^\d+]/g, "")}` });
  if (waHref) cards.push({ icon: MessageCircle, label: "WhatsApp", value: c.whatsapp, href: waHref, external: true });
  if (c.address) cards.push({ icon: MapPin, label: "Office", value: c.address });
  if (c.hours) cards.push({ icon: Clock, label: "Office hours", value: c.hours });

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ContactPage", name: "Contact Us", url: absoluteUrl("/contact"), mainEntity: { "@type": "Organization", name: branding.siteName, email: c.email || undefined, telephone: c.phone || undefined } }} />

      <PageHero
        eyebrow="Contact"
        title="We're Here to [[Help]]"
        description={page?.excerpt ?? "Questions about admissions, volunteering, partnerships or donations? Send us a message and our team will get back to you."}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
        compact
      />

      <section className="relative overflow-x-clip bg-surface section-y">
        <SectionBg variant="mesh" />
        <div className="container-x relative z-10 grid gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Ways to reach us first on a phone — a tap-to-call beats a form when you are on data. */}
          <div className="lg:col-span-5 xl:col-span-4">
            <h2 className="text-h3 text-navy">Ways to reach us</h2>
            <ul className="mt-5 space-y-3">
              {cards.map((card) => {
                const body = (
                  <>
                    <IconTile icon={card.icon} tone="orange" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-overline text-muted">{card.label}</span>
                      <span className="mt-1 block break-words whitespace-pre-line text-body font-semibold text-ink">{card.value}</span>
                    </span>
                    {card.href && <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted transition-colors duration-micro group-hover:text-orange motion-reduce:transition-none" aria-hidden />}
                  </>
                );
                return (
                  <li key={card.label}>
                    {card.href ? (
                      <a
                        href={card.href}
                        target={card.external ? "_blank" : undefined}
                        rel={card.external ? "noopener noreferrer" : undefined}
                        className="group card card-hover ring-focus flex items-start gap-4 p-5"
                      >
                        {body}
                      </a>
                    ) : (
                      <div className="card flex items-start gap-4 p-5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {page?.content && (
              <div className="card mt-3 p-5">
                <Markdown source={page.content} className="text-body-sm" />
              </div>
            )}
          </div>

          <div className="lg:col-span-7 xl:col-span-8">
            <div className="card rounded-card-lg p-6 sm:p-8">
              <h2 className="text-h2 text-navy">Send us a message</h2>
              <p className="mt-2 mb-7 text-body text-muted">Fields marked * are required. A real person reads every message — we usually reply within two working days.</p>
              <EnquiryForm defaultType={typeof sp.type === "string" ? sp.type : undefined} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
