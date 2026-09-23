import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Clock, Compass, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { IconTile, SectionBg } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import { SocialLinks } from "@/components/site/social-links";
import type { Branding } from "@/lib/settings";

const COLUMNS: { id: string; title: string; links: { label: string; href: string }[] }[] = [
  {
    id: "explore",
    title: "Explore",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Programs", href: "/programs" },
      { label: "Courses", href: "/courses" },
      { label: "Training Centers", href: "/training-centers" },
      { label: "Success Stories", href: "/success-stories" },
      { label: "Gallery", href: "/gallery" },
    ],
  },
  {
    id: "students",
    title: "Students",
    links: [
      { label: "Register", href: "/register" },
      { label: "Student Login", href: "/login" },
      { label: "Apply for Admission", href: "/register?next=%2Fstudent%2Fapply" },
      { label: "Admission Process", href: "/#admission-process" },
      { label: "Fees & Scholarships", href: "/scholarship" },
      { label: "Verify Certificate", href: "/verify-certificate" },
    ],
  },
  {
    id: "volunteer",
    title: "Volunteer & Support",
    links: [
      { label: "Become a Trainer", href: "/become-a-trainer" },
      { label: "Apply as Trainer", href: "/become-a-trainer/apply" },
      { label: "Track Application", href: "/become-a-trainer/status" },
      { label: "Open a Centre", href: "/open-a-centre" },
      { label: "Apply to Open a Centre", href: "/open-a-centre/apply" },
      { label: "Trainer Login", href: "/login" },
      { label: "Donate", href: "/donate" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
  {
    id: "resources",
    title: "Resources",
    links: [
      { label: "Scholarship", href: "/scholarship" },
      { label: "FAQ", href: "/faq" },
      { label: "Blog", href: "/blog" },
      { label: "Events", href: "/events" },
      { label: "Center Map", href: "/training-centers?view=map" },
    ],
  },
];

const LEGAL: { label: string; href: string }[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Disclaimer", href: "/disclaimer" },
];

/**
 * One footer link column.
 *
 * Phones get a disclosure, so the footer reads as four headings instead of 33 stacked links; from
 * `md` up the toggle disappears and the list is simply always visible. It is CSS-only — a visually
 * hidden checkbox read through `group-has-[:checked]` — so the footer stays a server component and
 * ships no JavaScript for this. `<details>` is deliberately NOT used: re-opening a `details` at
 * `md+` needs `::details-content`, which would hide the columns outright on older browsers.
 */
function FooterColumn({ id, title, links }: { id: string; title: string; links: { label: string; href: string }[] }) {
  const toggleId = `footer-${id}-toggle`;
  const listId = `footer-${id}-links`;
  return (
    <div className="group max-md:border-t max-md:border-white/10">
      <input id={toggleId} type="checkbox" className="peer sr-only md:hidden" aria-controls={listId} />
      <h3 className="rounded-lg text-overline font-heading text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-navy-dark">
        <label htmlFor={toggleId} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 select-none md:pointer-events-none md:min-h-0 md:cursor-default">
          <span>{title}</span>
          <ChevronDown
            className="size-4.5 shrink-0 text-white/70 transition-transform duration-element ease-soft group-has-[:checked]:-rotate-180 motion-reduce:transition-none md:hidden"
            aria-hidden
          />
        </label>
      </h3>
      <span className="mt-3 hidden h-0.5 w-7 rounded-full bg-orange md:block" aria-hidden />
      <ul id={listId} className="max-md:hidden max-md:pb-3 max-md:group-has-[:checked]:block md:mt-3.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="group/link flex min-h-11 items-center gap-2.5 text-body text-white/75 transition-colors duration-micro hover:text-white active:text-white motion-reduce:transition-none md:min-h-8">
              <span className="size-1.5 shrink-0 rounded-full bg-orange transition-transform duration-micro ease-soft group-hover/link:translate-x-1 motion-reduce:transition-none" aria-hidden />
              <span>{l.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Icon + label + value cell for the full-width contact strip. */
function ContactRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <IconTile icon={Icon} tone="white" size="sm" className="text-orange" />
      <div className="min-w-0 pt-0.5">
        <dt className="text-overline text-white/70">{label}</dt>
        <dd className="mt-1 text-body text-white/85">{children}</dd>
      </div>
    </div>
  );
}

export function SiteFooter({ branding, footer }: { branding: Branding; footer: { description?: string; legalLine?: string } }) {
  const year = new Date().getFullYear();
  const whatsappDigits = branding.contact.whatsapp.replace(/\D/g, "");
  const waHref = whatsappDigits ? `https://wa.me/${whatsappDigits.length === 10 ? `91${whatsappDigits}` : whatsappDigits}` : null;
  const phoneHref = branding.contact.phone ? `tel:${branding.contact.phone.replace(/[^\d+]/g, "")}` : null;
  const hasContact = !!(branding.contact.email || branding.contact.phone || branding.contact.address || branding.contact.hours);
  const legalLine = [footer.legalLine, branding.registrationInfo].filter(Boolean).join(" · ");

  return (
    <footer className="relative isolate overflow-x-clip bg-navy-dark text-white pb-safe" aria-labelledby="site-footer-heading">
      {/* Depth on the flat navy: a soft brand wash plus a faint edge-faded grid. Both are clipped by
          this element's own overflow-hidden, so neither can ever widen the page. The dot variant is
          avoided here on purpose — the closing CtaBand above the footer already uses a dot field. */}
      <SectionBg tone="navy" variant="mesh" />
      <SectionBg tone="navy" variant="grid" className="opacity-50" />

      <div className="relative z-10">
        <div className="h-1 bg-linear-to-r from-orange via-orange to-navy-light" aria-hidden />
        <h2 id="site-footer-heading" className="sr-only">
          Footer
        </h2>

        <div className="container-x py-12 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
            {/* Brand lockup, tagline, social */}
            <div className="lg:col-span-4">
              <Link href="/" aria-label={`${branding.siteName} – home`} className="inline-flex min-h-11 items-center rounded-xl">
                <BrandMark branding={branding} variant="footer" light />
              </Link>

              {branding.tagline && (
                <p className="mt-6 flex items-start gap-3">
                  <span className="mt-1 h-4 w-1 shrink-0 rounded-full bg-orange" aria-hidden />
                  <span className="text-overline font-heading text-white">{branding.tagline}</span>
                </p>
              )}
              {footer.description && <p className="mt-4 max-w-md text-body text-white/80">{footer.description}</p>}

              {/*
                Follow us. Shares one component with the top bar, so both rows carry the same
                brand-colour fill on hover and focus; only the circle size differs, and the footer
                takes the comfortable 44px one. Renders nothing at all while no social URL is set.
              */}
              <SocialLinks social={branding.social} whatsapp={branding.contact.whatsapp} siteName={branding.siteName} heading="Follow Us" className="mt-7" />
            </div>

            {/* Link columns — accordions on phones, four open columns from md up */}
            <nav className="lg:col-span-8" aria-label="Footer">
              <div className="grid max-md:border-b max-md:border-white/10 md:grid-cols-4 md:gap-x-6 lg:gap-x-8">
                {COLUMNS.map((col) => (
                  <FooterColumn key={col.id} id={col.id} title={col.title} links={col.links} />
                ))}
              </div>
            </nav>
          </div>

          {/* Contact strip. These four details used to sit in the brand column, where a 4-of-12
              column left them no choice but to stack. Given their own full-width row they line up
              side by side: two across on phones (four across at 360px leaves each item ~90px, which
              shreds the address, and 768px squeezes the office hours onto three lines), four across with
              hairline dividers from lg up. */}
          {hasContact && (
            <Reveal className="mt-10 border-t border-white/10 pt-8 lg:mt-12">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-7 md:gap-x-10 lg:grid-cols-4 lg:gap-x-0 lg:[&>*]:px-6 lg:[&>*+*]:border-l lg:[&>*+*]:border-white/10 lg:[&>*:first-child]:pl-0 lg:[&>*:last-child]:pr-0">
                {branding.contact.email && (
                  <ContactRow icon={Mail} label="Email">
                    <a href={`mailto:${branding.contact.email}`} className="inline-flex min-h-11 items-center break-all transition-colors hover:text-white motion-reduce:transition-none">
                      {branding.contact.email}
                    </a>
                  </ContactRow>
                )}
                {branding.contact.phone && (
                  <ContactRow icon={Phone} label="Phone">
                    {phoneHref ? (
                      <a href={phoneHref} className="inline-flex min-h-11 items-center transition-colors hover:text-white motion-reduce:transition-none">
                        {branding.contact.phone}
                      </a>
                    ) : (
                      branding.contact.phone
                    )}
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex min-h-11 w-fit items-center text-body-sm font-semibold text-white underline decoration-orange decoration-2 underline-offset-4"
                      >
                        WhatsApp
                      </a>
                    )}
                  </ContactRow>
                )}
                {branding.contact.address && (
                  <ContactRow icon={MapPin} label="Address">
                    <span className="whitespace-pre-line">{branding.contact.address}</span>
                  </ContactRow>
                )}
                {branding.contact.hours && (
                  <ContactRow icon={Clock} label="Office Hours">
                    {branding.contact.hours}
                  </ContactRow>
                )}
              </dl>
            </Reveal>
          )}

          {/* Closing prompt. Deliberately a quiet utility strip rather than a second hero CTA: pages
              can already end with a full CtaBand, and two of those in a row read as a mistake. */}
          <Reveal className="mt-10 lg:mt-12">
            <div className="relative overflow-hidden rounded-2xl bg-white/5 ring-1 ring-inset ring-white/10">
              <span className="absolute inset-y-0 left-0 w-1 bg-orange" aria-hidden />
              <div className="flex flex-col gap-5 p-5 pl-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4">
                <div className="flex items-start gap-3.5">
                  <IconTile icon={Compass} tone="white" size="sm" className="max-sm:hidden" />
                  <div>
                    <p className="text-h4 text-white">Ready to start learning or teaching?</p>
                    <p className="mt-1 text-body-sm text-white/75">Find a training center near you, apply for a course, or volunteer as a trainer.</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                  <Link
                    href="/training-centers"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white/10 px-5 text-body font-semibold text-white ring-1 ring-inset ring-white/20 transition duration-micro ease-soft hover:bg-white/20 active:scale-[0.98] motion-reduce:transition-none sm:h-11"
                  >
                    Find a Center
                  </Link>
                  <Link
                    href="/register"
                    className="group/cta inline-flex h-12 items-center justify-center gap-2 rounded-md bg-orange px-5 text-body font-semibold text-white transition duration-micro ease-soft hover:bg-orange-hover active:scale-[0.98] motion-reduce:transition-none sm:h-11"
                  >
                    Apply Now
                    <ArrowUpRight className="size-4 transition-transform duration-micro group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Legal / bottom bar */}
        <div className="border-t border-white/10 bg-navy-dark/60">
          <div className="container-x flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="text-body-sm text-white/70">
              <p>
                © {year} {branding.siteName}. All Rights Reserved.
              </p>
              {legalLine && <p className="mt-1">{legalLine}</p>}
            </div>
            <ul className="-mx-2.5 flex flex-wrap items-center lg:justify-end" aria-label="Legal">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="ring-focus-inverse flex min-h-11 items-center rounded-md px-2.5 text-body-sm text-white/70 transition-colors duration-micro hover:text-white active:text-white motion-reduce:transition-none lg:min-h-9">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
