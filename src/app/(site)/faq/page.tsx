import type { Metadata } from "next";
import { HelpCircle } from "lucide-react";
import { getBranding } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { EmptyState } from "@/components/ui/feedback";
import { listFaqs } from "@/server/public";
import { PageHero } from "@/components/site/page-hero";
import { FaqAccordion, faqCategoryId } from "@/components/site/faq-accordion";
import { markdownExcerpt } from "@/components/site/markdown";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand } from "@/components/site/cta-band";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding();
  const title = "Frequently Asked Questions";
  const description = `Answers to common questions about ${b.siteName} admissions, fees, scholarships, training centers, certificates and volunteering.`;
  return { title, description, alternates: { canonical: absoluteUrl("/faq") }, openGraph: { title, description, url: absoluteUrl("/faq"), type: "website" } };
}

export default async function FaqPage() {
  const faqs = await listFaqs();
  const categories = [...new Set(faqs.map((f) => f.category?.trim() || "General"))];

  return (
    <>
      {faqs.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            url: absoluteUrl("/faq"),
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: markdownExcerpt(f.answer, 2000) } })),
          }}
        />
      )}
      <PageHero compact align="center" eyebrow="Help center" title="Frequently Asked [[Questions]]" description="Everything you need to know about applying, fees, scholarships, training centers and certificates." breadcrumbs={[{ label: "Home", href: "/" }, { label: "FAQ" }]} />

      <section className="bg-lavender py-14 sm:py-20" aria-labelledby="faq-list-title">
        <div className="container-x">
          <div className="mx-auto max-w-3xl">
            <h2 id="faq-list-title" className="sr-only">
              Questions and answers
            </h2>
            {faqs.length === 0 ? (
              <EmptyState icon={<HelpCircle className="h-7 w-7" />} title="No questions published yet" description="Our FAQ is being prepared. In the meantime, send us your question and we will reply personally." />
            ) : (
              <>
                {categories.length > 1 && (
                  <nav aria-label="Jump to a category" className="mb-8 flex flex-wrap justify-center gap-2">
                    {categories.map((c) => (
                      <a key={c} href={`#${faqCategoryId(c)}`} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-navy shadow-card transition-colors hover:bg-navy hover:text-white">
                        {c}
                      </a>
                    ))}
                  </nav>
                )}
                <FaqAccordion faqs={faqs} />
              </>
            )}
          </div>
        </div>
      </section>

      <CtaBand title="Still have a [[question]]?" description="Our team replies to every enquiry, usually within two working days." primary={{ label: "Ask Us", href: "/contact" }} secondary={{ label: "Browse Courses", href: "/courses" }} />
    </>
  );
}
