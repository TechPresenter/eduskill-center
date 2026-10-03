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
      { label: "Computer & Skill Development Training", href: "/programs/computer-skill-development-training" },
      { label: "AI Workshop & Training", href: "/programs/ai-workshop-training" },
      { label: "Digital Marketing Training", href: "/programs/digital-marketing-training" },
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
      {/* White ring, not orange: this is the `ring-focus-inverse` rule spelled out by hand, because
          the indicator is driven by the peer checkbox's focus and not by this element's own. Orange
          is 3.55:1 on navy-dark — over the 3:1 floor but visibly dim; white is 13.21:1. */}
      <h3 className="rounded-lg text-overline font-heading text-white peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-navy-dark">
        <label htmlFor={toggleId} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 select-none md:pointer-events-none md:min-h-0 md:cursor-default">
          <span>{title}</span>
          <ChevronDown
            className="size-4.5 shrink-0 text-white/70 transition-transform duration-element ease-soft group-has-[:checked]:-rotate-180 motion-reduce:transition-none md:hidden"
            aria-hidden
          />
        </label>
      </h3>
      {/* 2px rule under the heading. A hairline is a THIN graphic on navy, which is exactly the case
          the on-navy tokens exist for: flat orange measures 3.55:1 here, orange-on-navy 7.10:1. */}
      <span className="mt-3 hidden h-0.5 w-7 rounded-full bg-orange-on-navy md:block" aria-hidden />
      <ul id={listId} className="max-md:hidden max-md:pb-3 max-md:group-has-[:checked]:block md:mt-3.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="group/link flex min-h-11 items-center gap-2.5 text-body text-white/75 transition-colors duration-micro hover:text-white active:text-white motion-reduce:transition-none md:min-h-8"
            >
              {/* 6px dot — the smallest mark in the footer, so it needs the brighter on-navy orange
                  (7.10:1) rather than the 3.55:1 flat brand hue. It grows into a short bar on hover
                  so the row reads as one gesture with the label. */}
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-on-navy transition-all duration-micro ease-soft group-hover/link:w-4 group-focus-visible/link:w-4 motion-reduce:transition-none"
                aria-hidden
              />
              {/* The label slides with the dot and draws an orange underline from left to right.
                  `bg-[length:0%_2px]` → `100%` animates the gradient's width, which is the only way
                  to animate an underline without a pseudo-element and without shifting the text. */}
              <span className="bg-linear-to-r from-orange-on-navy to-orange-on-navy bg-[length:0%_2px] bg-[position:0_100%] bg-no-repeat transition-[background-size,transform] duration-element ease-soft group-hover/link:translate-x-0.5 group-hover/link:bg-[length:100%_2px] group-focus-visible/link:bg-[length:100%_2px] motion-reduce:transition-none">
                {l.label}
              </span>
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
      {/* The glyph is a 1.5px lucide stroke sitting on a white/12 chip over navy-dark. Flat orange
          on that composite is 2.51:1 — under the 3:1 a graphic owes; orange-on-navy is 5.01:1. */}
      <IconTile icon={Icon} tone="white" size="sm" className="text-orange-on-navy" />
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
        {/* The page's closing brand rule. A 4px full-width fill is the one place all three logo hues
            can sit at full strength — it is a big fill, not text, so THE GREEN RULE is satisfied and
            green finally appears in the chrome. The topbar opens the page with the same sweep. */}
        <div className="h-1 bg-linear-to-r from-orange via-navy-light to-green" aria-hidden />
        <h2 id="site-footer-heading" className="sr-only">
          Footer
        </h2>

        <div className="container-x py-12 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
            {/* Brand lockup, tagline, social */}
            <div className="lg:col-span-4">
              {/* These links had no ring utility at all, only the UA default. ring-focus-inverse is
                  the one for a navy band — the orange ring measures 3.55:1 on navy-dark and 2.28:1
                  on the logo blue, white 13.21:1 — and it is what the legal row already uses. */}
              <Link href="/" aria-label={`${branding.siteName} – home`} className="inline-flex min-h-11 items-center rounded-xl ring-focus-inverse">
                <BrandMark branding={branding} variant="footer" light />
              </Link>

              {branding.tagline && (
                <p className="mt-6 flex items-start gap-3">
                  {/* 4px-wide rule beside the tagline — thin enough to need the on-navy orange (7.10:1). */}
                  <span className="mt-1 h-4 w-1 shrink-0 rounded-full bg-orange-on-navy" aria-hidden />
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
                    <a href={`mailto:${branding.contact.email}`} className="ring-focus-inverse inline-flex min-h-11 items-center rounded-sm break-all transition-colors hover:text-white motion-reduce:transition-none">
                      {branding.contact.email}
                    </a>
                  </ContactRow>
                )}
                {branding.contact.phone && (
                  <ContactRow icon={Phone} label="Phone">
                    {phoneHref ? (
                      <a href={phoneHref} className="ring-focus-inverse inline-flex min-h-11 items-center rounded-sm transition-colors hover:text-white motion-reduce:transition-none">
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
                        className="ring-focus-inverse mt-1 flex min-h-11 w-fit items-center rounded-sm text-body-sm font-semibold text-white underline decoration-orange-on-navy decoration-2 underline-offset-4"
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
              {/* Echo of the 4px rule at the top of the footer, turned on its side: a fill, so both
                  brand hues are used at full strength, and it ties the closing card to that seam. */}
              <span className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-orange to-green" aria-hidden />
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
                    className="ring-focus-inverse inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white/10 px-5 text-body font-semibold text-white ring-1 ring-inset ring-white/20 transition duration-micro ease-soft hover:bg-white/20 active:scale-[0.98] motion-reduce:transition-none sm:h-11"
                  >
                    Find a Center
                  </Link>
                  {/* Hand-rolled twin of the primary Button, so it needs the same fix: white on flat
                      #e8520a is 3.72:1 and a 16px semibold label is not "large text". btn-fill-orange
                      deepens the fill past 4.95:1 by 22% of the height, above the cap line; bg-orange
                      stays underneath as the forced-colors fallback. */}
                  <Link
                    href="/register"
                    className="group/cta btn-fill-orange ring-focus-inverse inline-flex h-12 items-center justify-center gap-2 rounded-md bg-orange px-5 text-body font-semibold text-white transition duration-micro ease-soft hover:bg-orange-hover active:scale-[0.98] motion-reduce:transition-none sm:h-11"
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
              {/* Copyright and the developer credit share one line; the credit only wraps on a
                  phone if there is genuinely no room. `btn-shine` is the codebase's existing
                  one-pass hover sweep, reused so there is one shine implementation, not two. */}
              <p className="flex flex-wrap items-center gap-x-1.5">
                <span>
                  © {year} {branding.siteName}. All Rights Reserved.
                </span>
                <span className="text-white/35" aria-hidden>
                  ·
                </span>
                <span className="text-white/55">Developed by</span>
                <a
                  href="https://appsgain.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-shine ring-focus-inverse group/credit relative inline-flex items-center rounded-md px-1 py-0.5 font-semibold"
                >
                  <span className="credit-sheen">Appsgain Technologies</span>
                  {/* Underline sweeps in from the left on hover and on keyboard focus. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-1 bottom-0.5 h-px origin-left scale-x-0 bg-orange-on-navy transition-transform duration-element ease-soft group-hover/credit:scale-x-100 group-focus-visible/credit:scale-x-100 motion-reduce:transition-none"
                  />
                </a>
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
