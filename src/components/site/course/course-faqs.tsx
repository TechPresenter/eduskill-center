import { Plus } from "lucide-react";
import { Markdown } from "@/components/site/markdown";

export interface CourseFaqItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * FAQs for this course, in the order the Foundation arranged them.
 *
 * Same native `<details>` idiom as the site-wide FAQ accordion (`src/components/site/faq-accordion`),
 * minus its category grouping, which a per-course list does not have: no JavaScript, correct
 * keyboard and screen-reader behaviour for free, and the whole summary row is the tap target.
 */
export function CourseFaqs({ faqs }: { faqs: CourseFaqItem[] }) {
  if (faqs.length === 0) return null;
  return (
    <ul className="mx-auto max-w-3xl space-y-3">
      {faqs.map((f) => (
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
  );
}
