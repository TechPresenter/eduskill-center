import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { BrandMark } from "@/components/brand";
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

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
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

export function SiteFooter({ branding, footer }: { branding: Branding; footer: { description?: string; legalLine?: string } }) {
  const year = new Date().getFullYear();
  const socials = Object.entries(branding.social).filter(([, url]) => !!url && /^https?:\/\//i.test(url));
  const whatsappDigits = branding.contact.whatsapp.replace(/\D/g, "");
  const waHref = whatsappDigits ? `https://wa.me/${whatsappDigits.length === 10 ? `91${whatsappDigits}` : whatsappDigits}` : null;
  const phoneHref = branding.contact.phone ? `tel:${branding.contact.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <footer className="relative bg-navy-dark text-white pb-safe" aria-labelledby="site-footer-heading">
      <div className="h-1 bg-orange" aria-hidden />
      <h2 id="site-footer-heading" className="sr-only">
        Footer
      </h2>

      <div className="container-x py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand + contact */}
          <div className="lg:col-span-4">
            <Link href="/" aria-label={`${branding.siteName} – home`} className="inline-block rounded-lg">
              <BrandMark branding={branding} variant="footer" light />
            </Link>
            {branding.tagline && <p className="mt-5 text-[13px] font-bold tracking-[0.12em] text-orange uppercase">{branding.tagline}</p>}
            {footer.description && <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/75">{footer.description}</p>}

            <ul className="mt-6 space-y-3 text-sm">
              {branding.contact.email && (
                <li>
                  <a href={`mailto:${branding.contact.email}`} className="group inline-flex items-start gap-3 text-white/85 hover:text-white">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-orange group-hover:bg-orange group-hover:text-white">
                      <Mail className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="break-all pt-2">{branding.contact.email}</span>
                  </a>
                </li>
              )}
              {branding.contact.phone && (
                <li className="flex items-start gap-3 text-white/85">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-orange">
                    <Phone className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="pt-2">
                    {phoneHref ? (
                      <a href={phoneHref} className="hover:text-white">
                        {branding.contact.phone}
                      </a>
                    ) : (
                      branding.contact.phone
                    )}
                    {waHref && (
                      <>
                        {" · "}
                        <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-orange underline-offset-2 hover:underline">
                          WhatsApp
                        </a>
                      </>
                    )}
                  </span>
                </li>
              )}
              {branding.contact.address && (
                <li className="flex items-start gap-3 text-white/85">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-orange">
                    <MapPin className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="pt-2 whitespace-pre-line">{branding.contact.address}</span>
                </li>
              )}
              {branding.contact.hours && (
                <li className="flex items-start gap-3 text-white/85">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-orange">
                    <Clock className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="pt-2">{branding.contact.hours}</span>
                </li>
              )}
            </ul>

            {socials.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Social media">
                {socials.map(([key, url]) => {
                  const icon = SOCIAL_ICONS[key];
                  if (!icon) return null;
                  return (
                    <li key={key}>
                      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={icon.label} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-orange">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                          <path d={icon.path} />
                        </svg>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Link columns */}
          <nav className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8 lg:gap-x-8" aria-label="Footer">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-[13px] font-bold tracking-[0.12em] text-white uppercase">{col.title}</h3>
                <ul className="mt-4 space-y-1">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className="group inline-flex min-h-9 items-center gap-1.5 text-[15px] text-white/70 transition-colors hover:text-white">
                        <span className="h-1 w-1 rounded-full bg-orange/70 transition-all group-hover:w-2.5" aria-hidden />
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Call to action strip */}
        <div className="mt-12 flex flex-col gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between lg:mt-16">
          <div>
            <p className="font-heading text-lg font-extrabold text-white">Ready to start learning or teaching?</p>
            <p className="text-sm text-white/70">Find a training center near you, apply for a course, or volunteer as a trainer.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/training-centers" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15">
              Find a Center
            </Link>
            <Link href="/register" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange px-5 text-sm font-semibold text-white hover:bg-orange-hover">
              Apply Now <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-3 py-5 text-xs text-white/60 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {year} {branding.siteName}. All Rights Reserved.
            {(footer.legalLine || branding.registrationInfo) && <span className="block sm:inline sm:before:mx-2 sm:before:content-['·']">{[footer.legalLine, branding.registrationInfo].filter(Boolean).join(" · ")}</span>}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Legal">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-8 items-center hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
