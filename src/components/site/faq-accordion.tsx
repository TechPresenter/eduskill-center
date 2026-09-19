import { ChevronDown } from "lucide-react";
import { Markdown } from "@/components/site/markdown";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

/** Accessible accordion built on native <details>/<summary>, grouped by category. */
export function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  const groups = new Map<string, FaqItem[]>();
  for (const f of faqs) {
    const key = f.category?.trim() || "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return (
    <div className="space-y-10">
      {[...groups.entries()].map(([category, items]) => (
        <section key={category} id={faqCategoryId(category)} aria-labelledby={`${faqCategoryId(category)}-title`} className="scroll-mt-24">
          <h2 id={`${faqCategoryId(category)}-title`} className="mb-4 text-xl font-extrabold text-navy sm:text-2xl">
            {category}
          </h2>
          <div className="space-y-3">
            {items.map((f) => (
              <details key={f.id} className="group card overflow-hidden open:shadow-card-hover">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-navy marker:content-none [&::-webkit-details-marker]:hidden">
                  {f.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-orange transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-line px-5 py-4">
                  <Markdown source={f.answer} className="text-[15px]" />
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Stable DOM id for a FAQ category section (used by the jump navigation on /faq). */
export function faqCategoryId(category: string) {
  return `faq-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general"}`;
}
