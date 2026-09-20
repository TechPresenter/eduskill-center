import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Clock, Compass, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { IconTile, SectionBg } from "@/components/site/decor";
import { Reveal } from "@/components/site/reveal";
import type { Branding } from "@/lib/settings";

const SOCIAL_ICONS: Record<string, { label: string; path: string }> = {
  facebook: { label: "Facebook", path: "M14 8h2.5V4.5H14c-2.5 0-4 1.6-4 4V11H7.5v3.5H10V20h3.5v-5.5h2.6l.5-3.5h-3.1V9c0-.6.4-1 1-1Z" },
  instagram: {
    label: "Instagram",
    path: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm4 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm4.6-3.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  },
  twitter: { label: "X (Twitter)", path: "M4 4h4.3l3.9 5.4L16.9 4H20l-6.3 7.2L20.5 20h-4.3l-4.2-5.8L6.9 20H3.8l6.7-7.6L4 4Zm2.9 1.5 9.4 13h1.4L8.4 5.5H6.9Z" },
  linkedin: { label: "LinkedIn", path: "M5.5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.8 9h3.4v11H3.8V9Zm5.7 0h3.3v1.5c.5-.9 1.7-1.8 3.5-1.8 3.6 0 4.3 2.4 4.3 5.4V20h-3.4v-5.2c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V20H9.5V9Z" },
  youtube: { label: "YouTube", path: "M21.6 7.2a2.5 2.5 0 0 0-1.7-1.8C18.3 5 12 5 12 5s-6.3 0-7.9.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.7 1.8c1.6.4 7.9.4 7.9.4s6.3 0 7.9-.4a2.5 2.5 0 0 0 1.7-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" },
};

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
      <h3 className="rounded-lg font-heading text-[13px] font-bold tracking-[0.14em] text-white uppercase peer-focus-visible:ring-2 peer-focus-visible:ring-orange peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-navy-dark">
        <label htmlFor={toggleId} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 select-none md:pointer-events-none md:min-h-0 md:cursor-default">
          <span>{title}</span>
          <ChevronDown
            className="h-[18px] w-[18px] shrink-0 text-white/70 transition-transform duration-200 group-has-[:checked]:-rotate-180 motion-reduce:transition-none md:hidden"
            aria-hidden
          />
        </label>
      </h3>
      <span className="mt-3 hidden h-0.5 w-7 rounded-full bg-orange md:block" aria-hidden />
      <ul id={listId} className="max-md:hidden max-md:pb-3 max-md:group-has-[:checked]:block md:mt-3.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="group/link flex min-h-11 items-center gap-2.5 text-[15px] leading-snug text-white/75 transition-colors hover:text-white motion-reduce:transition-none md:min-h-8">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange transition-transform duration-200 group-hover/link:translate-x-1 motion-reduce:transition-none" aria-hidden />
              <span>{l.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Icon + label + value row for the contact block in the brand column. */
function ContactRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-orange ring-1 ring-inset ring-white/15" aria-hidden>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 pt-0.5">
        <dt className="text-[12px] font-bold tracking-[0.12em] text-white/70 uppercase">{label}</dt>
        <dd className="mt-1 text-[15px] leading-snug text-white/85">{children}</dd>
      </div>
    </div>
  );
}

