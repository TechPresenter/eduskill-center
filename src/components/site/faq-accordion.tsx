import { Plus } from "lucide-react";
import { Markdown } from "@/components/site/markdown";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

/**
 * Accessible accordion built on native <details>/<summary>, grouped by category.
 *
 * Native elements on purpose: it opens with no JavaScript, it is already keyboard- and
 * screen-reader-correct, and on a slow Android phone the first question is interactive the moment
 * the HTML lands. The marker is a rotating plus (a plus reads as "expand" where a chevron can read
 * as "next"), and the whole 56px summary row is the target.
 */
export function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  const groups = new Map<string, FaqItem[]>();
  for (const f of faqs) {
    const key = f.category?.trim() || "General";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  return (
    <div className="space-y-12">
      {[...groups.entries()].map(([category, items]) => (
        <section key={category} id={faqCategoryId(category)} aria-labelledby={`${faqCategoryId(category)}-title`} className="scroll-mt-28">
          <h2 id={`${faqCategoryId(category)}-title`} className="mb-5 flex items-center gap-3 text-h3 text-navy">
            {category}
            <span aria-hidden className="h-px flex-1 bg-line" />
            <span className="text-caption font-semibold text-muted tabular-nums">{items.length}</span>
          </h2>
          <ul className="space-y-3">
            {items.map((f) => (
              <li key={f.id}>
                <details className="group card overflow-hidden transition-shadow duration-micro ease-soft open:shadow-e2 motion-reduce:transition-none">
                  <summary className="ring-focus flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-h4 text-navy transition-colors duration-micro marker:content-none hover:bg-surface group-open:bg-surface motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">{f.question}</span>
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-light text-orange">
                      <Plus className="h-4 w-4 transition-transform duration-micro ease-soft group-open:rotate-45 motion-reduce:transition-none" />
                    </span>
                  </summary>
                  <div className="border-t border-line px-5 py-4">
                    <Markdown source={f.answer} className="text-body" />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Stable DOM id for a FAQ category section (used by the jump navigation on /faq). */
export function faqCategoryId(category: string) {
  return `faq-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general"}`;
}
