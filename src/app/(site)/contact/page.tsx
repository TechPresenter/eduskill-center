import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { getBranding } from "@/lib/settings";
import { getPage } from "@/lib/cms";
import { absoluteUrl } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { Markdown } from "@/components/site/markdown";
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
      <PageHero eyebrow="Contact" title="We're Here to [[Help]]" description={page?.excerpt ?? "Questions about admissions, volunteering, partnerships or donations? Send us a message and our team will get back to you."} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]} compact />

      <section className="container-x grid gap-10 py-14 lg:grid-cols-12 lg:py-20">
        <div className="space-y-4 lg:col-span-4">
          {cards.map((card) => {
            const Icon = card.icon;
            const body = (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-light text-orange">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold tracking-wide text-muted uppercase">{card.label}</span>
                  <span className="mt-0.5 block whitespace-pre-line break-words text-sm font-medium text-ink">{card.value}</span>
                </span>
              </>
            );
            return card.href ? (
              <a key={card.label} href={card.href} target={card.external ? "_blank" : undefined} rel={card.external ? "noopener noreferrer" : undefined} className="card card-hover flex items-start gap-4 p-5">
                {body}
              </a>
            ) : (
              <div key={card.label} className="card flex items-start gap-4 p-5">
                {body}
              </div>
            );
          })}
          {page?.content && (
            <div className="card p-5">
              <Markdown source={page.content} className="text-sm" />
            </div>
          )}
        </div>
        <div className="lg:col-span-8">
          <div className="card rounded-card-lg p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold text-navy">Send us a message</h2>
            <p className="mt-1 mb-6 text-sm text-muted">Fields marked * are required. We never share your details.</p>
            <EnquiryForm defaultType={typeof sp.type === "string" ? sp.type : undefined} />
          </div>
        </div>
      </section>
    </>
  );
}