export function SiteFooter({ branding, footer }: { branding: Branding; footer: { description?: string; legalLine?: string } }) {
  const year = new Date().getFullYear();
  const socials = Object.entries(branding.social).filter(([, url]) => !!url && /^https?:\/\//i.test(url));
  const whatsappDigits = branding.contact.whatsapp.replace(/\D/g, "");
  const waHref = whatsappDigits ? `https://wa.me/${whatsappDigits.length === 10 ? `91${whatsappDigits}` : whatsappDigits}` : null;
  const phoneHref = branding.contact.phone ? `tel:${branding.contact.phone.replace(/[^\d+]/g, "")}` : null;
  const hasContact = !!(branding.contact.email || branding.contact.phone || branding.contact.address || branding.contact.hours);
  const legalLine = [footer.legalLine, branding.registrationInfo].filter(Boolean).join(" · ");

  return (
    <footer className="relative isolate overflow-hidden bg-navy-dark text-white pb-safe" aria-labelledby="site-footer-heading">
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
            {/* Brand lockup, tagline, contact, social */}
            <div className="lg:col-span-4">
              <Link href="/" aria-label={`${branding.siteName} – home`} className="inline-flex rounded-xl">
                <BrandMark branding={branding} variant="footer" light />
              </Link>

              {branding.tagline && (
                <p className="mt-6 flex items-start gap-3">
                  <span className="mt-1 h-4 w-1 shrink-0 rounded-full bg-orange" aria-hidden />
                  <span className="font-heading text-[13px] font-bold tracking-[0.12em] text-white uppercase">{branding.tagline}</span>
                </p>
              )}
              {footer.description && <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">{footer.description}</p>}

              {hasContact && (
                <dl className="mt-7 grid gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10 sm:p-5">
                  {branding.contact.email && (
                    <ContactRow icon={Mail} label="Email">
                      <a href={`mailto:${branding.contact.email}`} className="break-all transition-colors hover:text-white motion-reduce:transition-none">
                        {branding.contact.email}
                      </a>
                    </ContactRow>
                  )}
                  {branding.contact.phone && (
                    <ContactRow icon={Phone} label="Phone">
                      {phoneHref ? (
                        <a href={phoneHref} className="transition-colors hover:text-white motion-reduce:transition-none">
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
                          className="mt-1 flex min-h-9 w-fit items-center text-[13px] font-semibold text-white underline decoration-orange decoration-2 underline-offset-4"
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
              )}

              {socials.length > 0 && (
                <div className="mt-7">
                  <h3 className="text-[12px] font-bold tracking-[0.14em] text-white/70 uppercase">Follow Us</h3>
                  <ul className="mt-3 flex flex-wrap gap-2.5">
                    {socials.map(([key, url]) => {
                      const icon = SOCIAL_ICONS[key];
                      if (!icon) return null;
                      return (
                        <li key={key}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={icon.label}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/20 transition duration-200 hover:bg-orange hover:ring-orange motion-reduce:transition-none"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                              <path d={icon.path} />
                            </svg>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
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

          {/* Closing prompt. Deliberately a quiet utility strip rather than a second hero CTA: pages
              can already end with a full CtaBand, and two of those in a row read as a mistake. */}
          <Reveal className="mt-12 lg:mt-16">
            <div className="relative overflow-hidden rounded-2xl bg-white/5 ring-1 ring-inset ring-white/10">
              <span className="absolute inset-y-0 left-0 w-1 bg-orange" aria-hidden />
              <div className="flex flex-col gap-5 p-5 pl-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4">
                <div className="flex items-start gap-3.5">
                  <IconTile icon={Compass} tone="white" size="sm" className="max-sm:hidden" />
                  <div>
                    <p className="font-heading text-base font-extrabold text-white sm:text-[17px]">Ready to start learning or teaching?</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/75 sm:text-sm">Find a training center near you, apply for a course, or volunteer as a trainer.</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                  <Link
                    href="/training-centers"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 px-5 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/20 motion-reduce:transition-none sm:h-11 sm:text-sm"
                  >
                    Find a Center
                  </Link>
                  <Link
                    href="/register"
                    className="group/cta inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange px-5 text-[15px] font-semibold text-white transition-colors hover:bg-orange-hover motion-reduce:transition-none sm:h-11 sm:text-sm"
                  >
                    Apply Now
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Legal / bottom bar */}
        <div className="border-t border-white/10 bg-navy-dark/60">
          <div className="container-x flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="text-[13px] leading-relaxed text-white/70">
              <p>
                © {year} {branding.siteName}. All Rights Reserved.
              </p>
              {legalLine && <p className="mt-1">{legalLine}</p>}
            </div>
            <ul className="-mx-2.5 flex flex-wrap items-center lg:justify-end" aria-label="Legal">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex min-h-11 items-center rounded-lg px-2.5 text-[13px] text-white/70 transition-colors hover:text-white motion-reduce:transition-none lg:min-h-9">
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
