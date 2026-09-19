import Link from "next/link";
import { ArrowRight, BookOpen, Home, MapPin, MessageCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const LINKS = [
  { href: "/courses", label: "Browse courses", description: "Short, practical courses at local training centers.", icon: BookOpen },
  { href: "/training-centers", label: "Find a training center", description: "Search by state, district, block or course.", icon: MapPin },
  { href: "/contact", label: "Contact us", description: "Tell us what you were looking for and we will help.", icon: MessageCircle },
];

/** Branded 404 body shared by the root and site-level not-found pages. */
export function NotFoundContent() {
  return (
    <section className="bg-lavender" aria-labelledby="not-found-title">
      <div className="container-x py-16 text-center sm:py-24">
        <p className="eyebrow justify-center">Error 404</p>
        <p aria-hidden className="mt-4 font-heading text-[5rem] leading-none font-extrabold text-navy/10 sm:text-[7rem]">
          404
        </p>
        <h1 id="not-found-title" className="section-title -mt-6 sm:-mt-10">
          We couldn&rsquo;t find that page
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">The link may be outdated or the page may have moved. Here are a few places to continue.</p>
        <div className="mt-8 flex justify-center">
          <ButtonLink href="/" size="lg" leftIcon={<Home className="h-4 w-4" />}>
            Back to homepage
          </ButtonLink>
        </div>
        <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="card card-hover group flex h-full flex-col items-center p-6 text-center focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-light text-orange transition-colors group-hover:bg-orange group-hover:text-white">
                  <l.icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="mt-4 text-base font-bold text-navy">{l.label}</span>
                <span className="mt-1 flex-1 text-sm text-muted">{l.description}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange">
                  Go <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
