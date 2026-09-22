import Link from "next/link";
import { ArrowRight, BookOpen, Home, MapPin, MessageCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { SectionBg } from "@/components/site/decor";

const LINKS = [
  { href: "/courses", label: "Browse courses", description: "Short, practical courses at local training centers.", icon: BookOpen },
  { href: "/training-centers", label: "Find a training center", description: "Search by state, district, block or course.", icon: MapPin },
  { href: "/contact", label: "Contact us", description: "Tell us what you were looking for and we will help.", icon: MessageCircle },
];

/**
 * Branded 404 body shared by the root and site-level not-found pages.
 *
 * A dead end is a navigation problem, not an apology: the page names what happened once, then spends
 * the rest of its space on the three destinations a lost visitor actually wants. The oversized ghost
 * "404" that used to sit here was removed — it was pulled back over the heading with negative margins
 * that had to be re-tuned at every breakpoint, and it said nothing the eyebrow does not.
 */
export function NotFoundContent() {
  return (
    <section className="section-y relative isolate overflow-hidden bg-lavender" aria-labelledby="not-found-title">
      <SectionBg variant="rings" />
      <div className="container-x relative z-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow justify-center">Error 404</p>
          <h1 id="not-found-title" className="text-h1 mt-3 text-navy">
            We couldn&rsquo;t find that page
          </h1>
          <p className="text-body-lg mt-4 text-muted">
            The link may be outdated, or the page may have moved. Nothing is lost — here are a few places to pick the thread back up.
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/" size="lg" leftIcon={<Home className="h-4 w-4" />}>
              Back to homepage
            </ButtonLink>
          </div>
        </div>

        {/*
         * Left-aligned rows rather than centred blocks: the eye finds the label, the description and
         * the affordance in one pass, and the layout survives a 360px screen without hyphenating.
         */}
        <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="card card-hover ring-focus group flex h-full flex-col p-5 sm:p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-orange-light text-orange transition-colors duration-micro group-hover:bg-orange group-hover:text-white motion-reduce:transition-none">
                  <l.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-h4 mt-4 text-navy">{l.label}</span>
                <span className="text-body-sm mt-1.5 flex-1 text-muted">{l.description}</span>
                <span className="text-body-sm mt-4 inline-flex items-center gap-1 font-semibold text-orange">
                  Go
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-micro group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
